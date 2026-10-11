// Blocks a crafted "u-prop"/data key from repointing an object's own prototype/constructor.
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
