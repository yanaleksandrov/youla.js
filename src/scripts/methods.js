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
 * Returns a lazy lookup of the registered methods: each one is created on first access via
 * `factory(e, el, component)`. Event handlers get a fresh lookup per run, so each method sees its event.
 *
 * @param {Event} [e] - The triggering DOM event; undefined for directive expressions.
 * @param {HTMLElement} el - The element the listener or directive belongs to.
 * @param {Component} component - The owning component instance.
 * @returns {{has: Function, get: Function}} `has(name)`/`get(name)` for a `$name` method.
 */
export function getListenerMethods(e, el, component) {
  const resolved = {};

  return {
    has: name => Object.hasOwn(methods, name),
    get: name => {
      if (!Object.hasOwn(resolved, name)) {
        resolved[name] = methods[name](e, el, component);
      }
      return resolved[name];
    },
  };
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
    cached = { component, ...getListenerMethods(undefined, el, component) };
    elementMethods.set(el, cached);
  }

  return cached;
}
