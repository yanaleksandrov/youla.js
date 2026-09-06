// A path segment resolving to one of these would let a crafted "u-prop"/data key repoint an
// object's own prototype (or its constructor) instead of writing a plain data property.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isUnsafeKey(key) {
  return UNSAFE_KEYS.has(key);
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

  const unsafeKey = array.find(isUnsafeKey);
  if (unsafeKey) {
    console.warn(`Youla.js: refusing to write through unsafe key "${unsafeKey}".`);
    return {};
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
 * the way is missing (or unsafe — see "isUnsafeKey").
 *
 * @param {object} obj - The object to read from.
 * @param {string} path - A dot-separated property path, e.g. "user.profile.name".
 * @returns {*} The value at "path", or undefined if any segment doesn't exist.
 */
export function getNestedObjectValue(obj, path) {
  return path.split('.').reduce((acc, key) => (isUnsafeKey(key) ? undefined : acc?.[key]), obj);
}
