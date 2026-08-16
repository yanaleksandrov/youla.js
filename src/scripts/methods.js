import { Youla } from '../scripts/index';
import { register } from './registry';

/**
 * Registers an expression-callable method under `$${name}` (e.g.
 * `method('ajax', ...)` registers `$ajax`), available inside any directive
 * or event expression.
 *
 * @param {string} name - The method's name, without the `$` prefix.
 * @param {Function} callback - Factory called as `(event, el, component)`, returning the actual callable exposed to expressions.
 * @returns {void}
 */
export function method(name, callback) {
  register('method', Youla.methods, `$${name}`, callback);
}
