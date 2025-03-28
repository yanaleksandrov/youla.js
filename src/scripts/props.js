import {
  eventCreate,
  getAttributes,
  setNestedObjectValue,
  getNestedObjectValue,
  saferEval
} from './utils';
import { domWalk } from './dom';

export function fetchProps(rootElement, data) {
  const fetched = [];

  domWalk(rootElement, el => getAttributes(el).filter(({directive}) => directive === 'v-prop').forEach(attribute => {
    // support directive just for form fields
    if (!['input', 'select', 'textarea'].includes(el.tagName.toLowerCase())) {
      return;
    }

    let expression = generateExpressionForProp(el, data, attribute);

    // calc real value based on fields value attributes
    saferEval(expression, data, {'$el': el});

    fetched.push({el, attribute});
  }));

  document.dispatchEvent(eventCreate('x:fetched', {data, fetched}))

  return data;
}

export function generateExpressionForProp(el, data, attribute) {
  let {expression, modifiers} = attribute;

  let [key, ...prop] = expression.split('.');

  // set default value if undefined
  if (data[key] === undefined) {
    data[key] = setNestedObjectValue(prop, el.closest('[v-data]').querySelectorAll(`[${CSS.escape(attribute.name)}]`).length > 1 ? [] : '');
  }

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

  if (!el.hasAttribute('name')) {
    el.setAttribute('name', expression.replace(/\.(\w+)/g, '[$1]'))
  }

  return `$data.${expression} = ${rightSideOfExpression}`
}
