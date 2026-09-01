import { register } from './registry';

// Built-ins always win over a same-named custom variable, so registering one of these names is rejected up front instead of silently doing nothing.
const RESERVED = ['$el', '$event', '$refs', '$root'];

let variables = {}

/**
 * Registers a custom variable under `$name` (e.g. `variable('now', ...)`
 * registers `$now`), available inside any directive or event expression
 * alongside the built-in `$el`, `$event`, `$refs` and `$root`.
 *
 * @param {string} name - The variable's name, without the `$` prefix.
 * @param {Function} callback - Factory called as `(root, el, event)`; its return value becomes `$name`.
 * @returns {void}
 */
export function variable(name, callback) {
  const key = `$${name}`;

  if (RESERVED.includes(key)) {
    console.warn(`Youla.js: variable '${key}' is reserved and can't be overridden.`);
    return;
  }

  register('variable', variables, key, callback);
}

/**
 * Runs every registered custom variable's factory and collects the results keyed by `$name`, so
 * `createMagicVariables()` can merge them alongside the built-in magic variables.
 *
 * @param {HTMLElement} root - The component's root element ("v-data"), forwarded to each factory.
 * @param {HTMLElement} el - The element the expression is being evaluated for/against, forwarded to each factory.
 * @param {Event} [event] - The triggering DOM event, if any, forwarded to each factory.
 * @returns {Object} One entry per registered variable, keyed by `$name`.
 */
export function resolveVariables(root, el, event) {
  const resolved = {};

  Object.entries(variables).forEach(([name, callback]) => {
    resolved[name] = callback(root, el, event);
  });

  return resolved;
}
