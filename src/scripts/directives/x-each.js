import { directive } from '../directives';
import { saferEval } from '../utils';

let contextStack = [];

directive('each', (el, expression, attribute, x, component) => {
  if (typeof expression !== 'string') {
    return;
  }

  /**
   * Step 1: parse x-each value
   *
   * may be "i in 5", "dog in dogs", "(car, index) in cars" syntax
   * with support dot notation, like: "(person, index) in data.list.persons"
   */
  let [, item, index = 'key', items, join] = expression.match(/^\(?([\w]+)(?:,\s*(\w+))?\)?\s+in\s+(.*?)(?:\s+join\s+'([^']+)')?$/) || [];

  /**
   * Step 2: extracting the data, based on the expression & nested context
   */
  let dataItems;

  let hasChildEach = el.querySelector('[x-each]');
  if (Number.isInteger(+items)) {
    dataItems = Array.from({length: +items}, (_, i) => i + 1);
  } else {
    if (contextStack.length) {
      items = items.replace(/^[^.]+/, `${contextStack[contextStack.length - 1]}`);
    }
    dataItems = saferEval(`${items}`, component.data);
  }

  /**
   * Step 3: remove all and start elements rendering
   */
  while (el.nextSibling) {
    let next = el.nextSibling;

    if (next.nodeType === Node.ELEMENT_NODE && next.hasAttribute('x-each')) {
      break;
    }

    next.remove();
  }

  Object.entries(dataItems ?? []).forEach(([key, dataItem], idx, array) => {
    const clone = el.cloneNode(true);

    clone.removeAttribute('x-each');

    (async () => {
      clone.__x_for_data = {[item]: dataItem, [index]: key};

      if (hasChildEach) {
        contextStack.push(`${items}[${key}]`);
      }

      await component.initialize(clone, component.data, clone.__x_for_data);

      if (hasChildEach) {
        contextStack.pop();
      }

      el.parentNode.appendChild(clone);
      if (array[idx + 1] && join) {
        clone.insertAdjacentText('afterend', join);
      }
    })();
  });
});
