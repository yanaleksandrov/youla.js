import { register } from './registry';

let datas = {}

/**
 * Registers a named data-provider factory, so `u-data="name"` can resolve to
 * whatever object `callback` returns.
 *
 * @param {string} name - The name components will reference via `u-data="name"`.
 * @param {Function} callback - Factory invoked once to produce the provider's data/methods object.
 * @returns {void}
 */
export function data(name, callback) {
  register('data', datas, name, callback);
}

/**
 * Builds the context a component's `u-data` expression is evaluated against: a provider is called
 * with "root" only when the expression reads its name, and at most once per context.
 *
 * @param {HTMLElement} root - The component's root element ("u-data"), forwarded to the factory.
 * @returns {Proxy} A context exposing only registered provider names; anything else falls through to globals.
 */
export function createDataProviderContext(root) {
  const resolved = {};

  return new Proxy({}, {
    has: (target, name) => typeof name === 'string' && isDataProvider(name),
    get: (target, name) => {
      if (typeof name !== 'string' || !isDataProvider(name)) {
        return undefined;
      }
      if (!Object.hasOwn(resolved, name)) {
        resolved[name] = datas[name](root);
      }
      return resolved[name];
    },
  });
}

/**
 * Checks whether `name` is a registered `Youla.data()` provider — so a component can tell whether
 * its own `u-data="name"` resolved to one, rather than to an unrelated plain expression that
 * happens to share the same bare word.
 *
 * @param {string} name - The bare identifier to check (e.g. a `u-data` expression's own name, with any `as alias` already stripped).
 * @returns {boolean} True if `name` is a registered provider.
 */
export function isDataProvider(name) {
  return !!name && Object.prototype.hasOwnProperty.call(datas, name);
}