/**
 * Wraps "data" (and, recursively, any nested object it contains) in a Proxy that intercepts
 * writes: each successful "set" calls "onChange" with the changed property name. A DOM node is
 * never wrapped, since calling a native method on a wrapped node would break "this" binding.
 *
 * @param {object} data - The plain object to make observable.
 * @param {(prop: string) => void} onChange - Called after each successful property write, with
 *   the name of the property that changed.
 * @returns {Proxy} The observable version of "data".
 */
export function makeObservable(data, onChange) {
  const wrap = (target) => {
    if (target === null || typeof target !== 'object' || target instanceof Node) {
      return target;
    }

    return new Proxy(target, {
      set: (obj, prop, value) => {
        value = wrap(value);

        if (Reflect.set(obj, prop, value)) {
          onChange(prop);
        }

        return true;
      },
      get: (obj, prop) => wrap(obj[prop]),
    });
  };

  return wrap(data);
}

/**
 * Forces "root"'s component to re-run every binding unconditionally (see
 * `Component#refresh(force)`), deferred with a 0ms timeout so several calls in the same tick
 * still collapse into work the debounced `refresh()` already coalesces internally.
 *
 * @param {HTMLElement} root - The component's root element ("v-data"), whose `Component`
 *   instance is stashed at "root.__x" by `Youla.componentInitialize` once it's fully constructed.
 * @returns {void}
 */
export function forceRefresh(root) {
  setTimeout(() => {
    const component = root.__x;
    if (component) {
      component.refresh(true);
    }
  }, 0);
}

/**
 * Makes a plain object reactive for state that lives outside a component's own `v-data` (e.g. a
 * `Youla.variable()`'s instance): every property write force-refreshes "root" (see
 * `forceRefresh`), deduplicated per pending refresh the way `Component#concernedData` is.
 *
 * @param {object} data - The plain object to make reactive.
 * @param {HTMLElement} root - The component's root element to force-refresh on every write.
 * @returns {Proxy} The reactive version of "data".
 */
export function reactive(data, root) {
  let pending = [];

  return makeObservable(data, prop => {
    if (!pending.includes(prop)) {
      pending.push(prop);

      forceRefresh(root);

      setTimeout(() => pending = [], 0);
    }
  });
}
