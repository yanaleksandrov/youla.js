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
 * Runs every registered data-provider factory once and collects their results
 * keyed by name, so a component's `u-data="name"` expression can resolve to a
 * provider's output through a plain property lookup.
 *
 * @param {HTMLElement} [root] - The component's root element ("u-data"), forwarded to each factory.
 * @param {Object} [obj] - Object to populate with the resolved providers.
 * @returns {Object} `obj`, populated with one entry per registered provider.
 */
export function injectDataProviders(root, obj = {}) {
  Object.entries(datas).forEach(([name, callback]) => {
    obj[name] = callback(root);
  });
  return obj;
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