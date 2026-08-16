/**
 * Shared implementation behind directive()/method(): assigns a named callback
 * onto a Youla.js registry object, warning instead of overwriting if the name
 * is already taken.
 *
 * @param {string} kind - Label used in the console warning, e.g. "directive" or "method".
 * @param {Object} target - The registry object to write onto (e.g. `Youla.directives`).
 * @param {string} name - The key to register `callback` under (e.g. "v-text", "$ajax").
 * @param {Function} callback - The implementation to store.
 * @returns {void}
 */
export function register(kind, target, name, callback) {
  if (!target[name]) {
    target[name] = callback;
  } else {
    console.warn(`Youla.js: ${kind} '${name}' is already exists.`);
  }
}
