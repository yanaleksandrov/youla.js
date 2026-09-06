import { register } from './registry';

let directives = {}

/**
 * Registers a directive under `u-${name}` (e.g. `directive('text', ...)`
 * registers `u-text`), so Component dispatches `callback` whenever an
 * element carries that attribute.
 *
 * @param {string} name - The directive's name, without the `u-` prefix.
 * @param {Function} callback - Implementation, called as `(el, output, attribute, component)`.
 * @returns {void}
 */
export function directive(name, callback) {
  register('directive', directives, `u-${name}`, callback);
}

/**
 * Looks up a registered directive's implementation by its full name (e.g. "u-text"), so
 * callers never need to reach into the directive registry directly.
 *
 * @param {string} name - The directive's full name, including the `u-` prefix.
 * @returns {Function|undefined} The directive's implementation, or undefined if none is registered.
 */
export function getDirective(name) {
  return directives[name];
}
