import { directive } from '../directives';
import { saferEval, withMagicVariables, splitMagicVariables } from '../helpers';

/**
 * Renders a clone of the template element for each item in an array, object,
 * or integer range, keeping the DOM in sync as the underlying collection
 * changes. Supports `item in items`, `(item, index) in items`, and an
 * optional `... join 'separator'` suffix. The `.lazy` modifier skips
 * rendering on init, trusting whatever the server already rendered until the
 * bound data actually changes.
 *
 * @param {HTMLElement} el - the template element carrying v-each; cloned once per rendered item.
 * @param {string} output - the raw expression string; v-each parses `attribute.expression` itself rather than using an evaluated value.
 * @param {object} attribute - the parsed attribute descriptor (expression, modifiers, etc. — see parseAttribute in ../attributes).
 * @param {Component} component - the owning component instance, used to evaluate the items expression against its data.
 * @param {object} [additionalHelperVariables] - loop variables from an enclosing v-each clone, so nested loops can resolve the parent item (e.g. `product in category.products`).
 */
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

  const { magicVariables, otherVariables } = splitMagicVariables(additionalHelperVariables);

  /**
   * Step 2: resolve "items" against the component's data. For a nested "v-each" (e.g.
   * "product in category.products"), the parent loop's current item ("category") is available
   * via otherVariables.
   */
  let dataItems;

  if (Number.isInteger(+items)) {
    dataItems = Array.from({length: +items}, (_, i) => i + 1);
  } else {
    try {
      dataItems = saferEval(`${items}`, withMagicVariables(component.data, magicVariables), otherVariables);
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
      clone.__x_for_data = {...otherVariables, [item]: dataItem, [index]: +key || key};

      await component.initialize(clone);

      el.parentNode.appendChild(clone);
      if (array[idx + 1] && join) {
        clone.insertAdjacentText('afterend', join);
      }
    })();
  });
});
