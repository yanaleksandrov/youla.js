// A path segment resolving to one of these would let a crafted "u-prop"/data key repoint an
// object's own prototype (or its constructor) instead of writing a plain data property.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function isUnsafeKey(key) {
  return UNSAFE_KEYS.has(key);
}

/**
 * Splits a "u-prop" expression into its key segments, accepting dot notation ("user.firstName"),
 * bracket notation ("user[firstName]", PHP/HTML-form style), or a mix of both ("items[0].name") —
 * to any depth of nesting.
 *
 * @param {string} path - The raw expression, e.g. "user[address][city]".
 * @returns {string[]} The path's key segments, outermost first, e.g. ["user", "address", "city"].
 */
export function parsePropPath(path) {
  return path.match(/[^.[\]]+/g) || [];
}

/**
 * Turns a parsed path into a JS member-access string safe to interpolate into an eval'd
 * expression — every segment after the first is a quoted bracket literal, so a bracket-notation
 * expression never gets misread as a bare (and, inside "with($data)", data-scoped) identifier.
 *
 * @param {string} path - The raw expression, e.g. "user[firstName]".
 * @returns {string} A member-access chain rooted at the first segment, e.g. `user["firstName"]`.
 */
export function toJsPropAccessor(path) {
  const [head, ...rest] = parsePropPath(path);
  return rest.reduce((accessor, key) => `${accessor}[${JSON.stringify(key)}]`, head);
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
 * @param {string} path - A dot/bracket property path, e.g. "user.profile.name" or "user[profile][name]".
 * @returns {*} The value at "path", or undefined if any segment doesn't exist.
 */
export function getNestedObjectValue(obj, path) {
  return parsePropPath(path).reduce((acc, key) => (isUnsafeKey(key) ? undefined : acc?.[key]), obj);
}
