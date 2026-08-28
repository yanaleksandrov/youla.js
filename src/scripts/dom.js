/**
 * Waits for the DOM to finish parsing.
 *
 * @returns {Promise<void>} Resolves once the document is ready.
 */
export function domReady() {
  return new Promise(resolve => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve)
    } else {
      resolve()
    }
  })
}

/**
 * Checks whether an element carries a directive, matching by base name so any modifiers
 * on it (e.g. "v-data.local") are ignored.
 *
 * @param {Element} el - The element to check.
 * @param {string} name - The directive's base name, e.g. "v-data".
 * @returns {boolean} True if the element has this directive, with or without modifiers.
 */
export function hasDirective(el, name) {
  return [...el.attributes].some(({ name: attrName }) => attrName === name || attrName.startsWith(`${name}.`));
}

/**
 * Finds the nearest element, starting at "el" itself, that carries the given directive.
 *
 * @param {Element} el - The element to start searching from.
 * @param {string} name - The directive's base name, e.g. "v-data".
 * @returns {Element|null} The matching element, or null if none is found.
 */
export function closestDirective(el, name) {
  while (el && !hasDirective(el, name)) {
    el = el.parentElement;
  }
  return el;
}

/**
 * Walks the DOM tree rooted at "el" depth-first, invoking "callback" for "el" itself and every
 * descendant. Stops at a nested "v-data" component's boundary, and treats a "v-each" template
 * element as a leaf rather than walking into its unrendered children.
 *
 * @param {Element} el - The root element to start walking from.
 * @param {Function} callback - Invoked once for "el" and for each element visited under it.
 * @returns {void}
 */
export function domWalk(el, callback) {
  callback(el);

  // Snapshotted up front, not chased live via "nextElementSibling": a directive applied to one
  // child (e.g. "v-ranger" wrapping/cloning its own <input>) can rearrange the DOM around that
  // child as a side effect of "callback(node)" below. Re-reading a live "nextElementSibling"
  // afterwards would then follow whatever the directive just built instead of "el"'s real
  // remaining children — wandering into that internal markup and, once it dead-ends, never
  // reaching "el"'s later siblings at all.
  const children = Array.from(el.children);

  for (const node of children) {
    if (hasDirective(node, 'v-data')) {
      return;
    }

    // "v-each" elements are templates: the directive itself clones and walks each rendered item, so descending into the raw template here would evaluate its children without loop scope.
    if (node.hasAttribute('v-each')) {
      callback(node);
    } else {
      domWalk(node, callback);
    }
  }
}
