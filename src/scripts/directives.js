import { Youla } from '../scripts/index';
import { register } from './registry';

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
  register('directive', Youla.directives, `v-${name}`, callback);
}
