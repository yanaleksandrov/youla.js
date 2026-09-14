import { setClasses } from './classes';
import { setStyles } from './styles';

// Parses directive/event/binding attributes off an element and, for ":attr", writes a resolved value back onto it.

// Matches the "u-"/"@"/":" prefix marking an attribute as a directive, event, or binding.
const ATTRIBUTE_PREFIX = /^(u-|@|:)/;

// Attributes that can turn a bound URL into script execution (a "javascript:" scheme) if the bound value comes from untrusted data.
const URL_ATTRIBUTES = ['href', 'src', 'action', 'formaction'];

// Matches a "javascript:" scheme once whitespace is stripped, a common filter-bypass trick for this class of check.
const JAVASCRIPT_URL = /^javascript:/i;

function isJavascriptUrl(value) {
  return typeof value === 'string' && JAVASCRIPT_URL.test(value.replace(/\s+/g, ''));
}

/**
 * Detects an inline event-handler attribute (e.g. "onclick"), so `:bind` refuses to write one as
 * script. `name in el` is true for every real event-handler IDL property but false for an
 * unrelated "on*" attribute name (e.g. a hypothetical "onetime").
 *
 * @param {HTMLElement} el
 * @param {string} name
 * @returns {boolean}
 */
function isEventHandlerAttribute(el, name) {
  return /^on\w+$/i.test(name) && name.toLowerCase() in el;
}

// Matches a bare "<number><unit>" modifier (e.g. ".500ms", ".30d") given directly, without a preceding keyword like ".delay.".
const DURATION_MODIFIER = /^(\d+)([a-z]+)$/;

/**
 * Classifies a single name/value pair into the shape Component dispatches on. Used both for
 * real DOM attributes and for a "u-bind" object's entries.
 *
 * @param {string} name - The raw attribute or object key, e.g. "u-each.lazy", "@click.prevent", ":class".
 * @param {*} value - The attribute's string value, or (for u-bind entries) any JS value.
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
    directive: startsWith === 'u-' ? name.split('.')[0] : '',
    event: startsWith === '@' ? parts[0] : '',
    expression: value,
    modifiers,
    duration: durationMatch ? { value: Number(durationMatch[1]), unit: durationMatch[2] } : null,
    // A u-bind entry whose value isn't a string (e.g. `disabled: true`) is already a final value, not an expression to run through saferEval.
    literal: typeof value !== 'string'
  }
}

/**
 * Collects every directive/event/binding attribute on an element, already parsed via
 * parseAttribute(). Caches the result on "el.__x_attrs", keyed by a cheap fingerprint of the
 * matching attributes' name+value pairs, so a later call skips re-parsing unless one actually changed.
 *
 * @param {Element} el - The element to read attributes from.
 * @returns {object[]} The parsed attribute descriptors, in DOM attribute order.
 */
export function getAttributes(el) {
  const matching    = [...el.attributes].filter(({ name }) => ATTRIBUTE_PREFIX.test(name));
  const fingerprint = matching.map(({ name, value }) => `${name}=${value}`).join('\0');

  if (el.__x_attrs && el.__x_attrsFingerprint === fingerprint) {
    return el.__x_attrs;
  }

  el.__x_attrsFingerprint = fingerprint;

  return el.__x_attrs = matching.map(({ name, value }) => parseAttribute(name, value));
}

/**
 * Writes a value onto an element for a given attribute/property name — form control values,
 * "class"/"style" (via setClasses/setStyles), boolean attributes — so callers never special-case
 * el.type. Refuses an inline event-handler attribute or a "javascript:" URL, same trust boundary as "u-html".
 *
 * @param {HTMLElement} el - The element to update.
 * @param {string} name - The attribute/property name ("value", "class", "style", or any other HTML attribute).
 * @param {*} value - The value to apply; its shape depends on "name" (e.g. array/object for "class"/"style").
 */
export function updateAttribute(el, name, value) {
  if (isEventHandlerAttribute(el, name)) {
    console.warn(`Youla.js: refusing to bind event-handler attribute "${name}" — use an "@event" listener instead.`);
    return;
  }

  if (URL_ATTRIBUTES.includes(name) && isJavascriptUrl(value)) {
    console.warn(`Youla.js: refusing to bind "${name}" to a "javascript:" URL.`);
    return;
  }

  if (name === 'value') {
    // Radio/checkbox isn't special-cased here like u-prop does; a plain :value bind just sets the element's value like any other input.
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
