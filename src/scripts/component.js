import { domWalk } from './dom';
import { debounce } from './timing';
import { makeObservable, RAW, toRaw } from './reactivity';
import { saferEval } from './eval';
import { createEvent, getNextModifier, isKeyModifier, matchesKeyModifiers } from './events';
import { getForData, createMagicVariables, withMagicVariables, splitMagicVariables } from './magic-variables';
import { getAttributes, parseAttribute, updateAttribute } from './attributes';
import { hydrateProps, generateExpressionForProp } from './props';
import { injectDataProviders } from './data';
import { storage, isStorageModifier, getStorageType, computeExpires } from './storage';
import { getDirective } from './directives';
import { resolveMethods } from './methods';

/**
 * A window/document/outside listener or an intersect observer keeps its own reference to "el",
 * so removing "el" from the DOM wouldn't otherwise release it. This shared MutationObserver
 * notices removal once for the whole page and runs each binding's registered cleanup (same shape as youla-tooltip.js's ensureRemovalObserver).
 */
let disconnectObserver;
const disconnectCleanups = new Map();

function cleanupOnDisconnect(el, cleanup) {
  if (!disconnectObserver) {
    disconnectObserver = new MutationObserver(() => {
      disconnectCleanups.forEach((cleanups, target) => {
        if (!target.isConnected) {
          cleanups.forEach(fn => fn());
          disconnectCleanups.delete(target);
        }
      });
    });
    disconnectObserver.observe(document.body, { childList: true, subtree: true });
  }

  if (!disconnectCleanups.has(el)) {
    disconnectCleanups.set(el, []);
  }
  disconnectCleanups.get(el).push(cleanup);
}

/**
 * Determines whether a function is an arrow function, by inspecting its source text: an
 * arrow's "=>" sits before its body's opening "{" (or there's no "{" at all, for a concise body).
 *
 * @param {Function} fn - The function to inspect.
 * @returns {boolean} True if "fn" is an arrow function.
 */
function isArrowFunction(fn) {
  const source = Function.prototype.toString.call(fn);

  if (/^\s*(async\s+)?function/.test(source)) {
    return false;
  }

  const braceIndex = source.indexOf('{');
  const arrowIndex = source.indexOf('=>');

  return arrowIndex !== -1 && (braceIndex === -1 || arrowIndex < braceIndex);
}

export default class Component {
  /**
   * Builds a component rooted at "el": reads its "v-data" expression and modifiers, builds the
   * initial reactive data (data providers, form field values, storage), and performs the first render.
   *
   * @param {HTMLElement} el - The element carrying the "v-data" attribute.
   */
  constructor(el) {
    let dataProviderContext = injectDataProviders();

    // Modifiers only ever live in the attribute's own name (e.g. "v-data.local"), never in its value, so find the entry by directive root instead of assuming it's literally named "v-data".
    const { expression, modifiers } = getAttributes(el).find(({ directive }) => directive === 'v-data') || { expression: '{}', modifiers: [] };

    // v-data="object as o" gives the whole data object a local alias
    const [, dataExpression, alias] = expression.trim().match(/^([\s\S]+?)\s+as\s+([A-Za-z_$][\w$]*)$/) || [];

    this.root          = el;
    this.name          = (dataExpression ?? expression).trim();
    this.alias         = alias || null;
    this.storageType   = isStorageModifier(modifiers) ? getStorageType(modifiers) : null;
    // A duration modifier (e.g. "v-data.cookie.30d") sits right after "cookie"/"local" in the modifier list, same convention as "v-prop"; omitting it means a session cookie or no expiration at all.
    this.storageExpire = this.storageType ? getNextModifier(modifiers, this.storageType) : null;

    this.rawData = saferEval(this.name || '{}', dataProviderContext);
    this.rawData = hydrateProps(el, this.rawData);

    // Rehydrate from whatever was persisted last time, on top of the fresh factory defaults, so new keys added later still show up for visitors with stale storage.
    if (this.storageType) {
      const saved = storage.get(`v-data:${this.name}`, this.storageType);
      if (saved) {
        try {
          Object.assign(this.rawData, typeof saved === 'string' ? JSON.parse(saved) : saved);
        } catch (error) {}
      }
    }

    this.data = this.observeData(this.rawData);

    this.initialize(el);
  }

  /**
   * Writes the component's raw data to storage, if "v-data" carries a ".local"/".cookie"
   * modifier — a no-op otherwise. Called after every reactive write.
   */
  persist() {
    if (this.storageType) {
      storage.set(`v-data:${this.name}`, this.rawData, this.storageType, { path: '/', secure: true, expires: computeExpires(this.storageExpire) });
    }
  }

  /**
   * Evaluates an expression (or calls a function) against the component's data, tracking
   * which top-level data properties were read via a dependency-tracking proxy.
   *
   * @param {string|Function} expressionOrFn - A JS expression string, or a function (e.g. a v-bind method) called with the proxy as "this".
   * @param {Object} [additionalHelperVariables] - Extra variables available alongside the component's data (loop/magic variables).
   * @returns {{output: *, deps: string[]}} The evaluated result and the property names it read.
   */
  evaluate(expressionOrFn, additionalHelperVariables) {
    let deps = [];

    const makeProxy = (data) => new Proxy(data, {
      get(target, prop) {
        // Lets reactivity.js's toRaw() see through this proxy too, so a value read here and written back through makeObservable's proxy isn't wrapped again (see toRaw()).
        if (prop === RAW) {
          return toRaw(target);
        }

        deps.push(prop);

        if (typeof target[prop] === 'object' && target[prop] !== null) {
          return makeProxy(target[prop]);
        }

        return target[prop];
      }
    });

    const proxiedData = makeProxy(this.data);

    // Magic variables skip the tracking proxy since wrapping a DOM element would break native calls like $el.closest(); they're layered onto $data instead (see withMagicVariables).
    const { magicVariables, otherVariables } = splitMagicVariables(additionalHelperVariables);

    // "v-each" loop variables are passed to saferEval as separate parameters rather than properties of $data, so wrap object-valued ones the same way or property reads on them go untracked.
    const trackedHelperVariables = Object.fromEntries(
      Object.entries(otherVariables).map(([key, value]) => [
        key, (typeof value === 'object' && value !== null) ? makeProxy(value) : value
      ])
    );

    const contextData = withMagicVariables(proxiedData, magicVariables);

    // A v-bind entry may hand back a method instead of an expression string — call it with "this" bound to the same context, so property access is tracked exactly like an expression string's.
    const output = typeof expressionOrFn === 'function'
      ? expressionOrFn.call(contextData)
      : saferEval(expressionOrFn, contextData, trackedHelperVariables);

    return { output, deps };
  }

  /**
   * Reads every directive/event/bind attribute off "el", expanding any "v-bind" entry into the
   * individual directive/event/bind entries its expression resolves to (e.g. v-bind="trigger"
   * referencing "trigger" from Youla.data('dropdown', () => ({ trigger: {...} }))).
   *
   * @param {HTMLElement} el - The element to read attributes from.
   * @returns {Array<Object>} The resolved list of attribute descriptors.
   */
  resolveAttributes(el) {
    const self = this;
    const additionalHelperVariables = {...getForData(el), ...this.getAliasVariables(), ...this.getMagicVariables(el)};

    return getAttributes(el).flatMap(attribute => {
      if (attribute.directive !== 'v-bind') {
        return [attribute];
      }

      let bindings;
      try {
        ({ output: bindings } = self.evaluate(attribute.expression, additionalHelperVariables));
      } catch (error) {
        return [];
      }

      if (!bindings || typeof bindings !== 'object') {
        return [];
      }

      return Object.entries(bindings).flatMap(([name, value]) => {
        const isFn    = typeof value === 'function';
        const parsed  = parseAttribute(name, value);

        // Arrow functions ignore .call()/.apply() and silently keep their original "this", so detect one from its source text — an arrow's "=>" appears before its body's opening "{" (or there's none), which a function/method never does.
        if (isFn && isArrowFunction(value)) {
          console.warn(`Youla.js: v-bind key "${name}" is an arrow function — arrow functions don't bind "this" to the component's data. Use a regular function or method shorthand instead: "${name}"() { ... }.`);
        }

        // A key with no v-/@/: prefix (e.g. "type") is a plain HTML attribute, written directly as markup.
        const isPlainAttribute = !parsed.directive && !parsed.event && !parsed.bind;

        // A "v-*" key that isn't a registered directive (e.g. "v-ref") is read straight off the element instead (see createRefsProxy), so write it as a real attribute since there's none to read yet.
        if (parsed.directive && !getDirective(parsed.directive)) {
          el.setAttribute(name, isFn ? value.call(self.data) : value);
          return [];
        }

        return [{
          ...parsed,
          expression: value,
          bind: parsed.bind || isPlainAttribute,
          // Strings on a "v-*"/"@"/":" key are expressions (evaluated, reactive); functions are always computed; anything else is a one-time static value applied as-is.
          literal: !isFn && (isPlainAttribute || typeof value !== 'string')
        }];
      });
    });
  }

  /**
   * Wraps a plain data object (and, recursively, any nested object it contains) in a Proxy
   * that tracks writes: each successful "set" queues the changed property in "concernedData"
   * and triggers a refresh (plus a persist, if storage is enabled).
   *
   * @param {Object} data - The raw data object to make observable.
   * @returns {Object} The observable (proxied) version of "data".
   */
  observeData(data) {
    this.concernedData = [];

    return makeObservable(data, prop => {
      if (!this.concernedData.includes(prop)) {
        this.concernedData.push(prop);
        this.refresh();
        this.persist();
      }
    });
  }

  /**
   * Resolves an attribute's output — and, when "withDeps" is set, the data properties it
   * reads — sharing the "v-each"/"literal" special-casing that both "initialize()" and
   * "refresh()" need before they can decide whether/how to dispatch an attribute.
   *
   * @param {Object} attribute - A parsed attribute descriptor, as returned by "resolveAttributes()".
   * @param {Object} additionalHelperVariables - Extra variables available to the expression (see "evaluate()").
   * @param {Object} [options]
   * @param {boolean} [options.withDeps] - When true, also resolves "v-each"'s deps from its raw expression (untracked by evaluate()).
   * @returns {{output: *, deps: string[]}} The resolved output, and (when requested) its tracked deps.
   */
  computeOutput(attribute, additionalHelperVariables, { withDeps = false } = {}) {
    const { directive, expression, literal } = attribute;
    let output = expression, deps = [];

    if (directive === 'v-each') {
      if (withDeps) {
        [, deps] = expression.split(' in ');
      }
    } else if (!literal) {
      try {
        ({ output, deps } = this.evaluate(expression, additionalHelperVariables));
      } catch (error) {
        output = undefined;
      }
    }

    return { output, deps };
  }

  /**
   * Dispatches a resolved attribute: attribute binding ("bind") writes "output" straight onto
   * the element, while a directive attribute hands it off to its registered implementation.
   *
   * @param {HTMLElement} el - The element the attribute belongs to.
   * @param {Object} attribute - The parsed attribute descriptor.
   * @param {*} output - The attribute's resolved output, from "computeOutput()".
   * @param {Object} additionalHelperVariables - Forwarded to the directive implementation, if any.
   */
  applyAttribute(el, attribute, output, additionalHelperVariables) {
    const { directive, bind, name } = attribute;

    if (bind) {
      updateAttribute(el, name.replace(':', ''), output);
    } else {
      getDirective(directive)(el, output, attribute, this, additionalHelperVariables);
    }
  }

  /**
   * Performs the component's first render: walks the DOM from "root", attaching listeners and
   * running directives for every element. Idempotent per element ("el.__x_initialized"), since a
   * directive that inserts child markup (repeaterList() in controls/repeater.js, contentFields()
   * in youla-editrix.js) runs within the same domWalk pass that then revisits that markup —
   * without the guard, listeners double-attach and a self-removing handler like repeaterRemove()
   * throws on an already-detached element.
   *
   * @param {HTMLElement} root - The root element to walk and initialize.
   */
  initialize(root) {
    const self = this;

    domWalk(root, el => {
      if (el.__x_initialized) {
        return;
      }
      el.__x_initialized = true;

      const additionalHelperVariables = {...getForData(el), ...self.getAliasVariables(), ...self.getMagicVariables(el)};

      self.resolveAttributes(el).forEach(attribute => {
        let {directive, event, expression, modifiers, bind} = attribute;

        let propExpression;
        if (directive === 'v-prop') {
          propExpression = generateExpressionForProp(el, self.data, attribute);

          // If the element we are binding to is a select, a radio, or checkbox we'll listen for the change event instead of the "input" event.
          event = ['select-multiple', 'select', 'checkbox', 'radio'].includes(el.type) || modifiers.includes('lazy')
            ? 'change'
            : 'input';
        }

        if (event) {
          // "v-prop"'s own modifiers (.number, .trim, .local, .cookie, .lazy) shape the bound value, not the event, so only forward modifiers for a real "@event" attribute.
          self.attachListener(el, event, directive === 'v-prop' ? [] : modifiers, propExpression || expression);
        }

        // Attribute binding ("bind") is a distinct mechanism from directives, resolved and dispatched the same way but never looked up in the directive registry; see ./attributes
        if (bind || getDirective(directive)) {
          const { output } = self.computeOutput(attribute, additionalHelperVariables);

          self.applyAttribute(el, attribute, output, additionalHelperVariables);
        }
      });
    });
  }

  /**
   * Re-evaluates every element's bindings, re-running only those whose dependencies changed
   * since the last flush. Clears "concernedData" once the pass completes.
   *
   * @param {boolean} [force] - Re-runs every binding unconditionally, for state that lives outside the reactive data (see `$step` in youla-extensions.js).
   */
  refresh(force = false) {
    const self = this;

    // OR'd across calls before the debounced flush runs, so a forced call is never lost to a later plain one.
    this.pendingForceRefresh = this.pendingForceRefresh || force;

    // Built once and reused, not recreated per call — otherwise each write in a fast burst (e.g. dragging a v-filler/v-ranger slider) would queue its own full domWalk instead of coalescing.
    this.scheduleRefresh ??= debounce(() => {
      const force = self.pendingForceRefresh;
      self.pendingForceRefresh = false;

      domWalk(self.root, el => {
        // An element inside a "v-each" clone only carries its loop variables on "__x_for_data", so resolve them here too or bindings referencing them stop updating after the first render.
        const additionalHelperVariables = {...getForData(el), ...self.getAliasVariables(), ...self.getMagicVariables(el)};

        self.resolveAttributes(el).forEach(attribute => {
          const { directive, bind } = attribute;

          if (bind || getDirective(directive)) {
            const { output, deps } = self.computeOutput(attribute, additionalHelperVariables, { withDeps: true });

            if (force || self.concernedData.some(dep => deps.includes(dep))) {
              self.applyAttribute(el, attribute, output, additionalHelperVariables);
            }
          }
        });
      });

      self.concernedData = [];
    }, 0);

    this.scheduleRefresh();
  }

  /**
   * Builds and attaches a DOM listener for "@event" (or v-prop's synthetic event), applying its
   * modifiers (retargeting, passive/capture, delay, prevent, stop, outside, key filters, once,
   * load/intersect). Window/document/outside listeners and intersect observers auto-detach on "el" removal (see cleanupOnDisconnect()); everything else is cleaned up by GC once "el" itself is removed.
   *
   * @param {HTMLElement} el - The element the listener conceptually belongs to.
   * @param {string} event - The event name to listen for (e.g. "click", "load", "intersect").
   * @param {string[]} modifiers - The attribute's modifiers, driving the behavior above.
   * @param {string|Function} expression - The expression or function to run when the event fires.
   */
  attachListener(el, event, modifiers, expression) {
    // Lets each modifier below wrap the handler in its own middleware, in any combination, without the branches knowing about each other.
    const wrapHandler = (callback, wrapper) => e => wrapper(callback, e);

    let target  = el;
    let options = {};
    let handler = e => this.invokeListener(expression, e, el);

    if (modifiers.includes('window')) {
      target = window;
    }

    if (modifiers.includes('document')) {
      target = document;
    }

    if (modifiers.includes('passive')) {
      options.passive = true;
    }

    if (modifiers.includes('capture')) {
      options.capture = true;
    }

    if (modifiers.includes('delay')) {
      handler = debounce(handler, Number(getNextModifier(modifiers, 'delay').split('ms')[0]) || 250);
    }

    if (modifiers.includes('prevent')) {
      handler = wrapHandler(handler, (next, e) => { e.preventDefault(); next(e); });
    }

    if (modifiers.includes('stop')) {
      handler = wrapHandler(handler, (next, e) => { e.stopPropagation(); next(e); });
    }

    if (modifiers.includes('outside')) {
      target = document;

      handler = wrapHandler(handler, (next, e) => {
        // Ignore a click that came from the element or within it.
        if (el.contains(e.target)) {
          return;
        }

        // Ignore clicks while this element isn't currently visible.
        if (el.offsetWidth < 1 && el.offsetHeight < 1) {
          return;
        }

        if (e.target.isConnected === false) {
          return;
        }

        next(e);
      });
    }

    // Key/system-modifier filter (e.g. "@keydown.enter") must be the outermost wrap, so a mismatched key skips prevent/stop/delay too.
    if (modifiers.some(isKeyModifier)) {
      handler = wrapHandler(handler, (next, e) => matchesKeyModifiers(e, modifiers) && next(e));
    }

    if (modifiers.includes('once')) {
      options.once = true;
    }

    if (event === 'load') {
      handler(createEvent(event,{}));
    }

    if (event === 'intersect') {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          handler(entry);

          if (modifiers.includes('once')) {
            observer.disconnect();
          }
        }
      }));
      observer.observe(el);
      cleanupOnDisconnect(el, () => observer.disconnect());
    }

    target.addEventListener(event, handler, options);

    // "target" isn't "el" for window/document/outside; without this cleanup the listener outlives "el" leaving the DOM.
    if (target !== el) {
      cleanupOnDisconnect(el, () => target.removeEventListener(event, handler, options));
    }
  }

  /**
   * Runs an event handler: a function is called directly with the component's data as "this";
   * a string expression is evaluated with the magic variables, every registered method, and
   * any enclosing "v-each" loop variables available to it.
   *
   * @param {string|Function} expressionOrFn - The handler to run.
   * @param {Event} e - The DOM event that triggered the handler.
   * @param {HTMLElement} target - The element the listener is attached to.
   */
  invokeListener(expressionOrFn, e, target) {
    const contextData = withMagicVariables(this.data, this.getMagicVariables(target, e));

    // A v-bind entry may hand back a method instead of an expression string — call it directly with "this" as the component's reactive data, so writes to it still trigger refresh().
    if (typeof expressionOrFn === 'function') {
      expressionOrFn.call(contextData, e);
      return;
    }

    const expression = expressionOrFn;
    const methods = resolveMethods(e, target, this);
    const data = getForData(target);

    saferEval(expression, contextData, {
      ...this.getAliasVariables(),
      ...methods,
      ...data
    }, true);
  }

  /**
   * Returns the component's local data alias (from `v-data="notice as n"`), if any — keyed like
   * a "v-each" loop variable so it's tracked for reactivity, unlike magic variables like "$el".
   *
   * @returns {object} "{ [alias]: this.data }", or "{}" when "v-data" carries no alias.
   */
  getAliasVariables() {
    return this.alias ? { [this.alias]: this.data } : {};
  }

  /**
   * Builds the "$el"/"$event"/"$refs"/"$root" magic variables for evaluation against/for "el".
   *
   * @param {HTMLElement} el - The element the expression is being evaluated for/against; becomes "$el".
   * @param {Event} [event] - The triggering DOM event, if any; becomes "$event".
   * @returns {object} The magic variables, ready to merge into "additionalHelperVariables".
   */
  getMagicVariables(el, event) {
    return createMagicVariables(this.root, el, event);
  }
}
