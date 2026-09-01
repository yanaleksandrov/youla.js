/**
 * A well-known symbol every proxy this module (and component.js's own dependency-tracking proxy
 * in evaluate(), which cooperates with it — see that file) creates responds to by handing back its
 * own raw, unwrapped target — see toRaw() below.
 */
export const RAW = Symbol('raw');

/**
 * Unwraps "value" all the way down to whatever it was before any wrap()/tracking-proxy layer was
 * ever applied to it — a no-op for a plain value or one that was never wrapped.
 *
 * Without this, a value that round-trips through a proxy — read (wrapping it), spread into a new
 * object, written back (wrapping it *again*, since wrap() had no way to tell the value it was
 * just handed was already one of its own proxies) — picks up one more Proxy layer than it had
 * before every single time. controls/fill.js's patchFillAt() does exactly that on every color/
 * media change; a couple of seconds of dragging a slider (tens to hundreds of writes) was enough
 * to nest a single "image"/"video" sub-object under hundreds of Proxy layers, so later just
 * *reading* one of its properties needed as many nested calls as there had been writes —
 * "RangeError: Maximum call stack size exceeded", not from any real recursion in application code.
 *
 * @param {*} value
 * @returns {*}
 */
export function toRaw(value) {
  return (value && typeof value === 'object' && value[RAW]) || value;
}

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

    // Never wrap something that's already (transitively, through however many proxy layers)
    // one of ours — see toRaw()'s own comment for why this matters.
    target = toRaw(target);

    return new Proxy(target, {
      set: (obj, prop, value) => {
        value = wrap(value);

        if (Reflect.set(obj, prop, value)) {
          onChange(prop);
        }

        return true;
      },
      get: (obj, prop) => (prop === RAW ? obj : wrap(obj[prop])),
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
