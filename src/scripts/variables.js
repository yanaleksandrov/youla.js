import { Youla } from '../scripts/index';
import { register } from './registry';

// The built-in magic variables (see helpers.js#createMagicVariables) always
// win over a same-named custom one, but registering under one of these names
// is almost certainly a mistake, so it's rejected up front instead of
// silently never taking effect.
const RESERVED = ['$el', '$event', '$refs', '$root'];

/**
 * Registers a custom variable under `$name` (e.g. `variable('now', ...)`
 * registers `$now`), available inside any directive or event expression
 * alongside the built-in `$el`, `$event`, `$refs` and `$root`.
 *
 * @param {string} name - The variable's name, without the `$` prefix.
 * @param {Function} callback - Factory called as `(root, el, event)` every time an expression is
 *   evaluated; its return value becomes `$name` for that evaluation. `root` is the component's
 *   `v-data` element, `el` the element the expression is declared on, and `event` the triggering
 *   DOM event (undefined outside an event handler).
 * @returns {void}
 */
export function variable(name, callback) {
  const key = `$${name}`;

  if (RESERVED.includes(key)) {
    console.warn(`Youla.js: variable '${key}' is reserved and can't be overridden.`);
    return;
  }

  register('variable', Youla.variables, key, callback);
}
