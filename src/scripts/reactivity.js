import { isNode } from './dom';

/**
 * Well-known symbol every proxy in this module (and component.js's own dependency-tracking
 * proxy, which cooperates with it) responds to by handing back its raw, unwrapped target.
 */
export const RAW = Symbol('raw');

/**
 * Unwraps "value" down to whatever it was before any wrap()/tracking proxy was applied — a
 * no-op for a plain or already-raw value. Without it, a value that round-trips through a proxy
 * (read, spread, write back) picks up another Proxy layer each time, eventually overflowing the call stack.
 *
 * @param {*} value
 * @returns {*}
 */
export function toRaw(value) {
  return (value && typeof value === 'object' && value[RAW]) || value;
}

/**
 * Array methods that mutate the array in place rather than returning a new one. Reading one of
 * these off an observed array (see "wrap()") hands back a wrapper that runs the native method on
 * the raw array, then reports the change — so `list.push(item)` is reactive exactly like
 * `list = [...list, item]`, without the throwaway copy.
 */
const ARRAY_MUTATORS = ['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin'];

/**
 * Wraps "data" (and, recursively, any nested object it contains) in a Proxy that intercepts
 * writes: each successful "set" calls "onChange" with the changed property name, and each call to
 * an array mutator (push, splice, …) calls "onChange" with the method name and "force: true" —
 * a single mutator call can touch several indices plus "length", none of which necessarily match
 * the property name a binding depends on, so it's reported as one unconditional change instead. A
 * DOM node is never wrapped, since calling a native method on a wrapped node would break "this" binding.
 *
 * @param {object} data - The plain object to make observable.
 * @param {(prop: string, force?: boolean) => void} onChange - Called after each successful write or mutator call.
 * @returns {Proxy} The observable version of "data".
 */
export function makeObservable(data, onChange) {
  const wrap = (target) => {
    if (target === null || typeof target !== 'object' || isNode(target)) {
      return target;
    }

    // Never wrap something that's already (transitively) one of ours — see toRaw().
    target = toRaw(target);

    return new Proxy(target, {
      set: (obj, prop, value) => {
        value = wrap(value);

        if (Reflect.set(obj, prop, value)) {
          onChange(prop);
        }

        return true;
      },
      get: (obj, prop) => {
        if (prop === RAW) {
          return obj;
        }

        if (Array.isArray(obj) && ARRAY_MUTATORS.includes(prop)) {
          return (...args) => {
            const result = obj[prop](...args.map(wrap));

            onChange(prop, true);

            return result;
          };
        }

        return wrap(obj[prop]);
      },
    });
  };

  return wrap(data);
}

/**
 * Forces "root"'s component to re-run every binding unconditionally (see
 * `Component#refresh(force)`), deferred with a 0ms timeout so several calls in the same tick
 * still collapse into work the debounced `refresh()` already coalesces internally.
 *
 * @param {HTMLElement} root - The component's root element ("u-data"); its `Component` instance is stashed at "root.__x".
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
 * Makes a plain object reactive for state that lives outside a component's own `u-data` (e.g. a
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
