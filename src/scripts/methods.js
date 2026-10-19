import { register } from './registry';

let methods = {}

/**
 * Registers an expression-callable method under `$${name}` (e.g. `method('foo', ...)`
 * registers `$foo`), available inside any directive or event expression.
 *
 * @param {string} name - The method's name, without the `$` prefix.
 * @param {Function} callback - Factory called as `(event, el, component)`, returning the actual callable exposed to expressions; `event` is undefined in directive expressions.
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

// Cached per element so every evaluation of its directives, and closures created by them, share one instance (e.g. "$ajax" aborting its previous request).
const elementMethods = new WeakMap();

/**
 * Returns a lazy lookup of the registered methods for a directive expression on "el": each one is
 * created on first access with an undefined event and cached for later evaluations.
 *
 * @param {HTMLElement} el - The element the directive is declared on.
 * @param {Component} component - The owning component instance.
 * @returns {{has: Function, get: Function}} `has(name)`/`get(name)` for a `$name` method.
 */
export function getElementMethods(el, component) {
  let cached = elementMethods.get(el);

  if (cached?.component !== component) {
    const resolved = {};

    cached = {
      component,
      has: name => Object.hasOwn(methods, name),
      get: name => {
        if (!Object.hasOwn(resolved, name)) {
          resolved[name] = methods[name](undefined, el, component);
        }
        return resolved[name];
      },
    };
    elementMethods.set(el, cached);
  }

  return cached;
}
