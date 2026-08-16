import { domWalk, debounce, getAttributes, getForData, parseAttribute, saferEval, eventCreate, getNextModifier, isKeyModifier, matchesKeyModifiers } from './helpers';
import { updateAttribute } from './attributes';
import { fetchProp, generateExpressionForProp } from './props';
import { injectDataProviders } from './data';
import { storage, isStorageModifier, getStorageType, computeExpires } from './storage';

/**
 * Determines whether a function is an arrow function, by inspecting its source
 * text rather than its shape — arrow functions and method shorthand both lack a
 * "prototype", so that alone can't tell them apart. An arrow's "=>" sits before
 * its body's opening "{" (or there's no "{" at all, for a concise body); a
 * function/method declaration never has "=>" in that position.
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
   * Builds a component rooted at "el": reads its "v-data" expression and
   * modifiers, evaluates the initial reactive data (merging in registered data
   * providers and current form field values), rehydrates it from storage if
   * ".local"/".cookie" was used, wraps it in an observable proxy, and performs
   * the first render.
   *
   * @param {HTMLElement} el - The element carrying the "v-data" attribute.
   */
  constructor(el) {
    let dataProviderContext = injectDataProviders();

    // Modifiers can only live in the attribute's own name ("v-data.local",
    // "v-data.cookie"), never in its value, so find the entry by directive
    // root rather than assuming the attribute is literally named "v-data".
    const { expression, modifiers } = getAttributes(el).find(({ directive }) => directive === 'v-data') || { expression: '{}', modifiers: [] };

    this.root          = el;
    this.name          = expression.trim();
    this.storageType   = isStorageModifier(modifiers) ? getStorageType(modifiers) : null;
    // A duration modifier (e.g. "v-data.cookie.30d") sits right after "cookie"/"local" in the
    // modifier list — same convention as "v-prop". Omitting it means a session cookie (or, for
    // localStorage, no expiration at all), same as writing no duration on "v-prop".
    this.storageExpire = this.storageType ? getNextModifier(modifiers, this.storageType) : null;

    this.rawData = saferEval(expression || '{}', dataProviderContext);
    this.rawData = fetchProp(el, this.rawData);

    // Rehydrate from whatever was persisted last time, on top of the fresh
    // defaults the factory just produced — so new keys added to the factory
    // later still show up for visitors with stale storage, and methods
    // (which never survive JSON) are left alone by Object.assign since they
    // simply aren't present on the parsed side.
    if (this.storageType) {
      const saved = storage.get(`v-data:${this.name}`, this.storageType);
      if (saved) {
        try {
          Object.assign(this.rawData, typeof saved === 'string' ? JSON.parse(saved) : saved);
        } catch (error) {}
      }
    }

    this.data = this.wrapDataInObservable(this.rawData);

    this.initialize(el);
  }

  /**
   * Writes the component's raw data back to storage, if "v-data" carries a
   * ".local"/".cookie" modifier — a no-op otherwise. Called after every
   * reactive write, so persisted state always matches what's currently rendered.
   */
  persist() {
    if (this.storageType) {
      storage.set(`v-data:${this.name}`, this.rawData, this.storageType, { path: '/', secure: true, expires: computeExpires(this.storageExpire) });
    }
  }

  /**
   * Evaluates an expression (or calls a function) against the component's
   * data, tracking which top-level data properties were actually read along
   * the way via a dependency-tracking proxy — so refresh() can later tell
   * whether this exact binding needs to re-run after a given property changes.
   *
   * @param {string|Function} expressionOrFn - A JS expression string, or a
   *   function (e.g. a "v-bind" entry given as a method) to call with the
   *   proxy as "this".
   * @param {Object} [additionalHelperVariables] - Extra variables available to
   *   the expression (e.g. "v-each" loop variables) alongside the component's
   *   data.
   * @returns {{output: *, deps: string[]}} The evaluated result and the list
   *   of property names it read.
   */
  evaluate(expressionOrFn, additionalHelperVariables) {
    let deps = [];

    const makeProxy = (data) => new Proxy(data, {
      get(target, prop) {
        deps.push(prop);

        if (typeof target[prop] === 'object' && target[prop] !== null) {
          return makeProxy(target[prop]);
        }

        return target[prop];
      }
    });

    const proxiedData = makeProxy(this.data);

    // "v-each" loop variables ("task", "index") are handed to saferEval as
    // separate function parameters, not as properties of $data — so reading
    // "task.checked" would never touch the tracking proxy above and "deps"
    // would stay empty, making the binding look unrelated to every future
    // data change. Wrap object-valued helper variables the same way so
    // property reads on loop items are tracked too.
    const trackedHelperVariables = additionalHelperVariables && Object.fromEntries(
      Object.entries(additionalHelperVariables).map(([key, value]) => [
        key, (typeof value === 'object' && value !== null) ? makeProxy(value) : value
      ])
    );

    // A v-bind entry may hand back a method instead of an expression string
    // (e.g. "v-show"() { return this.open }) — call it with the same
    // dependency-tracking proxy as "this", so property access is tracked
    // exactly like accessing $data inside a plain expression string.
    const output = typeof expressionOrFn === 'function'
      ? expressionOrFn.call(proxiedData)
      : saferEval(expressionOrFn, proxiedData, trackedHelperVariables);

    return { output, deps };
  }

  /**
   * Reads every directive/event/bind attribute off "el", expanding any
   * "v-bind" entry into the individual directive/event/bind entries its
   * expression resolves to — so initialize() and refresh() dispatch a
   * "v-bind" exactly as if its entries had been written directly in the
   * markup, through the same logic. The expression is just a normal v-data
   * property (e.g. v-bind="trigger" referencing "trigger" from
   * Youla.data('dropdown', () => ({ trigger: {...} }))), resolved the same
   * way any other expression reads from the component's data — no separate
   * registry involved. "additionalHelperVariables" is derived here from the
   * element itself (see getForData) rather than threaded in from the caller,
   * so every caller automatically gets the right "v-each" loop scope.
   *
   * @param {HTMLElement} el - The element to read attributes from.
   * @returns {Array<Object>} The resolved list of attribute descriptors.
   */
  resolveAttributes(el) {
    const self = this;
    const additionalHelperVariables = getForData(el);

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

        // Arrow functions ignore .call()/.apply() — "this" stays whatever it
        // was lexically where the arrow was written, never the component's
        // data. That fails silently (a thrown TypeError inside a try/catch
        // elsewhere, or a truthy "output" from the unset function). Regular
        // functions and method shorthand ("key"() {...}) both lack a
        // "prototype" too, so that can't tell them apart. Their source text
        // can: an arrow's "=>" appears before its body's opening "{" (or
        // there's no "{" at all, for a concise body); a function/method
        // never has "=>" in that position.
        if (isFn && isArrowFunction(value)) {
          console.warn(`Youla.js: v-bind key "${name}" is an arrow function — arrow functions don't bind "this" to the component's data. Use a regular function or method shorthand instead: "${name}"() { ... }.`);
        }

        // A key with no v-/@/: prefix (e.g. "type") is a plain HTML attribute,
        // exactly like writing it directly in markup.
        const isPlainAttribute = !parsed.directive && !parsed.event && !parsed.bind;

        // A "v-*" key that isn't a registered directive (e.g. "v-ref") is
        // never dispatched by initialize()/refresh() either — it's read
        // straight off the element instead (see getRefsProxy). Since there's
        // no real DOM attribute to read here, write one so it still works.
        if (parsed.directive && !(parsed.directive in Youla.directives)) {
          el.setAttribute(name, isFn ? value.call(self.data) : value);
          return [];
        }

        return [{
          ...parsed,
          expression: value,
          bind: parsed.bind || isPlainAttribute,
          // Strings on a "v-*"/"@"/":" key are expressions (evaluated, reactive).
          // Functions are always computed (called, reactive). Anything else —
          // including a plain string on a bare key like "type": "button" — is a
          // one-time static value, applied as-is without ever reaching saferEval.
          literal: !isFn && (isPlainAttribute || typeof value !== 'string')
        }];
      });
    });
  }

  /**
   * Wraps a plain data object (and, recursively, any nested object it
   * contains) in a Proxy that tracks writes: each successful "set" queues the
   * changed property in "concernedData" and triggers a refresh (plus a
   * persist, if storage is enabled) — turning plain property assignment into
   * reactivity.
   *
   * @param {Object} data - The raw data object to make observable.
   * @returns {Object} The observable (proxied) version of "data".
   */
  wrapDataInObservable(data) {
    this.concernedData = [];

    const makeObservable = (obj) => {
      if (obj !== null && typeof obj === 'object') {
        return new Proxy(obj, {
          set: (target, prop, value) => {
            if (typeof value === 'object' && value !== null) {
              value = makeObservable(value);
            }

            if (Reflect.set(target, prop, value) && !this.concernedData.includes(prop)) {
              this.concernedData.push(prop);
              this.refresh();
              this.persist();
            }

            return true;
          },
          get: (target, prop) => {
            const value = target[prop];
            if (typeof value === 'object' && value !== null) {
              return makeObservable(value);
            }
            return value;
          }
        });
      }
      return obj;
    };

    return makeObservable(data);
  }

  /**
   * Performs the component's first render: walks the DOM from "root", and for
   * every element registers its event listeners and runs its directives (or
   * updates its bound attribute) against the freshly evaluated data.
   *
   * @param {HTMLElement} root - The root element to walk and initialize.
   */
  initialize(root) {
    const self = this;

    domWalk(root, el => {
      const additionalHelperVariables = getForData(el);

      self.resolveAttributes(el).forEach(attribute => {
        let {directive, event, expression, modifiers, bind, literal} = attribute;

        // init events
        let propExpression;
        if (directive === 'v-prop') {
          propExpression = generateExpressionForProp(el, self.data, attribute);

          // If the element we are binding to is a select, a radio, or checkbox we'll listen for the change event instead of the "input" event.
          event = ['select-multiple', 'select', 'checkbox', 'radio'].includes(el.type) || modifiers.includes('lazy')
            ? 'change'
            : 'input';
        }

        if (event) {
          // "v-prop"'s own modifiers (.number, .trim, .local, .cookie, .lazy)
          // shape the bound value, not the event — they mean nothing to
          // registerListener (and matching them as key filters would block
          // "input"/"change", which never carry an "event.key" at all), so
          // only forward modifiers for a real "@event" attribute.
          self.registerListener(el, event, directive === 'v-prop' ? [] : modifiers, propExpression || expression);
        }

        // init directives — attribute binding ("bind") is a distinct mechanism from
        // directives, so it's resolved and dispatched the same way but never looked
        // up in Youla.directives; see ./attributes
        if (bind || directive in Youla.directives) {
          let output = expression;
          if (!literal && directive !== 'v-each') {
            try {
              ({ output } = self.evaluate(expression, additionalHelperVariables));
            } catch (error) {}
          }

          if (bind) {
            updateAttribute(el, attribute.name.replace(':', ''), output);
          } else {
            Youla.directives[directive](el, output, attribute, self, additionalHelperVariables);
          }
        }
      });
    });
  }

  /**
   * Re-evaluates every element's bindings and re-runs only those whose
   * dependencies actually changed since the last flush — everything else is
   * left untouched. Clears "concernedData" once the pass completes.
   */
  refresh() {
    const self = this;

    // Debounced (and deferred with a 0ms delay) so several data writes in the
    // same tick collapse into a single re-render, instead of walking the DOM
    // once per write.
    debounce(() => {
      domWalk(self.root, el => {
        // An element rendered inside a "v-each" clone only carries its loop
        // variables ("task"/"index") on "__x_for_data" of the clone root
        // (see ./directives/v-each) — without resolving them here too,
        // bindings referencing them (":class", "v-text", ...) throw on every
        // refresh and silently stop updating after the first render.
        const additionalHelperVariables = getForData(el);

        self.resolveAttributes(el).forEach(attribute => {
          let {directive, expression, bind, literal} = attribute;

          if (bind || directive in Youla.directives) {
            let output = expression, deps = [];
            if (directive === 'v-each') {
              [, deps] = expression.split(' in ');
            } else if (!literal) {
              try {
                ({ output, deps } = self.evaluate(expression, additionalHelperVariables));
              } catch (error) {}
            }

            if (self.concernedData.filter(i => deps.includes(i)).length > 0) {
              if (bind) {
                updateAttribute(el, attribute.name.replace(':', ''), output);
              } else {
                Youla.directives[directive](el, output, attribute, self, additionalHelperVariables);
              }
            }
          }
        });
      });

      self.concernedData = [];
    }, 0)()
  }

  /**
   * Builds and attaches a DOM event listener for "@event" (or the synthetic
   * event behind "v-prop"), wiring up whichever modifiers were used:
   * retargeting to "window"/"document", "passive"/"capture" options, "delay",
   * "prevent", "stop", "outside", key/system-key filters, "once", and the
   * special "load"/"intersect" events.
   *
   * @param {HTMLElement} el - The element the listener conceptually belongs to.
   * @param {string} event - The event name to listen for (e.g. "click", "load", "intersect").
   * @param {string[]} modifiers - The attribute's modifiers, driving the behavior above.
   * @param {string|Function} expression - The expression or function to run when the event fires.
   */
  registerListener(el, event, modifiers, expression) {
    // Lets each modifier below wrap the handler in its own middleware, in any
    // combination, without the branches needing to know about each other.
    const wrapHandler = (callback, wrapper) => e => wrapper(callback, e);

    let target  = el;
    let options = {};
    let handler = e => this.runListenerHandler(expression, e, el);

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

    // delay an event for a certain time
    if (modifiers.includes('delay')) {
      handler = debounce(handler, Number(getNextModifier(modifiers, 'delay').split('ms')[0]) || 250);
    }

    if (modifiers.includes('prevent')) {
      handler = wrapHandler(handler, (next, e) => { e.preventDefault(); next(e); });
    }

    // stopping event propagation in DOM.
    if (modifiers.includes('stop')) {
      handler = wrapHandler(handler, (next, e) => { e.stopPropagation(); next(e); });
    }

    // event outside of element
    if (modifiers.includes('outside')) {
      target = document;

      handler = wrapHandler(handler, (next, e) => {
        // Don't do anything if the click came form the element or within it.
        if (el.contains(e.target)) {
          return;
        }

        // Don't do anything if this element isn't currently visible.
        if (el.offsetWidth < 1 && el.offsetHeight < 1) {
          return;
        }

        if (e.target.isConnected === false) {
          return;
        }

        next(e);
      });
    }

    // key/system-modifier filter — e.g. "@keydown.enter" or "@keyup.ctrl.s"
    // only runs the handler when the fired event actually matches. Must be
    // the outermost wrap so a mismatched key skips prevent/stop/delay too.
    if (modifiers.some(isKeyModifier)) {
      handler = wrapHandler(handler, (next, e) => matchesKeyModifiers(e, modifiers) && next(e));
    }

    // one time run event
    if (modifiers.includes('once')) {
      options.once = true;
    }

    if (event === 'load') {
      handler(eventCreate(event,{}));
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
    }

    target.addEventListener(event, handler, options);
  }

  /**
   * Runs an event handler: a function is called directly with the
   * component's data as "this" (so writes to it trigger reactivity the same
   * way a plain expression's writes would); a string expression is evaluated
   * with the usual "$el"/"$event"/"$refs"/"$root", every registered method,
   * and any enclosing "v-each" loop variables available to it.
   *
   * @param {string|Function} expressionOrFn - The handler to run.
   * @param {Event} e - The DOM event that triggered the handler.
   * @param {HTMLElement} target - The element the listener is attached to.
   */
  runListenerHandler(expressionOrFn, e, target) {
    // A v-bind entry may hand back a method instead of an expression string
    // (e.g. "@click"() { this.open = true }) — call it directly, with "this"
    // as the component's reactive data, so writes to it trigger refresh() the
    // same way "this.open = true" inside a saferEval'd expression would.
    if (typeof expressionOrFn === 'function') {
      expressionOrFn.call(this.data, e);
      return;
    }

    const expression = expressionOrFn;
    const methods = {};
    Object.keys(Youla.methods).forEach(key => {
      methods[key] = Youla.methods[key](e, target, this);
    });

    const data = getForData(target);

    saferEval(expression, this.data, {
      '$el': target,
      '$event': e,
      '$refs': this.getRefsProxy(),
      '$root': this.root,
      ...methods,
      ...data
    }, true);
  }

  /**
   * Returns a Proxy standing in for "$refs": rather than caching elements up
   * front, each property access walks the DOM on demand to find the element
   * carrying a matching "v-ref" attribute, so it stays correct even if the
   * DOM changes from outside the framework.
   *
   * @returns {Proxy} An object whose properties resolve to "v-ref" elements.
   */
  getRefsProxy() {
    let self = this

    return new Proxy({}, {
      get(object, property) {
        let ref

        // domWalk instead of querySelector, since querySelector can't easily
        // exclude "v-ref" elements belonging to a nested component.
        domWalk(self.root, el => (el.getAttribute('v-ref') === property ? (ref = el) : null));

        return ref
      }
    })
  }
}
