import { closestDirective, domWalk } from './dom';
import { setNestedObjectValue, getNestedObjectValue, isUnsafeKey, parsePropPath, toJsPropAccessor } from './object-path';
import { saferEval } from './eval';
import { createMagicVariables, withMagicVariables } from './magic-variables';
import { getAttributes } from './attributes';
import { storage, isStorageModifier, getStorageType, castToType } from './storage';

/**
 * Prepares every `u-prop` field under `rootElement`: assigns a name, seeds a default, syncs the
 * field's DOM value into data, and restores any persisted `.local`/`.cookie` value.
 * Writes go through `parent.scope` when an ancestor `u-data` already owns the key, so they
 * never shadow it with a same-named local property.
 *
 * @param {HTMLElement} rootElement - The component's root element.
 * @param {Object} data - The component's raw data object, mutated in place.
 * @param {import('./component').default} [parent] - This component's own parent, if any (see `Component#parent`/`#scope`).
 * @returns {Object} `data`, for convenience (it's also mutated directly).
 */
export function hydrateProps(rootElement, data, parent) {
  domWalk(rootElement, el => getAttributes(el).filter(({directive}) => directive === 'u-prop').forEach(attribute => {
    let {expression, modifiers} = attribute;

    // u-prop only binds to form fields
    if (!['input', 'select', 'textarea'].includes(el.tagName.toLowerCase())) {
      return;
    }

    if (!el.hasAttribute('name')) {
      el.setAttribute('name', expression.replace(/\.(\w+)/g, '[$1]'))
    }

    let [key, ...prop] = parsePropPath(expression);

    const unsafeKey = [key, ...prop].find(isUnsafeKey);
    if (unsafeKey) {
      console.warn(`Youla.js: u-prop expression "${expression}" uses unsafe key "${unsafeKey}" — skipped.`);
      return;
    }

    const owner = parent && key in parent.scope ? parent.scope : data;

    if (owner[key] === undefined) {
      let fields = [];
      if (el.type === 'checkbox') {
        // CSS.escape() doesn't cover the quoted attribute-value part, so "/\ in "expression" is escaped by hand.
        fields = closestDirective(el, 'u-data').querySelectorAll(`[${CSS.escape(attribute.name)}="${expression.replace(/["\\]/g, '\\$&')}"]`);
      }

      owner[key] = setNestedObjectValue(prop, fields.length > 1 ? [] : '');
    }

    let value = generateExpressionForProp(el, owner, attribute);

    saferEval(value, withMagicVariables(owner, createMagicVariables(rootElement, el)));

    if (isStorageModifier(modifiers)) {
      const type  = getStorageType(modifiers);
      const value = storage.get(expression, type);

      if (value) {
        owner[expression] = castToType(owner[expression], value);
      }
    }
  }));

  return data;
}

/**
 * Builds the expression that writes a `u-prop` field's current DOM value onto
 * `$data.<expression>`, per the element's type and its `.number`/`.trim` modifiers.
 * `.number`/`.trim` also correct `$el.value` in that same expression, avoiding a flicker
 * before the next reactive refresh would otherwise fix it.
 *
 * @param {HTMLElement} el - The bound form field (input, select, or textarea).
 * @param {Object} data - The component's data object, read to resolve the current bound value.
 * @param {Object} attribute - The parsed `u-prop` attribute descriptor (expression, modifiers).
 * @returns {string} An expression string, e.g. `"$data.count = $el.value"`, ready for saferEval.
 */
export function generateExpressionForProp(el, data, attribute) {
  let {expression, modifiers} = attribute;

  // Bracket segments ("user[firstName]") aren't valid bare JS under saferEval's "with($data)", so normalize to a quoted member-access chain every branch below can interpolate freely.
  const accessor = toJsPropAccessor(expression);

  let rightSideOfExpression, tag = el.tagName.toLowerCase();
  if (el.type === 'checkbox') {
    // If the data we are binding to is an array, toggle its value inside the array.
    let value = getNestedObjectValue(data, expression);
    if (Array.isArray(value)) {
      rightSideOfExpression = `$el.checked ? ${accessor}.concat([$el.value]) : [...${accessor}.splice(0, ${accessor}.indexOf($el.value)), ...${accessor}.splice(${accessor}.indexOf($el.value)+1)]`
    } else {
      rightSideOfExpression = `$el.checked`
    }
  } else if (el.type === 'radio') {
    rightSideOfExpression = `$el.checked ? $el.value : (typeof ${accessor} !== 'undefined' ? ${accessor} : '')`
  } else if (tag === 'select' && el.multiple) {
    rightSideOfExpression = `Array.from($el.selectedOptions).map(option => ${modifiers.includes('number')
      ? 'parseFloat(option.value || option.text)'
      : 'option.value || option.text'})`
  } else if (modifiers.includes('number')) {
    return `($el.value = $el.value.replace(/[^\\d]/g, ''), $data.${accessor} = $el.value === '' ? '' : parseFloat($el.value))`
  } else if (modifiers.includes('trim')) {
    rightSideOfExpression = `($el.value = $el.value.replace(/^\\s+|\\s+$/g, ''), $el.value)`
  } else {
    rightSideOfExpression = '$el.value'
  }

  return `$data.${accessor} = ${rightSideOfExpression}`
}
