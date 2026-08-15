import {
  domWalk,
  getAttributes,
  isFormField,
  setNestedObjectValue,
  getNestedObjectValue,
  saferEval
} from './helpers';
import { storage, isStorageModifier, getStorageType, castToType } from './storage';

// only a plain variable/dot-path can be hydrated back into data — anything
// else (template literals, string/array literals, method calls...) is a
// read-only display expression, so hydrating it would just pollute data
// with a garbage key built from its first "." split.
const isBindablePath = expression => /^[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*$/.test(expression.trim());

export function fetchProp(rootElement, data) {
  domWalk(rootElement, el => getAttributes(el).filter(({directive}) => directive === 'v-prop').forEach(attribute => {
    let {expression, modifiers} = attribute;

    // on anything other than a form field there's no user input to read, so
    // just seed data from the element's pre-rendered content when it's
    // missing — the same "DOM is the source of truth until data says
    // otherwise" idea used below for form fields — so reactive updates can
    // take over from there.
    if (!isFormField(el)) {
      if (isBindablePath(expression)) {
        let [key, ...prop] = expression.split('.');

        if (data[key] === undefined) {
          data[key] = setNestedObjectValue(prop, modifiers.includes('html') ? el.innerHTML : el.textContent);
        }
      }

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
        fields = el.closest('[v-data]').querySelectorAll(`[${CSS.escape(attribute.name)}="${expression}"]`);
      }

      data[key] = setNestedObjectValue(prop, fields.length > 1 ? [] : '');
    }

    let value = generateExpressionForProp(el, data, attribute);

    // calc real value based on fields value attributes
    saferEval(value, data, {'$el': el});

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
