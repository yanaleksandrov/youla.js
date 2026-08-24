import {
  closestDirective,
  domWalk,
  setNestedObjectValue,
  getNestedObjectValue,
  saferEval,
  createMagicVariables,
  withMagicVariables
} from './helpers';
import { getAttributes } from './attributes';
import { storage, isStorageModifier, getStorageType, castToType } from './storage';

/**
 * Prepares every `v-prop`-bound form field under `rootElement`: ensures each field has a
 * `name`, seeds a default value into `data` for any property that doesn't exist yet, evaluates
 * the field's current DOM value into `data`, and applies any persisted `.local`/`.cookie` value.
 *
 * @param {HTMLElement} rootElement - The component's root element.
 * @param {Object} data - The component's raw data object, mutated in place.
 * @returns {Object} `data`, for convenience (it's also mutated directly).
 */
export function fetchProp(rootElement, data) {
  domWalk(rootElement, el => getAttributes(el).filter(({directive}) => directive === 'v-prop').forEach(attribute => {
    let {expression, modifiers} = attribute;

    // support directive just for form fields
    if (!['input', 'select', 'textarea'].includes(el.tagName.toLowerCase())) {
      return;
    }

    if (!el.hasAttribute('name')) {
      el.setAttribute('name', expression.replace(/\.(\w+)/g, '[$1]'))
    }

    let [key, ...prop] = expression.split('.');

    // set default value if undefined
    if (data[key] === undefined) {
      let fields = [];
      if (el.type === 'checkbox') {
        fields = closestDirective(el, 'v-data').querySelectorAll(`[${CSS.escape(attribute.name)}="${expression}"]`);
      }

      data[key] = setNestedObjectValue(prop, fields.length > 1 ? [] : '');
    }

    let value = generateExpressionForProp(el, data, attribute);

    // calc real value based on fields value attributes
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
 * Builds the assignment expression used to write a `v-prop`-bound field's
 * current DOM value onto `$data.<expression>`, accounting for the element's
 * type (checkbox array-toggle vs. plain boolean, radio, multi-select) and
 * the `.number`/`.trim` modifiers.
 *
 * @param {HTMLElement} el - The bound form field (input, select, or textarea).
 * @param {Object} data - The component's data object, read to resolve the current bound value.
 * @param {Object} attribute - The parsed `v-prop` attribute descriptor (expression, modifiers).
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
  } else {
    rightSideOfExpression = modifiers.includes('number')
      ? 'parseFloat($el.value)'
      : (modifiers.includes('trim') ? '$el.value.trim()' : '$el.value')
  }

  return `$data.${expression} = ${rightSideOfExpression}`
}
