import {
  eventCreate,
  getAttributes,
  createNestedObject,
  getNestedObjectValue,
  saferEval,
  isEmpty
} from "./utils";
import { domWalk } from './dom';

export function fetchProps(rootElement, data) {
  const fetched = [];

  domWalk(rootElement, el => getAttributes(el).forEach(attribute => {
    let {name, directive, expression, modifiers} = attribute;

    if (directive === 'v-prop') {
      let prop = expression.split('.');
      let key   = prop.shift();

      // just for form fields
      if (['input', 'select', 'textarea'].includes(el.tagName.toLowerCase())) {
        // fetch multiple checkboxes with same prop
        if (el.type === 'checkbox' && data[key] === undefined) {
          data[key] = createNestedObject(prop, rootElement.querySelectorAll(`[${CSS.escape(name)}]`).length > 1 ? [] : '');
        }

        let propExpression = generateExpressionForProp(el, data, expression, modifiers);
        let newValue = createNestedObject(prop, saferEval(propExpression, data, {'$el': el}));

        data[key] = isEmpty(newValue) ? (data[key] ?? null) : newValue;
      }

      fetched.push({el, attribute});
    }
  }));

  document.dispatchEvent(eventCreate('x:fetched', {data, fetched}))

  return data;
}

export function generateExpressionForProp(el, data, prop, modifiers) {
  let rightSideOfExpression, tag = el.tagName.toLowerCase();
  if (el.type === 'checkbox') {
    // If the data we are binding to is an array, toggle its value inside the array.
    let value = getNestedObjectValue(data, prop);
    if (Array.isArray(value)) {
      rightSideOfExpression = `$el.checked ? ${prop}.concat([$el.value]) : [...${prop}.splice(0, ${prop}.indexOf($el.value)), ...${prop}.splice(${prop}.indexOf($el.value)+1)]`
    } else {
      rightSideOfExpression = `$el.checked`
    }
  } else if (el.type === 'radio') {
    rightSideOfExpression = `$el.checked ? $el.value : (typeof ${prop} !== 'undefined' ? ${prop} : '')`
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
    el.setAttribute('name', prop)
  }

  return `$data.${prop} = ${rightSideOfExpression}`
}
