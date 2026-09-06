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