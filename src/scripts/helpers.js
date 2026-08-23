/**
 * Waits for the DOM to finish parsing.
 *
 * @returns {Promise<void>} Resolves once the document is ready.
 */
export function domReady() {
  return new Promise(resolve => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve)
    } else {
      resolve()
    }
  })
}

/**
 * Checks whether an element carries a directive, matching by base name so any modifiers
 * on it (e.g. "v-data.local") are ignored.
 *
 * @param {Element} el - The element to check.
 * @param {string} name - The directive's base name, e.g. "v-data".
 * @returns {boolean} True if the element has this directive, with or without modifiers.
 */
export function hasDirective(el, name) {
  return [...el.attributes].some(({ name: attrName }) => attrName === name || attrName.startsWith(`${name}.`));
}

/**
 * Finds the nearest element, starting at "el" itself, that carries the given directive.
 *
 * @param {Element} el - The element to start searching from.
 * @param {string} name - The directive's base name, e.g. "v-data".
 * @returns {Element|null} The matching element, or null if none is found.
 */
export function closestDirective(el, name) {
  while (el && !hasDirective(el, name)) {
    el = el.parentElement;
  }
  return el;
}

/**
 * Walks the DOM tree rooted at "el" depth-first, invoking "callback" for "el" itself and every
 * descendant. Stops at a nested "v-data" component's boundary, and treats a "v-each" template
 * element as a leaf rather than walking into its unrendered children.
 *
 * @param {Element} el - The root element to start walking from.
 * @param {Function} callback - Invoked once for "el" and for each element visited under it.
 * @returns {void}
 */
export function domWalk(el, callback) {
  callback(el);

  let node = el.firstElementChild;

  while (node) {
    if (hasDirective(node, 'v-data')) {
      return;
    }

    // "v-each" elements are templates: the directive itself clones and walks
    // each rendered item, so descending into the raw template here would
    // evaluate its children (and any nested "v-each") without loop scope.
    if (node.hasAttribute('v-each')) {
      callback(node);
    } else {
      domWalk(node, callback);
    }

    node = node.nextElementSibling;
  }
}

/**
 * Creates a debounced function that delays invoking "callback" until "wait" ms have passed
 * since the last call.
 *
 * @param {Function} callback - The function to be debounced.
 * @param {number} wait - The delay in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounce(callback, wait) {
  let timeout;

  return function (...args) {
    clearTimeout(timeout);

    timeout = setTimeout(() => callback.apply(this, args), wait);
  }
}

/**
 * Repeatedly invokes "callback" at the given interval, optionally once immediately first.
 *
 * @param {Function} callback - The function to be executed repeatedly.
 * @param {number} wait - The time interval in milliseconds between each call.
 * @param {boolean} immediate - If true, calls "callback" once before the interval starts.
 * @returns {number} A timer ID that can be used with clearInterval to stop the execution.
 */
export function pulsate(callback, wait, immediate = false) {
  immediate && callback();

  return setInterval(callback, wait);
}

/**
 * Walks up from "el" to the nearest ancestor (or itself) carrying loop variables from an
 * enclosing "v-each" clone (see "__x_for_data" in ./directives/v-each).
 *
 * @param {Element} el - The element to start searching from.
 * @returns {object|undefined} The loop variables stored on the nearest "v-each" clone, if any.
 */
export function getForData(el) {
  let data;
  while (el && !(data = el.__x_for_data)) {
    el = el.parentElement;
  }
  return data;
}

/**
 * Creates a Proxy standing in for "$refs": each property access walks the DOM to find the
 * element carrying a matching "v-ref" attribute.
 *
 * @param {HTMLElement} root - The component's root element ("v-data"), to scope the walk to.
 * @returns {Proxy} An object whose properties resolve to "v-ref" elements.
 */
export function createRefsProxy(root) {
  return new Proxy({}, {
    get(object, property) {
      let ref;

      // domWalk instead of querySelector, since querySelector can't easily
      // exclude "v-ref" elements belonging to a nested component.
      domWalk(root, el => (el.getAttribute('v-ref') === property ? (ref = el) : null));

      return ref;
    }
  });
}

/**
 * Builds the "$el"/"$event"/"$refs"/"$root" magic variables, keyed the way saferEval expects
 * for "additionalHelperVariables" — plus one entry per custom variable registered via
 * "Youla.variable()", each recomputed by calling its factory with the same "root"/"el"/"event".
 *
 * @param {HTMLElement} root - The component's root element ("v-data"), used for "$root" and to scope "$refs".
 * @param {HTMLElement} el - The element the expression is being evaluated for/against; becomes "$el".
 * @param {Event} [event] - The triggering DOM event, if any; becomes "$event" (undefined otherwise).
 * @returns {object} The magic variables, ready to merge into "additionalHelperVariables".
 */
export function createMagicVariables(root, el, event) {
  const custom = {};

  Object.entries(Youla.variables).forEach(([name, callback]) => {
    custom[name] = callback(root, el, event);
  });

  // Spread first so a built-in name can never be shadowed by a custom
  // variable — "Youla.variable()" already refuses to register one of these,
  // but this keeps the guarantee even if "Youla.variables" is poked directly.
  return {
    ...custom,
    '$el': el,
    '$event': event,
    '$refs': createRefsProxy(root),
    '$root': root
  };
}

/**
 * Wraps "dataContext" in a Proxy that resolves the magic variables before falling through to
 * the real data — so they're reachable both as bare identifiers in an expression (via
 * "with($data)") and as "this.$refs" etc. inside any method called from it. Writes to a magic
 * key are accepted but discarded, so a method never mutates the real data by accident.
 *
 * @param {object} dataContext - The data object (or Proxy) to wrap.
 * @param {object} magicVariables - The magic variables to expose, as built by createMagicVariables().
 * @returns {Proxy} The wrapped context, safe to pass as "$data" to saferEval.
 */
export function withMagicVariables(dataContext, magicVariables) {
  return new Proxy(dataContext, {
    get: (target, prop) => prop in magicVariables ? magicVariables[prop] : target[prop],
    has: (target, prop) => prop in magicVariables || prop in target,
    set: (target, prop, value) => prop in magicVariables ? true : Reflect.set(target, prop, value)
  });
}

/**
 * Splits a merged helper-variables bag into its magic variables (anything with a "$" prefix)
 * and everything else (e.g. "v-each" loop variables).
 *
 * @param {object} [helperVariables] - The merged bag, as built at each Component evaluation call site.
 * @returns {{magicVariables: object, otherVariables: object}}
 */
export function splitMagicVariables(helperVariables = {}) {
  const magicVariables = {}, otherVariables = {};

  Object.entries(helperVariables).forEach(([key, value]) => {
    (key[0] === '$' ? magicVariables : otherVariables)[key] = value;
  });

  return { magicVariables, otherVariables };
}

/**
 * Evaluates a JavaScript expression (or runs a statement, if "noReturn" is set) against a data
 * context — every property of "dataContext" is reachable in the expression by name via "with",
 * and any extra helper variables (e.g. "$event", "$el") are exposed as real function parameters.
 *
 * @param {string} expression - The expression (or, if "noReturn" is true, statement) to evaluate.
 * @param {object} dataContext - The component's reactive data, made available as bare identifiers.
 * @param {object} [additionalHelperVariables] - Extra named values (e.g. "$el", "$event") exposed to the expression.
 * @param {boolean} [noReturn] - When true, runs "expression" as a statement instead of evaluating and returning it.
 * @returns {*} The expression's value, or undefined when "noReturn" is true.
 */
export function saferEval(expression, dataContext, additionalHelperVariables = {}, noReturn = false) {
  expression = noReturn ? `with($data){${expression}}` : `var result; with($data){result=${expression}}; return result`;

  return (new Function(['$data', ...Object.keys(additionalHelperVariables)], expression))(
    dataContext, ...Object.values(additionalHelperVariables)
  )
}

const ATTRIBUTE_PREFIX = /^(v-|@|:)/;

// Matches a bare "<number><unit>" modifier, e.g. ".500ms" or ".30d" — a quantity
// given directly as a modifier, without a preceding keyword like ".delay.". Whole
// numbers only: a decimal point would itself split into a separate modifier.
const DURATION_MODIFIER = /^(\d+)([a-z]+)$/;

/**
 * Classifies a single name/value pair into the shape Component dispatches on. Used both for
 * real DOM attributes and for a "v-bind" object's entries.
 *
 * @param {string} name - The raw attribute or object key, e.g. "v-each.lazy", "@click.prevent", ":class".
 * @param {*} value - The attribute's string value, or (for v-bind entries) any JS value.
 * @returns {{name: string, bind: boolean, directive: string, event: string, expression: *, modifiers: string[], duration: {value: number, unit: string}|null, literal: boolean}} The parsed attribute descriptor.
 */
export function parseAttribute(name, value) {
  const startsWith = (name.match(ATTRIBUTE_PREFIX) || [''])[0];
  const root       = name.replace(startsWith, '');
  const parts      = root.split('.');
  const modifiers  = root.split('.').slice(1);
  const durationMatch = modifiers.map(m => m.match(DURATION_MODIFIER)).find(Boolean);

  return {
    name,
    // Attribute binding (":attr") is core syntax, not a pluggable directive,
    // so it gets its own flag rather than being reported as a directive. See ./attributes.
    bind: startsWith === ':',
    directive: startsWith === 'v-' ? name.split('.')[0] : '',
    event: startsWith === '@' ? parts[0] : '',
    expression: value,
    modifiers,
    duration: durationMatch ? { value: Number(durationMatch[1]), unit: durationMatch[2] } : null,
    // A v-bind entry whose value isn't a string (e.g. `disabled: true`) is
    // already a final value, not an expression to run through saferEval.
    literal: typeof value !== 'string'
  }
}

/**
 * Collects every directive/event/binding attribute on an element (":attr", "@event", "v-*"),
 * already parsed via parseAttribute().
 *
 * @param {Element} el - The element to read attributes from.
 * @returns {object[]} The parsed attribute descriptors, in DOM attribute order.
 */
export function getAttributes(el) {
  return [...el.attributes]
    .filter(({ name }) => ATTRIBUTE_PREFIX.test(name))
    .map(({ name, value }) => parseAttribute(name, value));
}

/**
 * Creates a bubbling, cancelable CustomEvent, pre-configured to pass through shadow DOM boundaries.
 *
 * @param {string} eventName - The event's type/name.
 * @param {object} [detail] - Data exposed on the event's "detail" property.
 * @returns {CustomEvent} The created event, ready to dispatch.
 */
export function eventCreate(eventName, detail = {}) {
  return new CustomEvent(eventName, {
    detail,
    bubbles: true,
    // Allows events to pass the shadow DOM barrier.
    composed: true,
    cancelable: true,
  })
}

/**
 * Reads the modifier that immediately follows a given one — used for modifiers that take an
 * argument via the next segment (e.g. the "250ms" in ".delay.250ms").
 *
 * @param {string[]} modifiers - The attribute's modifier list.
 * @param {string} modifierAfter - The modifier whose following value should be read.
 * @param {string} [defaultValue] - Returned when "modifierAfter" isn't present, or has nothing after it.
 * @returns {string} The modifier found right after "modifierAfter", or "defaultValue".
 */
export function getNextModifier(modifiers, modifierAfter, defaultValue = '') {
  return modifiers[modifiers.indexOf(modifierAfter) + 1] || defaultValue;
}

// Key names/combos for filtering "$event.key" via modifiers, e.g. "@keydown.enter" or "@keyup.ctrl.s".
const KEY_ALIASES = {
  enter: 'Enter', esc: 'Escape', escape: 'Escape', tab: 'Tab', space: ' ',
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  delete: 'Delete', backspace: 'Backspace',
};

const SYSTEM_MODIFIER_KEYS = { ctrl: 'ctrlKey', alt: 'altKey', shift: 'shiftKey', meta: 'metaKey' };

// Behavior modifiers Component#registerListener gives dedicated handling to — anything
// else on a "@keydown.enter"-style attribute is treated as a key filter instead.
const BEHAVIOR_MODIFIERS = new Set(['window', 'document', 'passive', 'capture', 'delay', 'prevent', 'stop', 'outside', 'once']);

/**
 * Checks whether a modifier is a key filter (e.g. "enter", "ctrl", "s") rather than one of
 * Component#registerListener's own behavior modifiers (".prevent", ".delay.250ms", etc.).
 *
 * @param {string} modifier - A single modifier segment.
 * @returns {boolean} True if the modifier should be treated as a key filter.
 */
export function isKeyModifier(modifier) {
  return !BEHAVIOR_MODIFIERS.has(modifier) && !/^\d+m?s$/.test(modifier);
}

/**
 * Checks a fired event against an attribute's key/system modifiers (e.g. ".enter", ".ctrl.s").
 *
 * @param {KeyboardEvent} e - The event to check.
 * @param {string[]} modifiers - The attribute's full modifier list.
 * @returns {boolean} True if the element has no key filter at all, or "e" matches every one it has.
 */
export function matchesKeyModifiers(e, modifiers) {
  const keyModifiers = modifiers.filter(isKeyModifier);

  return keyModifiers.every(modifier => {
    if (modifier in SYSTEM_MODIFIER_KEYS) {
      return e[SYSTEM_MODIFIER_KEYS[modifier]] === true;
    }

    const expected = KEY_ALIASES[modifier] || modifier;

    return typeof e.key === 'string' && e.key.toLowerCase() === expected.toLowerCase();
  });
}

/**
 * Builds a nested object from a list of keys, with "lastValue" assigned at the deepest level —
 * e.g. setNestedObjectValue(['a', 'b'], 1) returns { a: { b: 1 } }.
 *
 * @param {string[]} array - The chain of keys to nest, outermost first.
 * @param {*} lastValue - The value assigned to the innermost key. Returned as-is if "array" is empty.
 * @returns {object|*} The nested object, or "lastValue" itself when "array" is empty.
 */
export function setNestedObjectValue(array, lastValue) {
  if (array.length === 0) {
    return lastValue;
  }

  let result  = {};
  let current = result;

  array.forEach((key, index) => {
    if (index === array.length - 1) {
      current[key] = lastValue;
    } else {
      current[key] = {};
      current = current[key];
    }
  });

  return result;
}

/**
 * Reads a dot-separated path off an object, short-circuiting to undefined if any segment along
 * the way is missing.
 *
 * @param {object} obj - The object to read from.
 * @param {string} path - A dot-separated property path, e.g. "user.profile.name".
 * @returns {*} The value at "path", or undefined if any segment doesn't exist.
 */
export function getNestedObjectValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}
