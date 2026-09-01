import { setClasses } from './classes';
import { setStyles } from './styles';

/**
 * Attribute handling: parsing every directive/event/binding attribute off an element
 * (getAttributes()/parseAttribute()) and, for the fixed ":attr" syntax specifically, writing a
 * resolved value back onto the element (updateAttribute()).
 */

// Matches the "v-"/"@"/":" prefix marking an attribute as a directive, event, or binding.
const ATTRIBUTE_PREFIX = /^(v-|@|:)/;

// Matches a bare "<number><unit>" modifier (e.g. ".500ms", ".30d") given directly, without a preceding keyword like ".delay.".
const DURATION_MODIFIER = /^(\d+)([a-z]+)$/;

/**
 * Classifies a single name/value pair into the shape Component dispatches on. Used both for
 * real DOM attributes and for a "v-bind" object's entries.
 *
 * @param {string} name - The raw attribute or object key, e.g. "v-each.lazy", "@click.prevent", ":class".
 * @param {*} value - The attribute's string value, or (for v-bind entries) any JS value.
 * @returns {{name: string, bind: boolean, directive: string, event: string, expression: *, modifiers: string[], duration: {value: number, unit: string}|null, literal: boolean}} The parsed attribute descriptor.
 */
export function parseAttribute(name, value) {
  const startsWith = (name.match(ATTRIBUTE_PREFIX) || [''])[0];
  const root       = name.replace(startsWith, '');
  const parts      = root.split('.');
  const modifiers  = root.split('.').slice(1);
  const durationMatch = modifiers.map(m => m.match(DURATION_MODIFIER)).find(Boolean);

  return {
    name,
    // Attribute binding (":attr") is core syntax, not a pluggable directive, so it gets its own flag rather than being reported as a directive.
    bind: startsWith === ':',
    directive: startsWith === 'v-' ? name.split('.')[0] : '',
    event: startsWith === '@' ? parts[0] : '',
    expression: value,
    modifiers,
    duration: durationMatch ? { value: Number(durationMatch[1]), unit: durationMatch[2] } : null,
    // A v-bind entry whose value isn't a string (e.g. `disabled: true`) is already a final value, not an expression to run through saferEval.
    literal: typeof value !== 'string'
  }
}

/**
 * Collects every directive/event/binding attribute on an element (":attr", "@event", "v-*"),
 * already parsed via parseAttribute().
 *
 * @param {Element} el - The element to read attributes from.
 * @returns {object[]} The parsed attribute descriptors, in DOM attribute order.
 */
export function getAttributes(el) {
  return [...el.attributes]
    .filter(({ name }) => ATTRIBUTE_PREFIX.test(name))
    .map(({ name, value }) => parseAttribute(name, value));
}

/**
 * Writes a value onto an element for a given attribute/property name, resolving what "value"
 * actually means for that pair — form control values, "class"/"style" (via setClasses/
 * setStyles), boolean attributes — so callers never need to special-case el.type themselves.
 *
 * @param {HTMLElement} el - The element to update.
 * @param {string} name - The attribute/property name ("value", "class", "style", or any other HTML attribute).
 * @param {*} value - The value to apply; its shape depends on "name" (e.g. array/object for "class"/"style").
 */
export function updateAttribute(el, name, value) {
  if (name === 'value') {
    // Radio/checkbox isn't special-cased here like v-prop does; a plain :value bind just sets the element's value like any other input.
    if (el.tagName === 'SELECT') {
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
