import { domWalk } from './dom';
import { resolveVariables } from './variables';

/**
 * Walks up from "el" to the nearest ancestor (or itself) carrying loop variables from an
 * enclosing "v-each" clone (see "__x_for_data" in ./directives/v-each).
 *
 * @param {Element} el - The element to start searching from.
 * @returns {object|undefined} The loop variables stored on the nearest "v-each" clone, if any.
 */
export function getForData(el) {
  let data;
  while (el && !(data = el.__x_for_data)) {
    el = el.parentElement;
  }
  return data;
}

/**
 * Creates a Proxy standing in for "$refs": each property access walks the DOM to find the
 * element carrying a matching "v-ref" attribute.
 *
 * @param {HTMLElement} root - The component's root element ("v-data"), to scope the walk to.
 * @returns {Proxy} An object whose properties resolve to "v-ref" elements.
 */
export function createRefsProxy(root) {
  return new Proxy({}, {
    get(object, property) {
      let ref;

      // domWalk instead of querySelector, since querySelector can't easily exclude "v-ref" elements belonging to a nested component.
      domWalk(root, el => (el.getAttribute('v-ref') === property ? (ref = el) : null));

      return ref;
    }
  });
}

/**
 * Builds the "$el"/"$event"/"$refs"/"$root" magic variables, keyed the way saferEval expects
 * for "additionalHelperVariables" — plus one entry per custom variable registered via
 * "Youla.variable()", each recomputed by calling its factory with the same "root"/"el"/"event".
 *
 * @param {HTMLElement} root - The component's root element ("v-data"), used for "$root" and to scope "$refs".
 * @param {HTMLElement} el - The element the expression is being evaluated for/against; becomes "$el".
 * @param {Event} [event] - The triggering DOM event, if any; becomes "$event" (undefined otherwise).
 * @returns {object} The magic variables, ready to merge into "additionalHelperVariables".
 */
export function createMagicVariables(root, el, event) {
  // Spread first so a built-in name can never be shadowed by a custom variable, even if the variable registry is poked directly.
  return {
    ...resolveVariables(root, el, event),
    '$el': el,
    '$event': event,
    '$refs': createRefsProxy(root),
    '$root': root
  };
}

/**
 * Wraps "dataContext" in a Proxy that resolves the magic variables before falling through to
 * the real data, so they're reachable both as bare identifiers and as "this.$refs" inside a
 * method. Writes to a magic key are accepted but discarded, so a method never mutates real data.
 *
 * @param {object} dataContext - The data object (or Proxy) to wrap.
 * @param {object} magicVariables - The magic variables to expose, as built by createMagicVariables().
 * @returns {Proxy} The wrapped context, safe to pass as "$data" to saferEval.
 */
export function withMagicVariables(dataContext, magicVariables) {
  return new Proxy(dataContext, {
    get: (target, prop) => prop in magicVariables ? magicVariables[prop] : target[prop],
    has: (target, prop) => prop in magicVariables || prop in target,
    set: (target, prop, value) => prop in magicVariables ? true : Reflect.set(target, prop, value)
  });
}

/**
 * Splits a merged helper-variables bag into its magic variables (anything with a "$" prefix)
 * and everything else (e.g. "v-each" loop variables).
 *
 * @param {object} [helperVariables] - The merged bag, as built at each Component evaluation call site.
 * @returns {{magicVariables: object, otherVariables: object}}
 */
export function splitMagicVariables(helperVariables = {}) {
  const magicVariables = {}, otherVariables = {};

  Object.entries(helperVariables).forEach(([key, value]) => {
    (key[0] === '$' ? magicVariables : otherVariables)[key] = value;
  });

  return { magicVariables, otherVariables };
}
