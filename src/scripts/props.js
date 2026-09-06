import { closestDirective, domWalk } from './dom';
import { setNestedObjectValue, getNestedObjectValue } from './object-path';
import { saferEval } from './eval';
import { createMagicVariables, withMagicVariables } from './magic-variables';
import { getAttributes } from './attributes';
import { storage, isStorageModifier, getStorageType, castToType } from './storage';

/**
 * Prepares every `u-prop`-bound form field under `rootElement`: ensures each field has a
 * `name`, seeds a default value into `data` for any property that doesn't exist yet, evaluates
 * the field's current DOM value into `data`, and applies any persisted `.local`/`.cookie` value.
 *
 * @param {HTMLElement} rootElement - The component's root element.
 * @param {Object} data - The component's raw data object, mutated in place.
 * @returns {Object} `data`, for convenience (it's also mutated directly).
 */
export function hydrateProps(rootElement, data) {
  domWalk(rootElement, el => getAttributes(el).filter(({directive}) => directive === 'u-prop').forEach(attribute => {
    let {expression, modifiers} = attribute;

    // support directive just for form fields
    if (!['input', 'select', 'textarea'].includes(el.tagName.toLowerCase())) {
      return;
    }

    if (!el.hasAttribute('name')) {
      el.setAttribute('name', expression.replace(/\.(\w+)/g, '[$1]'))
    }

    let [key, ...prop] = expression.split('.');

    if (data[key] === undefined) {
      let fields = [];
      if (el.type === 'checkbox') {
        fields = closestDirective(el, 'u-data').querySelectorAll(`[${CSS.escape(attribute.name)}="${expression}"]`);
      }

      data[key] = setNestedObjectValue(prop, fields.length > 1 ? [] : '');
    }

    let value = generateExpressionForProp(el, data, attribute);

    // assign the field's current value onto data
    saferEval(value, withMagicVariables(data, createMagicVariables(rootElement, el)));

    // get data from localStorage or cookie
    if (isStorageModifier(modifiers)) {
      const type  = getStorageType(modifiers);
      const value = storage.get(expression, type);

      if (value) {
        data[expression] = castToType(data[expression], value);
      }
    }
  }));

  return data;
}

/**
 * Builds the assignment expression used to write a `u-prop`-bound field's current DOM value
 * onto `$data.<expression>`, accounting for the element's type and the `.number`/`.trim`
 * modifiers.
 *
 * `.number`/`.trim` also write the cleaned-up value straight back onto `$el.value`, in the same
 * expression — not just `$data`. Without that, the field would show the raw keystroke (a letter,
 * a trailing space) until the next reactive refresh overwrote it with the corrected value a tick
 * later, flickering. Doing both in the same synchronous "input"/"change" handler means the browser
 * never gets to paint the uncorrected value in between.
 *
 * @param {HTMLElement} el - The bound form field (input, select, or textarea).
 * @param {Object} data - The component's data object, read to resolve the current bound value.
 * @param {Object} attribute - The parsed `u-prop` attribute descriptor (expression, modifiers).
 * @returns {string} An expression string, e.g. `"$data.count = $el.value"`, ready for saferEval.
 */
export function generateExpressionForProp(el, data, attribute) {
  let {expression, modifiers} = attribute;

  let rightSideOfExpression, tag = el.tagName.toLowerCase();
  if (el.type === 'checkbox') {
    // If the data we are binding to is an array, toggle its value inside the array.
    let value = getNestedObjectValue(data, expression);
    if (Array.isArray(value)) {
      rightSideOfExpression = `$el.checked ? ${expression}.concat([$el.value]) : [...${expression}.splice(0, ${expression}.indexOf($el.value)), ...${expression}.splice(${expression}.indexOf($el.value)+1)]`
    } else {
      rightSideOfExpression = `$el.checked`
    }
  } else if (el.type === 'radio') {
    rightSideOfExpression = `$el.checked ? $el.value : (typeof ${expression} !== 'undefined' ? ${expression} : '')`
  } else if (tag === 'select' && el.multiple) {
    rightSideOfExpression = `Array.from($el.selectedOptions).map(option => ${modifiers.includes('number')
      ? 'parseFloat(option.value || option.text)'
      : 'option.value || option.text'})`
  } else if (modifiers.includes('number')) {
    // Same character class u-mask's own "number" type filter uses, for consistency.
    rightSideOfExpression = `($el.value = $el.value.replace(/[^-.\\d]/g, ''), parseFloat($el.value))`
  } else if (modifiers.includes('trim')) {
    rightSideOfExpression = `($el.value = $el.value.replace(/^\\s+|\\s+$/g, ''), $el.value)`
  } else {
    rightSideOfExpression = '$el.value'
  }

  return `$data.${expression} = ${rightSideOfExpression}`
}
