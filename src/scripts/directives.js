import { register } from './registry';

let directives = {}

/**
 * Registers a directive under `v-${name}` (e.g. `directive('text', ...)`
 * registers `v-text`), so Component dispatches `callback` whenever an
 * element carries that attribute.
 *
 * @param {string} name - The directive's name, without the `v-` prefix.
 * @param {Function} callback - Implementation, called as `(el, output, attribute, component)`.
 * @returns {void}
 */
export function directive(name, callback) {
  register('directive', directives, `v-${name}`, callback);
}

/**
 * Looks up a registered directive's implementation by its full name (e.g. "v-text"), so
 * callers never need to reach into the directive registry directly.
 *
 * @param {string} name - The directive's full name, including the `v-` prefix.
 * @returns {Function|undefined} The directive's implementation, or undefined if none is registered.
 */
export function getDirective(name) {
  return directives[name];
}
