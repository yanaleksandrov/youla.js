import { directive } from '../directives';
import { saferEval } from '../utils';

let iterations = {};
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
  let [, item, index = 'key', items] = expression.match(/^\(?([\w]+)(?:,\s*(\w+))?\)?\s+in\s+(.*)$/) || [];

  /**
   * Step 2: extracting the data, based on the expression & nested context
   */
  let dataItems;

  iterations[items] = 0;
  if (Number.isInteger(+items)) {
    dataItems = Array.from({length: +items}, (_, i) => i + 1);
  } else {
    let parentContext = contextStack.length ? contextStack[contextStack.length - 1] : items;
    if (iterations[items] >= 0) {
      items = items.replace(/^[^.]+/, `${items}[${iterations[items]}]`)
    }
    console.log(el)
    console.log(items)
    console.log(parentContext)
    dataItems = saferEval(`${items}`, component.data);
  }

  /**
   * Step 3: remove all and start elements rendering
   */
  while (el.nextSibling) {
    el.nextSibling.remove();
  }

  Object.entries(dataItems).forEach(([key, dataItem]) => {
    const clone = el.cloneNode(true);

    clone.removeAttribute('x-each');

    (async () => {
      clone.__x_for_data = {[item]: dataItem, [index]: key};

      await component.initialize(clone, component.data, clone.__x_for_data);

      el.parentNode.appendChild(clone);
    })();
  });
});
