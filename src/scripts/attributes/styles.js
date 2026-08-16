/**
 * Applies a `:style` binding to an element. An object value is delegated to
 * setStylesFromObject (one property per key); any other value is written as
 * the whole inline "style" attribute string, caching the previous value so
 * it can be restored later.
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
 * Sets each property in "value" as an inline style on the element, converting
 * camelCase keys to kebab-case (CSS custom properties, i.e. keys starting with
 * "--", are left untouched). Removes the "style" attribute entirely once no
 * properties remain, and returns a callback that restores the properties'
 * previous values.
 *
 * @param {HTMLElement} el - The element to update.
 * @param {Object.<string, string>} value - Map of CSS property (camelCase or custom property) to value.
 * @returns {Function} An "undo" callback that restores the previous inline styles.
 */
function setStylesFromObject(el, value) {
  let previousStyles = {}

  Object.entries(value).forEach(([key, value]) => {
    previousStyles[key] = el.style[key]

    // When we use javascript object, css properties use the camelCase
    // syntax but when we use setProperty, we need the css format
    // so we need to convert camelCase to kebab-case.
    // In case key is a CSS variable, leave it as it is.
    if (! key.startsWith('--')) {
      key = key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
    }

    el.style.setProperty(key, value)
  })

  setTimeout(() => el.style.length === 0 && el.removeAttribute('style'))

  return () => setStyles(el, previousStyles);
}
