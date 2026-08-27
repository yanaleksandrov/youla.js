import { register } from './registry';

let methods = {}

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
  register('method', methods, `$${name}`, callback);
}

/**
 * Calls every registered method's factory with the current event/element/component and collects
 * the results keyed by `$name`, ready to expose to an event handler expression.
 *
 * @param {Event} e - The triggering DOM event, forwarded to each factory.
 * @param {HTMLElement} el - The element the listener is attached to, forwarded to each factory.
 * @param {Component} component - The owning component instance, forwarded to each factory.
 * @returns {Object} One entry per registered method, keyed by `$name`.
 */
export function resolveMethods(e, el, component) {
  const resolved = {};

  Object.keys(methods).forEach(key => {
    resolved[key] = methods[key](e, el, component);
  });

  return resolved;
}
