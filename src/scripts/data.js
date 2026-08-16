import { register } from './registry';

let datas = {}

/**
 * Registers a named data-provider factory, so `v-data="name"` can resolve to
 * whatever object `callback` returns.
 *
 * @param {string} name - The name components will reference via `v-data="name"`.
 * @param {Function} callback - Factory invoked once to produce the provider's data/methods object.
 * @returns {void}
 */
export function data(name, callback) {
  register('data', datas, name, callback);
}

/**
 * Runs every registered data-provider factory once and collects their results
 * keyed by name, so a component's `v-data="name"` expression can resolve to a
 * provider's output through a plain property lookup.
 *
 * @param {*} context - The `this` value each factory is invoked with.
 * @param {Object} [obj] - Object to populate with the resolved providers.
 * @returns {Object} `obj`, populated with one entry per registered provider.
 */
export function injectDataProviders(context, obj = {}) {
  Object.entries(datas).forEach(([name, callback]) => {
    obj[name] = callback.call(context);
  });
  return obj;
}