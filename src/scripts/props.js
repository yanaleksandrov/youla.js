import {
  domWalk,
  getAttributes,
  setNestedObjectValue,
  getNestedObjectValue,
  saferEval
} from './helpers';
import { storage, isStorageModifier, getStorageType, castToType } from './storage';

export function fetchProp(rootElement, data) {
  const fetched = [];

  domWalk(rootElement, el => getAttributes(el).filter(({directive}) => directive === 'v-prop').forEach(attribute => {
    // support directive just for form fields
    if (!['input', 'select', 'textarea'].includes(el.tagName.toLowerCase())) {
      return;
    }

    if (!el.hasAttribute('name')) {
      el.setAttribute('name', attribute.expression.replace(/\.(\w+)/g, '[$1]'))
    }

    let [key, ...prop] = attribute.expression.split('.');

    // set default value if undefined
    if (data[key] === undefined) {
      let fields = [];
      if (el.type === 'checkbox') {
        fields = el.closest('[v-data]').querySelectorAll(`[${CSS.escape(attribute.name)}="${attribute.expression}"]`);
      }

      data[key] = setNestedObjectValue(prop, fields.length > 1 ? [] : '');
    }

    let expression = generateExpressionForProp(el, data, attribute);

    // calc real value based on fields value attributes
    saferEval(expression, data, {'$el': el});

    fetched.push({el, attribute});
  }));

  //document.dispatchEvent(eventCreate('x:fetched', {data, fetched}))
  console.log(fetched)
  fetched.forEach(item => {
    const { attribute: { modifiers, directive, expression } } = item;

    if (directive === 'v-prop' && isStorageModifier(modifiers)) {
      const type  = getStorageType(modifiers);
      const value = storage.get(expression, type);

      data[expression] = castToType(data[expression], value || data[expression]);
    }
  })

  return data;
}

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
