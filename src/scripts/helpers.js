export function isFormField(el) {
  return ['input', 'select', 'textarea'].includes(el.tagName.toLowerCase());
}

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

export function saferEval(expression, dataContext, additionalHelperVariables = {}, noReturn = false) {
  expression = noReturn ? `with($data){${expression}}` : `var result; with($data){result=${expression}}; return result`;

  return (new Function(['$data', ...Object.keys(additionalHelperVariables)], expression))(
    dataContext, ...Object.values(additionalHelperVariables)
  )
}

export function getAttributes(el) {
  const regexp = /^(v-|@|:)/;

  return [...el.attributes].filter(({ name }) => regexp.test(name)).map(({ name, value }) => {
    const startsWith = name.match(regexp)[0];
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
      modifiers: root.split('.').slice(1)
    }
  });
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
