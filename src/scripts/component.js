import { domWalk, isNode, closestDirective } from './dom';
import { debounce } from './timing';
import { makeObservable, RAW, toRaw } from './reactivity';
import { saferEval } from './eval';
import { createEvent, getNextModifier, isKeyModifier, matchesKeyModifiers } from './events';
import { getForData, createMagicVariables, withMagicVariables, splitMagicVariables } from './magic-variables';
import { getAttributes, parseAttribute, updateAttribute } from './attributes';
import { hydrateProps, generateExpressionForProp } from './props';
import { injectDataProviders, isDataProvider } from './data';
import { storage, isStorageModifier, getStorageType, computeExpires } from './storage';
import { getDirective } from './directives';
import { parseEachExpression } from './directives/u-each';
import { resolveMethods } from './methods';
import { isUnsafeKey, getNestedObjectValue, parsePropPath } from './object-path';

// Window/document/outside listeners and intersect observers hold their own reference to "el", so this shared observer runs each one's cleanup once "el" leaves the DOM.
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
   * Builds a component rooted at "el": reads its "u-data" expression and modifiers, builds the
   * initial reactive data (data providers, form field values, storage), and performs the first render.
   *
   * @param {HTMLElement} el - The element carrying the "u-data" attribute.
   */
  constructor(el) {
    let dataProviderContext = injectDataProviders(el);

    // Modifiers only ever live in the attribute's own name (e.g. "u-data.local"), never in its value, so find the entry by directive root instead of assuming it's literally named "u-data".
    const { expression, modifiers } = getAttributes(el).find(({ directive }) => directive === 'u-data') || { expression: '{}', modifiers: [] };

    // u-data="object as o" gives the whole data object a local alias
    const [, dataExpression, alias] = expression.trim().match(/^([\s\S]+?)\s+as\s+([A-Za-z_$][\w$]*)$/) || [];

    // The nearest ancestor "u-data" component, if any (already initialized — componentDiscover() walks the document in order); see the "scope" getter below.
    const parentEl = closestDirective(el.parentElement, 'u-data');

    this.root          = el;
    this.parent        = parentEl ? parentEl.__x : null;
    // Populated by every child as it's constructed (see the bottom of this constructor) — lets
    // refresh() cascade a change down to a descendant whose binding falls through to this
    // component's scope (see the "scope" getter) instead of owning the property itself.
    this.children      = [];
    this.parent?.children.push(this);
    this.name          = (dataExpression ?? expression).trim();
    this.alias         = alias || null;
    this.storageType   = isStorageModifier(modifiers) ? getStorageType(modifiers) : null;
    // A duration modifier (e.g. "u-data.cookie.30d") sits right after "cookie"/"local" in the modifier list, same convention as "u-prop"; omitting it means a session cookie or no expiration at all.
    this.storageExpire = this.storageType ? getNextModifier(modifiers, this.storageType) : null;

    this.rawData = saferEval(this.name || '{}', dataProviderContext);
    this.rawData = hydrateProps(el, this.rawData, this.parent, isDataProvider(this.name) ? this.name : null);

    // Rehydrate from whatever was persisted last time, on top of the fresh factory defaults, so new keys added later still show up for visitors with stale storage.
    if (this.storageType) {
      const saved = storage.get(`u-data:${this.name}`, this.storageType);
      if (saved) {
        try {
          const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;

          // Not Object.assign(): a JSON key literally named "__proto__" would, through its [[Set]] semantics, repoint this.rawData's own prototype instead of writing a plain "__proto__" data property.
          Object.keys(parsed).forEach(key => {
            if (!isUnsafeKey(key)) {
              this.rawData[key] = parsed[key];
            }
          });
        } catch (error) {}
      }
    }

    this.data = this.observeData(this.rawData);

    this.initialize(el);
  }

  /**
   * Writes the component's raw data to storage, if "u-data" carries a ".local"/".cookie"
   * modifier — a no-op otherwise. Called after every reactive write.
   */
  persist() {
    if (this.storageType) {
      storage.set(`u-data:${this.name}`, this.rawData, this.storageType, { path: '/', secure: true, expires: computeExpires(this.storageExpire) });
    }
  }

  /**
   * Alpine-style scope inheritance: this component's own data, falling back to the nearest
   * ancestor "u-data" component's scope for any name declared there but not here — every
   * read/write is attributed to whichever component actually owns the property.
   *
   * @returns {Object} "this.data" if there's no parent; otherwise a Proxy merging it with the parent's scope.
   */
  get scope() {
    if (!this.parent) {
      return this.data;
    }

    if (!this._scope) {
      const self = this;

      this._scope = new Proxy({}, {
        has: (_, prop) => prop in self.data || prop in self.parent.scope,
        get: (_, prop) => {
          if (prop === RAW) {
            return toRaw(self.data);
          }
          return (prop in self.data) ? self.data[prop] : self.parent.scope[prop];
        },
        set: (_, prop, value) => {
          if (prop in self.data || !(prop in self.parent.scope)) {
            self.data[prop] = value;
          } else {
            self.parent.scope[prop] = value;
          }
          return true;
        },
      });
    }

    return this._scope;
  }

  /**
   * Evaluates an expression (or calls a function) against the component's data, tracking
   * which top-level data properties were read via a dependency-tracking proxy.
   *
   * @param {string|Function} expressionOrFn - A JS expression string, or a function (e.g. a u-bind method) called with the proxy as "this".
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

        // Same exclusion as reactivity.js's own wrap(): a DOM node must come back raw, or identity checks against it (indexOf/includes/===, e.g. against "$el") always fail — every read would return a *new* wrapper, never equal to anything else, wrapped or not.
        if (typeof target[prop] === 'object' && target[prop] !== null && !isNode(target[prop])) {
          return makeProxy(target[prop]);
        }

        return target[prop];
      }
    });

    const proxiedData = makeProxy(this.scope);

    // Magic variables skip the tracking proxy since wrapping a DOM element would break native calls like $el.closest(); they're layered onto $data instead (see withMagicVariables).
    const { magicVariables, otherVariables } = splitMagicVariables(additionalHelperVariables);

    // "u-each" loop variables are passed to saferEval as separate parameters, so object-valued ones are wrapped the same way here or property reads on them go untracked.
    const trackedHelperVariables = Object.fromEntries(
      Object.entries(otherVariables).map(([key, value]) => [
        key, (typeof value === 'object' && value !== null && !isNode(value)) ? makeProxy(value) : value
      ])
    );

    const contextData = withMagicVariables(proxiedData, magicVariables);

    // A u-bind entry may hand back a method instead of an expression string — call it with "this" bound to the same context, so property access is tracked exactly like an expression string's.
    const output = typeof expressionOrFn === 'function'
      ? expressionOrFn.call(contextData)
      : saferEval(expressionOrFn, contextData, trackedHelperVariables);

    return { output, deps };
  }

  /**
   * Reads every directive/event/bind attribute off "el", expanding any "u-bind" entry into the
   * individual directive/event/bind entries its expression resolves to (e.g. u-bind="trigger"
   * referencing a Youla.data() factory's returned object).
   *
   * @param {HTMLElement} el - The element to read attributes from.
   * @returns {Array<Object>} The resolved list of attribute descriptors.
   */
  resolveAttributes(el) {
    const self = this;
    // Built lazily on first use since most elements carry no "u-bind" attribute, and building it calls every registered Youla.variable() factory — paying that cost per element, per domWalk pass, would be pure waste.
    let additionalHelperVariables;

    return getAttributes(el).flatMap(attribute => {
      if (attribute.directive !== 'u-bind') {
        return [attribute];
      }

      additionalHelperVariables ??= this.getHelperVariables(el);

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
          console.warn(`Youla.js: u-bind key "${name}" is an arrow function — arrow functions don't bind "this" to the component's data. Use a regular function or method shorthand instead: "${name}"() { ... }.`);
        }

        // A key with no u-/@/: prefix (e.g. "type") is a plain HTML attribute, written directly as markup.
        const isPlainAttribute = !parsed.directive && !parsed.event && !parsed.bind;

        // A "u-*" key that isn't a registered directive (e.g. "u-ref") is read straight off the element instead (see createRefsProxy), so write it as a real attribute since there's none to read yet.
        if (parsed.directive && !getDirective(parsed.directive)) {
          el.setAttribute(name, isFn ? value.call(self.scope) : value);
          return [];
        }

        return [{
          ...parsed,
          expression: value,
          bind: parsed.bind || isPlainAttribute,
          // Strings on a "u-*"/"@"/":" key are expressions (evaluated, reactive); functions are always computed; anything else is a one-time static value applied as-is.
          literal: !isFn && (isPlainAttribute || typeof value !== 'string')
        }];
      });
    });
  }

  /**
   * Wraps "data" in a Proxy that tracks writes: each "set" queues the property in "concernedData"
   * and triggers a refresh (plus persist); an array mutator instead forces every binding to
   * re-run, since its change (e.g. a "push") isn't one property name deps can match against.
   *
   * @param {Object} data - The raw data object to make observable.
   * @returns {Object} The observable (proxied) version of "data".
   */
  observeData(data) {
    this.concernedData = [];

    return makeObservable(data, (prop, force) => {
      // A directive can write reactive data as a side effect of its own first application during "initialize()" — harmless, since that single top-down pass hasn't reached dependents yet, so scheduling a refresh here would just re-run everything a second time for nothing.
      if (this._mounting) {
        return;
      }

      if (force) {
        this.refresh(true);
        this.persist();
        return;
      }

      if (!this.concernedData.includes(prop)) {
        this.concernedData.push(prop);
        this.refresh();
        this.persist();
      }
    });
  }

  /**
   * Resolves an attribute's output and (when "withDeps" is set) the deps it reads — the
   * "u-each"/"u-prop" special-casing shared by both "initialize()" and "refresh()".
   *
   * @param {Object} attribute - A parsed attribute descriptor, as returned by "resolveAttributes()".
   * @param {Object} additionalHelperVariables - Extra variables available to the expression (see "evaluate()").
   * @param {Object} [options]
   * @param {boolean} [options.withDeps] - When true, also resolves "u-each"'s deps from its raw expression (untracked by evaluate()).
   * @returns {{output: *, deps: string[]}} The resolved output, and (when requested) its tracked deps.
   */
  computeOutput(attribute, additionalHelperVariables, { withDeps = false } = {}) {
    const { directive, expression, literal } = attribute;
    let output = expression, deps = [];

    if (directive === 'u-each') {
      if (withDeps) {
        // "items" (e.g. "category.products") isn't evaluated here, so the best available dep is its own leading identifier; always returned as an array since callers call .some()/.includes() on it.
        const { items } = parseEachExpression(expression);
        const [rootIdentifier] = (items ?? '').match(/^[A-Za-z_$][\w$]*/) ?? [];

        deps = rootIdentifier ? [rootIdentifier] : [];
      }
    } else if (directive === 'u-prop') {
      // "expression" is a property path, not a JS expression, so it's read straight off "scope" (which falls through to an ancestor component) rather than evaluated generically.
      output = getNestedObjectValue(this.scope, expression);

      if (withDeps) {
        const [rootIdentifier] = parsePropPath(expression);
        deps = rootIdentifier ? [rootIdentifier] : [];
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
   * running directives once per element ("el.__x_initialized" guards re-entry, since a directive
   * that inserts child markup gets revisited within the same domWalk pass).
   *
   * @param {HTMLElement} root - The root element to walk and initialize.
   */
  initialize(root) {
    const self = this;

    // Suppresses the refresh a reactive write would otherwise schedule (see observeData()) while this mount pass is still applying every binding itself, once, in document order.
    this._mounting = true;

    try {
      domWalk(root, el => {
        if (el.__x_initialized) {
          return;
        }
        el.__x_initialized = true;

        const attributes = self.resolveAttributes(el);
        if (attributes.length === 0) {
          return;
        }

        // Skipped for the vast majority of elements, which carry no u-*/@/: attribute at all (same lazy cost as resolveAttributes()).
        const additionalHelperVariables = self.getHelperVariables(el);

        attributes.forEach(attribute => {
          let {directive, event, expression, modifiers, bind} = attribute;

          let propExpression;
          if (directive === 'u-prop') {
            propExpression = generateExpressionForProp(el, self.scope, attribute);

            // If the element we are binding to is a select, a radio, or checkbox we'll listen for the change event instead of the "input" event.
            event = ['select-multiple', 'select', 'checkbox', 'radio'].includes(el.type) || modifiers.includes('lazy')
              ? 'change'
              : 'input';
          }

          if (event) {
            // "u-prop"'s own modifiers (.number, .trim, .local, .cookie, .lazy) shape the bound value, not the event, so only forward modifiers for a real "@event" attribute.
            self.attachListener(el, event, directive === 'u-prop' ? [] : modifiers, propExpression || expression);
          }

          // Attribute binding ("bind") is a distinct mechanism from directives, resolved and dispatched the same way but never looked up in the directive registry; see ./attributes
          if (bind || getDirective(directive)) {
            const { output, deps } = self.computeOutput(attribute, additionalHelperVariables, { withDeps: true });

            // Seeds refresh()'s own "el.__x_deps" cache so the first change-triggered refresh already knows this attribute's real deps instead of treating it as unconditionally due for a re-run.
            el.__x_deps ??= {};
            el.__x_deps[attribute.name] = deps;

            self.applyAttribute(el, attribute, output, additionalHelperVariables);
          }
        });
      });
    } finally {
      this._mounting = false;
    }
  }

  /**
   * Re-evaluates every element's bindings, re-running only those whose deps changed since the
   * last flush; clears "concernedData" once the pass completes.
   *
   * @param {boolean|HTMLElement} [force] - `true` re-runs every binding in this component; an `HTMLElement` re-runs only that element's own bindings.
   */
  refresh(force = false) {
    const self = this;

    if (force instanceof HTMLElement) {
      this.pendingForceElements ??= new Set();
      this.pendingForceElements.add(force);
    } else {
      // OR'd across calls before the debounced flush runs, so a forced call is never lost to a later plain one.
      this.pendingForceRefresh = this.pendingForceRefresh || force;
    }

    // Built once and reused, not recreated per call — otherwise each write in a fast burst (e.g. a dragged slider) would queue its own full domWalk instead of coalescing.
    this.scheduleRefresh ??= debounce(() => {
      const force         = self.pendingForceRefresh;
      const forceElements = self.pendingForceElements;
      self.pendingForceRefresh   = false;
      self.pendingForceElements = null;

      self.flush(force, forceElements);
    }, 0);

    this.scheduleRefresh();
  }

  /**
   * Does the actual work of "refresh()": walks this component's own subtree applying whatever
   * bindings are due, then cascades down to every nested "u-data" child so a binding there that
   * falls through to this component's own scope (see the "scope" getter) doesn't go stale.
   * Cascading calls this directly rather than "child.refresh()" so a change reaches every
   * descendant within the same flush, however deep the nesting — going through "refresh()" again
   * would chain one extra debounced tick per level.
   *
   * @param {boolean} force - Re-runs every binding, in this component and every descendant, regardless of "concernedData".
   * @param {Set<HTMLElement>} [forceElements] - Elements (in this component only) to re-run regardless of "concernedData".
   */
  flush(force, forceElements) {
    const self = this;

    domWalk(self.root, el => {
      const attributes = self.resolveAttributes(el);
      if (attributes.length === 0) {
        return;
      }

      const elementForced = force || !!forceElements?.has(el);

      // An element inside a "u-each" clone only carries its loop variables on "__x_for_data", so resolve them here too or bindings referencing them stop updating after the first render.
      // Skipped for the vast majority of elements, which carry no u-*/@/: attribute at all (same lazy cost as resolveAttributes()).
      const additionalHelperVariables = self.getHelperVariables(el);

      attributes.forEach(attribute => {
        const { directive, bind, name } = attribute;

        if (bind || getDirective(directive)) {
          // u-prop's tracked dep is only its root identifier, but a write reports the leaf prop — possibly to an ancestor's concernedData via scope — so u-prop always re-syncs on any refresh instead of being gated by "concernedData".
          const alwaysSync = directive === 'u-prop';

          // Keyed per element/attribute so unrelated bindings can skip computeOutput() entirely — evaluate() runs the expression for real, so a binding with a side effect would otherwise re-run on every refresh regardless of whether its output changes.
          el.__x_deps ??= {};
          const previousDeps = el.__x_deps[name];

          if (!elementForced && !alwaysSync && previousDeps && !previousDeps.some(dep => self.concernedData.includes(dep))) {
            return;
          }

          const { output, deps } = self.computeOutput(attribute, additionalHelperVariables, { withDeps: true });
          el.__x_deps[name] = deps;

          if (elementForced || alwaysSync || !previousDeps || self.concernedData.some(dep => deps.includes(dep))) {
            self.applyAttribute(el, attribute, output, additionalHelperVariables);
          }
        }
      });
    });

    // A nested "u-data" child's binding can fall through to this component's own scope (see the
    // "scope" getter) instead of owning the property itself — domWalk() above never reaches into
    // it (it stops at the child's own boundary) and the child's own gating reads its own
    // "concernedData", which this component's write never touched. Without cascading, such a
    // binding would apply once at mount and then never again. Forwarding "concernedData" (rather
    // than forcing) lets each child keep gating its own bindings normally; a child that happens to
    // own a same-named local property just runs one harmless extra check.
    self.children = self.children.filter(child => child.root.isConnected);

    if (force) {
      self.children.forEach(child => child.flush(true));
    } else if (self.concernedData.length > 0) {
      self.children.forEach(child => {
        self.concernedData.forEach(prop => {
          if (!child.concernedData.includes(prop)) {
            child.concernedData.push(prop);
          }
        });
        child.flush(false);
      });
    }

    self.concernedData = [];
  }

  /**
   * Builds and attaches a DOM listener for "@event" (or u-prop's synthetic event), applying its
   * modifiers (retargeting, passive/capture, delay, prevent, stop, outside, key filters, once,
   * load/intersect).
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

    // "el"'s own document/window, not this script's — matters inside a same-origin iframe with its own document, where a keydown on it must not bubble out to the parent's window instead.
    if (modifiers.includes('window')) {
      target = el.ownerDocument.defaultView;
    }

    if (modifiers.includes('document')) {
      target = el.ownerDocument;
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
      target = el.ownerDocument;

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
   * any enclosing "u-each" loop variables available to it.
   *
   * @param {string|Function} expressionOrFn - The handler to run.
   * @param {Event} e - The DOM event that triggered the handler.
   * @param {HTMLElement} target - The element the listener is attached to.
   */
  invokeListener(expressionOrFn, e, target) {
    const contextData = withMagicVariables(this.scope, this.getMagicVariables(target, e));

    // A u-bind entry may hand back a method instead of an expression string — call it directly with "this" as the component's reactive data, so writes to it still trigger refresh().
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
   * Returns the component's local data alias (from `u-data="expr as alias"`), if any — keyed
   * like a "u-each" loop variable so it's tracked for reactivity, unlike magic variables like "$el".
   *
   * @returns {object} "{ [alias]: this.data }", or "{}" when "u-data" carries no alias.
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

  /**
   * Builds the full helper-variable bag for evaluating an attribute/directive on "el": an
   * enclosing "u-each" clone's loop variables, this component's own data alias, and the magic
   * variables (see "getMagicVariables()"). Shared by resolveAttributes(), initialize() and
   * flush() — every site that evaluates an element's own attributes needs the same bag.
   *
   * @param {HTMLElement} el - The element the expression is being evaluated for/against.
   * @returns {object} The merged helper variables.
   */
  getHelperVariables(el) {
    return {...getForData(el), ...this.getAliasVariables(), ...this.getMagicVariables(el)};
  }
}
