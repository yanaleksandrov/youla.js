import { directive } from '../directives';
import { saferEval } from '../eval';
import { withMagicVariables, splitMagicVariables } from '../magic-variables';

/**
 * Renders a clone of the template element for each item in an array, object, or integer range,
 * keeping the DOM in sync as the collection changes. Supports `item in items`, `(item, index)
 * in items`, and an optional `... join 'separator'` suffix; `.lazy` skips rendering on init.
 *
 * @param {HTMLElement} el - the template element carrying v-each; cloned once per rendered item.
 * @param {string} output - the raw expression string; v-each parses `attribute.expression` itself rather than using an evaluated value.
 * @param {object} attribute - the parsed attribute descriptor (expression, modifiers, etc.).
 * @param {Component} component - the owning component instance, used to evaluate the items expression against its data.
 * @param {object} [additionalHelperVariables] - loop variables from an enclosing v-each clone, so nested loops can resolve the parent item (e.g. `product in category.products`).
 */
directive('each', (el, output, attribute, component, additionalHelperVariables = {}) => {
  const {expression} = attribute;
  if (typeof expression !== 'string') {
    return;
  }

  // Parses "i in 5", "dog in dogs", or "(car, index) in cars" syntax, with dot notation support.
  let [, item, index = 'key', items, join] = expression.match(/^\(?([\w]+)(?:,\s*(\w+))?\)?\s+in\s+(.*?)(?:\s+join\s+'([^']+)')?$/) || [];

  const { magicVariables, otherVariables } = splitMagicVariables(additionalHelperVariables);

  // Resolves "items" against the component's data; a nested v-each's parent item is available via otherVariables.
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

  // Remove everything already rendered, then render fresh.
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
      // "+key || key" would wrongly fall back to "0" for the first entry since 0 is falsy; only fall back when the key truly isn't numeric.
      const numericKey = +key;

      clone.__x_for_data = {...otherVariables, [item]: dataItem, [index]: Number.isNaN(numericKey) ? key : numericKey};

      await component.initialize(clone);

      el.parentNode.appendChild(clone);
      if (array[idx + 1] && join) {
        clone.insertAdjacentText('afterend', join);
      }
    })();
  });
});
