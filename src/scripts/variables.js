import { register } from './registry';

// Built-ins always win over a same-named custom variable, so registering one of these names is rejected up front instead of silently doing nothing.
const RESERVED = ['$el', '$event', '$refs', '$root', '$storage'];

let variables = {}

/**
 * Registers a custom variable under `$name` (e.g. `variable('now', ...)`
 * registers `$now`), available inside any directive or event expression
 * alongside the built-in `$el`, `$event`, `$refs`, `$root` and `$storage`.
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
 * Returns a lazy lookup of the custom variables: a factory runs on first read and its result is reused within this lookup.
 *
 * @param {HTMLElement} root - The component's root element, forwarded to each factory.
 * @param {HTMLElement} el - The element the expression belongs to, forwarded to each factory.
 * @param {Event} [event] - The triggering DOM event, if any, forwarded to each factory.
 * @returns {{has: Function, get: Function}} `has(name)`/`get(name)` for a `$name` variable.
 */
export function getVariables(root, el, event) {
  const resolved = {};

  return {
    has: name => Object.hasOwn(variables, name),
    get: name => {
      if (!Object.hasOwn(resolved, name)) {
        resolved[name] = variables[name](root, el, event);
      }
      return resolved[name];
    },
  };
}

/**
 * Returns the current value of the custom variable `$name` outside expressions, e.g. for
 * extensions; the factory gets `document.body` as `root` and `el`.
 *
 * @param {string} name - The variable's name, without the `$` prefix.
 * @returns {*} The factory's result, or undefined if no such variable is registered.
 */
export function resolve(name) {
  return variables[`$${name}`]?.(document.body, document.body);
}
