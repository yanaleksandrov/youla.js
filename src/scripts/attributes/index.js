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

// Resolves what "value" means for a given attribute/element pair, so callers
// (attribute binding, v-prop) never need to special-case el.type themselves.
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

// Resolves the target attribute name from the ":attr" syntax and writes the
// value onto the element. Called directly by Component rather than registered
// through Youla.directives, since attribute binding is core syntax, not an
// optional/pluggable behavior.
export function bindAttribute(el, output, attribute) {
  updateAttribute(el, attribute.name.replace(':', ''), output);
}
