export function domReady() {
  return new Promise(resolve => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve)
    } else {
      resolve()
    }
  })
}

export function domWalk(el, callback) {
  callback(el);

  let node = el.firstElementChild;

  while (node) {
    if (node.hasAttribute('v-data')) {
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
 * Creates a debounced function that delays the invocation of the provided function using a specified wait time.
 *
 * @param {Function} callback - The function to be debounced.
 * @param {number} wait - The delay in milliseconds.
 * @returns {Function} - The debounced function.
 */
export function debounce(callback, wait) {
  let timeout;

  return function (...args) {
    clearTimeout(timeout);

    timeout = setTimeout(() => callback.apply(this, args), wait);
  }
}

/**
 * Repeatedly invokes the given function at the specified interval.
 * Optionally invokes the function immediately on the first call.
 *
 * @param {Function} callback - The function to be executed repeatedly.
 * @param {number} wait - The time interval in milliseconds between each call.
 * @param {boolean} immediate - If true, the function is called immediately once before the interval starts.
 * @returns {number} A timer ID that can be used with clearInterval to stop the execution.
 */
export function pulsate(callback, wait, immediate = false) {
  immediate && callback();

  return setInterval(callback, wait);
}

// Walks up from "el" to the nearest ancestor (or itself) carrying loop
// variables from an enclosing "v-each" clone (see "__x_for_data" in
// ./directives/v-each), so evaluation done outside the initial render
// (event handlers, Component#refresh) still sees the same "task"/"index"
// the element was cloned with.
export function getForData(el) {
  let data;
  while (el && !(data = el.__x_for_data)) {
    el = el.parentElement;
  }
  return data;
}

export function saferEval(expression, dataContext, additionalHelperVariables = {}, noReturn = false) {
  expression = noReturn ? `with($data){${expression}}` : `var result; with($data){result=${expression}}; return result`;

  return (new Function(['$data', ...Object.keys(additionalHelperVariables)], expression))(
    dataContext, ...Object.values(additionalHelperVariables)
  )
}

const ATTRIBUTE_PREFIX = /^(v-|@|:)/;

// Classifies a single name/value pair into the shape Component dispatches on.
// Shared by getAttributes() (real DOM attributes, value is always a string)
// and v-bind's runtime expansion (see Component.resolveAttributes), where a
// JS object's entries are classified the exact same way so neither path has
// to reimplement directive/event/bind detection on its own.
export function parseAttribute(name, value) {
  const startsWith = (name.match(ATTRIBUTE_PREFIX) || [''])[0];
  const root       = name.replace(startsWith, '');
  const parts      = root.split('.');

  return {
    name,
    // Attribute binding (":attr") is core syntax, not a pluggable directive,
    // so it gets its own flag rather than being reported as a directive. See ./attributes.
    bind: startsWith === ':',
    directive: startsWith === 'v-' ? name.split('.')[0] : '',
    event: startsWith === '@' ? parts[0] : '',
    expression: value,
    modifiers: root.split('.').slice(1),
    // A v-bind entry whose value isn't a string (e.g. `disabled: true`) is
    // already a final value, not an expression to run through saferEval.
    literal: typeof value !== 'string'
  }
}

export function getAttributes(el) {
  return [...el.attributes]
    .filter(({ name }) => ATTRIBUTE_PREFIX.test(name))
    .map(({ name, value }) => parseAttribute(name, value));
}

export function eventCreate(eventName, detail = {}) {
  return new CustomEvent(eventName, {
    detail,
    bubbles: true,
    // Allows events to pass the shadow DOM barrier.
    composed: true,
    cancelable: true,
  })
}

export function getNextModifier(modifiers, modifierAfter, defaultValue = '') {
  return modifiers[modifiers.indexOf(modifierAfter) + 1] || defaultValue;
}

// export function isEmpty(variable) {
//   return variable === '' || variable === null || (Array.isArray(variable) && variable.length === 0) || (typeof variable === 'object' && Object.keys(variable).length === 0);
// }

/**
 * Create nested object form array.
 *
 * @param array
 * @param lastValue
 * @returns {{}|*}
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

export function getNestedObjectValue(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}
