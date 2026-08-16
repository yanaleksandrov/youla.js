import { setClasses } from './classes';
import { setStyles } from './styles';

/**
 * Attribute handling
 *
 * Everything about writing a value onto an element's attributes/properties —
 * a third kind of interaction with elements alongside directives (behavior)
 * and methods (callable helpers in expressions). Unlike those two, it isn't a
 * registry of pluggable, user-named entries: it's the fixed, built-in mechanism
 * behind the ":attr" syntax. getAttributes() (see ../helpers) flags these
 * attributes directly, so Component dispatches them here instead of through
 * Youla.directives/Youla.methods.
 */

/**
 * Writes a value onto an element for a given attribute/property name, resolving
 * what "value" actually means for that pair so callers (attribute binding,
 * v-prop) never need to special-case el.type themselves. Handles form control
 * values (radio, checkbox, select, plain inputs), "class" and "style"
 * (delegated to setClasses/setStyles, undoing their previous call first),
 * boolean HTML attributes (removed when falsy), and falls back to a plain
 * setAttribute for anything else.
 *
 * @param {HTMLElement} el - The element to update.
 * @param {string} name - The attribute/property name ("value", "class", "style", or any other HTML attribute).
 * @param {*} value - The value to apply; its shape depends on "name" (e.g. array/object for "class"/"style").
 */
export function updateAttribute(el, name, value) {
  if (name === 'value') {
    if (el.type === 'radio') {
      el.checked = el.value === value
    } else if (el.type === 'checkbox') {
      el.checked = Array.isArray(value) ? value.some(val => val === el.value) : !!value
    } else if (el.tagName === 'SELECT') {
      const selectedValues = [].concat(value).map(v => v + '')
      Array.from(el.options).forEach(option => {
        option.selected = selectedValues.includes(option.value || option.text)
      })
    } else {
      el.value = value
    }
  } else if (name === 'class') {
    if (el._x_undoAddedClasses) {
      el._x_undoAddedClasses()
    }
    el._x_undoAddedClasses = setClasses(el, value)
  } else if (name === 'style') {
    if (el._x_undoAddedStyles) {
      el._x_undoAddedStyles()
    }
    el._x_undoAddedStyles = setStyles(el, value)
  } else if (['disabled', 'readonly', 'required', 'checked', 'autofocus', 'autoplay', 'hidden'].includes(name)) {
    !!value ? el.setAttribute(name, '') : el.removeAttribute(name);
  } else {
    el.setAttribute(name, value)
  }
}
