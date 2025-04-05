import { setClasses, setStyles } from './classes';

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

    domWalk(node, callback);

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
      directive: startsWith === 'v-' ? name.split('.')[0] : (startsWith === ':' ? 'v-bind' : ''),
      event: startsWith === '@' ? parts[0] : '',
      expression: value,
      modifiers: root.split('.').slice(1)
    }
  });
}

export function updateAttribute(el, name, value) {
  if (name === 'value') {
    if (el.type === 'radio') {
      el.checked = el.value === value
    } else if (el.type === 'checkbox') {
      el.checked = Array.isArray(value) ? value.some(val => val === el.value) : !!value
    } else if (el.tagName === 'SELECT') {
      updateSelect(el, value)
    } else {
      el.value = value
    }
  } else if (name === 'class') {
    bindClasses(el, value)
  } else if (name === 'style') {
    bindStyles(el, value)
  } else if (['disabled', 'readonly', 'required', 'checked', 'autofocus', 'autoplay', 'hidden'].includes(name)) {
    !!value ? el.setAttribute(name, '') : el.removeAttribute(name);
  } else {
    el.setAttribute(name, value)
  }
}

function bindClasses(el, value) {
  if (el._x_undoAddedClasses) {
    el._x_undoAddedClasses()
  }
  el._x_undoAddedClasses = setClasses(el, value)
}

function bindStyles(el, value) {
  if (el._x_undoAddedStyles) {
    el._x_undoAddedStyles()
  }
  el._x_undoAddedStyles = setStyles(el, value)
}

export function updateSelect(el, value) {
  const arrayWrappedValue = [].concat(value).map(value => value + '')

  Array.from(el.options).forEach(option => {
    option.selected = arrayWrappedValue.includes(option.value || option.text)
  })
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
