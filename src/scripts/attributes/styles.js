/**
 * Applies a `:style` binding to an element. An object value is delegated to setStylesFromObject
 * (one property per key); any other value is written as the whole inline "style" attribute
 * string, caching the previous value so it can be restored later.
 *
 * @param {HTMLElement} el - The element to update.
 * @param {Object|string} value - A style-object map, or a raw inline style string.
 * @returns {Function} An "undo" callback that restores the element's previous style.
 */
export function setStyles(el, value) {
  if (typeof value === 'object' && value !== null) {
    return setStylesFromObject(el, value)
  }

  return ((el, value) => {
    let cache = el.getAttribute('style', value)

    el.setAttribute('style', value)

    return () => {
      el.setAttribute('style', cache || '')
    }
  })(el, value)
}

/**
 * Sets each property in "value" as an inline style on the element, converting camelCase keys
 * to kebab-case (CSS custom properties are left untouched), and removes the "style" attribute
 * entirely once no properties remain.
 *
 * @param {HTMLElement} el - The element to update.
 * @param {Object.<string, string>} value - Map of CSS property (camelCase or custom property) to value.
 * @returns {Function} An "undo" callback that restores the previous inline styles.
 */
function setStylesFromObject(el, value) {
  let previousStyles = {}

  Object.entries(value).forEach(([key, value]) => {
    previousStyles[key] = el.style[key]

    // setProperty needs kebab-case, not the camelCase a JS style object uses, unless key is a CSS variable.
    if (! key.startsWith('--')) {
      key = key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    }

    el.style.setProperty(key, value)
  })

  setTimeout(() => el.style.length === 0 && el.removeAttribute('style'))

  return () => setStyles(el, previousStyles);
}
