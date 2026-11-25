import { domWalk } from './dom';
import { getVariables } from './variables';

// Key of the lazy custom-variable lookup inside a magic-variables bag; a symbol, so spreading the bag never runs a factory.
export const VARIABLES = Symbol('variables');
import { storage } from './storage';

/**
 * Walks up from "el" to the nearest ancestor (or itself) carrying loop variables from an
 * enclosing "u-each" clone (see "__x_for_data" in ./directives/u-each).
 *
 * @param {Element} el - The element to start searching from.
 * @returns {object|undefined} The loop variables stored on the nearest "u-each" clone, if any.
 */
export function getForData(el) {
  let data;
  while (el && !(data = el.__x_for_data)) {
    el = el.parentElement;
  }
  return data;
}

/**
 * Creates a Proxy standing in for "$refs": each property resolves to the element carrying a matching "u-ref".
 *
 * @param {HTMLElement} root - The component's root element ("u-data"), to scope the search to.
 * @param {Map} [cache] - Found elements by name, kept while they stay connected and keep their "u-ref".
 * @returns {Proxy} An object whose properties resolve to "u-ref" elements.
 */
export function createRefsProxy(root, cache) {
  return new Proxy({}, {
    get(object, property) {
      let ref = cache?.get(property);

      if (ref?.isConnected && ref.getAttribute('u-ref') === property) {
        return ref;
      }
      ref = undefined;

      // domWalk instead of querySelector, since querySelector can't easily exclude "u-ref" elements belonging to a nested component.
      domWalk(root, el => (el.getAttribute('u-ref') === property ? (ref = el) : null));

      ref ? cache?.set(property, ref) : cache?.delete(property);

      return ref;
    }
  });
}

/**
 * Builds the "$el"/"$event"/"$refs"/"$root"/"$storage" magic variables, plus a lazy lookup of the
 * custom variables registered via "Youla.variable()", computed only when an expression reads one.
 *
 * @param {HTMLElement} root - The component's root element ("u-data"), used for "$root" and to scope "$refs".
 * @param {HTMLElement} el - The element the expression is being evaluated for/against; becomes "$el".
 * @param {Event} [event] - The triggering DOM event, if any; becomes "$event" (undefined otherwise).
 * @param {Proxy} [refs] - A shared "$refs" proxy, as built by createRefsProxy().
 * @returns {object} The magic variables, ready to merge into "additionalHelperVariables".
 */
export function createMagicVariables(root, el, event, refs = createRefsProxy(root)) {
  return {
    '$el': el,
    '$event': event,
    '$refs': refs,
    '$root': root,
    '$storage': storage,
    [VARIABLES]: getVariables(root, el, event),
  };
}

/**
 * Wraps "dataContext" so the magic variables, then "methods", resolve before falling through to
 * real data, reachable both as bare identifiers and as "this.$refs". Writes to a magic key are
 * silently discarded, so a method can never overwrite one.
 *
 * @param {object} dataContext - The data object (or Proxy) to wrap.
 * @param {object} magicVariables - The magic variables to expose, as built by createMagicVariables().
 * @param {object} [methods] - Lazy method lookup, as built by getElementMethods() or getListenerMethods().
 * @returns {Proxy} The wrapped context, safe to pass as "$data" to saferEval.
 */
export function withMagicVariables(dataContext, magicVariables, methods) {
  // Only "$" names can be methods, so plain data lookups skip the registry entirely.
  const variables  = magicVariables[VARIABLES];
  const isVariable = prop => variables !== undefined && typeof prop === 'string' && prop[0] === '$' && variables.has(prop);
  const isMethod   = prop => methods !== undefined && typeof prop === 'string' && prop[0] === '$' && methods.has(prop);
  const isMagic    = prop => prop in magicVariables || isVariable(prop) || isMethod(prop);

  return new Proxy(dataContext, {
    get: (target, prop) => prop in magicVariables ? magicVariables[prop]
      : isVariable(prop) ? variables.get(prop)
      : isMethod(prop) ? methods.get(prop)
      : target[prop],
    has: (target, prop) => isMagic(prop) || prop in target,
    set: (target, prop, value) => isMagic(prop) ? true : Reflect.set(target, prop, value)
  });
}

/**
 * Splits a merged helper-variables bag into its magic variables (anything with a "$" prefix)
 * and everything else (e.g. "u-each" loop variables).
 *
 * @param {object} [helperVariables] - The merged bag, as built at each Component evaluation call site.
 * @returns {{magicVariables: object, otherVariables: object}}
 */
export function splitMagicVariables(helperVariables = {}) {
  const magicVariables = {}, otherVariables = {};

  Object.entries(helperVariables).forEach(([key, value]) => {
    (key[0] === '$' ? magicVariables : otherVariables)[key] = value;
  });

  if (VARIABLES in helperVariables) {
    magicVariables[VARIABLES] = helperVariables[VARIABLES];
  }

  return { magicVariables, otherVariables };
}
