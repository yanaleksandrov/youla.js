import { directive } from '../directives';
import { saferEval } from '../helpers';

directive('each', (el, output, attribute, component, additionalHelperVariables = {}) => {
  const {expression} = attribute;
  if (typeof expression !== 'string') {
    return;
  }

  /**
   * Step 1: parse v-each value
   *
   * may be "i in 5", "dog in dogs", "(car, index) in cars" syntax
   * with support dot notation, like: "(person, index) in data.list.persons"
   */
  let [, item, index = 'key', items, join] = expression.match(/^\(?([\w]+)(?:,\s*(\w+))?\)?\s+in\s+(.*?)(?:\s+join\s+'([^']+)')?$/) || [];

  /**
   * Step 2: extracting the data, based on the expression.
   *
   * For a nested "v-each" (e.g. "product in category.products"), the parent
   * loop's current item ("category") is passed down via additionalHelperVariables,
   * so it's resolved here the same way loop variables are resolved in v-text/v-bind/etc.
   */
  let dataItems;

  if (Number.isInteger(+items)) {
    dataItems = Array.from({length: +items}, (_, i) => i + 1);
  } else {
    try {
      dataItems = saferEval(`${items}`, component.data, additionalHelperVariables);
    } catch (error) {
      return;
    }
  }

  /**
   * Step 3: remove all and start elements rendering
   */
  if (attribute.modifiers.includes('lazy')) {
    el.setAttribute(attribute.directive, expression);
    el.removeAttribute(attribute.name);
    return;
  }

  while (el.nextSibling) {
    let next = el.nextSibling;

    if (next.nodeType === Node.ELEMENT_NODE && next.hasAttribute('v-each')) {
      break;
    }

    next.remove();
  }

  Object.entries(dataItems ?? []).forEach(([key, dataItem], idx, array) => {
    const clone = el.cloneNode(true);

    clone.removeAttribute('v-each');

    (async () => {
      clone.__x_for_data = {...additionalHelperVariables, [item]: dataItem, [index]: +key || key};

      await component.initialize(clone, component.data, clone.__x_for_data);

      el.parentNode.appendChild(clone);
      if (array[idx + 1] && join) {
        clone.insertAdjacentText('afterend', join);
      }
    })();
  });
});
