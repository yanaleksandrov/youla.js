import { directive } from '../directives';
import { saferEval } from '../eval';
import { withMagicVariables, splitMagicVariables } from '../magic-variables';

const EACH_EXPRESSION = /^\(?([\w]+)(?:,\s*(\w+))?\)?\s+in\s+(.*?)(?:\s+join\s+'([^']+)')?$/;

/**
 * Parses "i in 5", "dog in dogs", or "(car, index) in cars" syntax, with dot notation and an
 * optional "... join '...'" suffix — shared with Component#computeOutput()'s own "u-each" case,
 * which needs "items" (the raw collection expression) to derive tracked deps without evaluating it.
 *
 * @param {string} expression - The "u-each" attribute's raw expression.
 * @returns {{item?: string, index: string, items?: string, join?: string}} The parsed parts;
 *   all but "index" are undefined if "expression" doesn't match the expected syntax.
 */
export function parseEachExpression(expression) {
  const [, item, index = 'key', items, join] = expression.match(EACH_EXPRESSION) || [];

  return { item, index, items, join };
}

/**
 * Renders a clone of the template element for each item in an array, object, or integer range,
 * keeping the DOM in sync as the collection changes. Supports `item in items`, `(item, index)
 * in items`, and an optional `... join 'separator'` suffix; `.lazy` skips rendering on init.
 * On a `<template>`, its inert content is rendered instead of the element itself.
 *
 * @param {HTMLElement} el - the template element carrying u-each; cloned once per rendered item.
 * @param {string} output - the raw expression string; u-each parses `attribute.expression` itself rather than using an evaluated value.
 * @param {object} attribute - the parsed attribute descriptor (expression, modifiers, etc.).
 * @param {Component} component - the owning component instance, used to evaluate the items expression against its data.
 * @param {object} [additionalHelperVariables] - loop variables from an enclosing u-each clone, so nested loops can resolve the parent item (e.g. `product in category.products`).
 */
directive('each', (el, output, attribute, component, additionalHelperVariables = {}) => {
  const {expression} = attribute;
  if (typeof expression !== 'string') {
    return;
  }

  const { item, index, items, join } = parseEachExpression(expression);

  const { magicVariables, otherVariables } = splitMagicVariables(additionalHelperVariables);

  // Resolves "items" against the component's data; a nested u-each's parent item is available via otherVariables.
  let dataItems;

  if (Number.isInteger(+items)) {
    dataItems = Array.from({length: +items}, (_, i) => i + 1);
  } else {
    try {
      dataItems = saferEval(`${items}`, withMagicVariables(component.scope, magicVariables), otherVariables);
    } catch (error) {
      return;
    }
  }

  if (attribute.modifiers.includes('lazy')) {
    el.setAttribute(attribute.directive, expression);
    el.removeAttribute(attribute.name);
    return;
  }

  if (el.tagName === 'TEMPLATE') {
    renderTemplate(el, dataItems, { item, index, join }, component, otherVariables);
    return;
  }

  // Remove everything already rendered, then render fresh.
  while (el.nextSibling) {
    let next = el.nextSibling;

    if (next.nodeType === Node.ELEMENT_NODE && next.hasAttribute('u-each')) {
      break;
    }

    next.remove();
  }

  Object.entries(dataItems ?? []).forEach(([key, dataItem], idx, array) => {
    const clone = el.cloneNode(true);

    clone.removeAttribute('u-each');

    (async () => {
      clone.__x_for_data = {...otherVariables, [item]: dataItem, [index]: toLoopKey(key)};

      await component.initialize(clone);

      el.parentNode.appendChild(clone);
      if (array[idx + 1] && join) {
        clone.insertAdjacentText('afterend', join);
      }
    })();
  });
});

/**
 * Converts an "Object.entries()" key to a number when it's numeric, keeping it a string otherwise.
 *
 * @param {string} key
 * @returns {number|string}
 */
function toLoopKey(key) {
  // "+key || key" would wrongly fall back to "0" for the first entry since 0 is falsy; only fall back when the key truly isn't numeric.
  const numericKey = +key;

  return Number.isNaN(numericKey) ? key : numericKey;
}

/**
 * Renders every root node of a "<template>"'s content per item, inserted after the template in order.
 * Rendered nodes are tracked on "el.__x_each_nodes", so a re-render removes only this loop's own output.
 */
function renderTemplate(el, dataItems, { item, index, join }, component, otherVariables) {
  el.__x_each_nodes?.forEach(node => node.remove());

  const rendered = el.__x_each_nodes = [];

  Object.entries(dataItems ?? []).forEach(([key, dataItem], idx, array) => {
    const nodes    = [...el.content.cloneNode(true).childNodes];
    const elements = nodes.filter(node => node.nodeType === Node.ELEMENT_NODE);

    elements.forEach(node => {
      node.__x_for_data = {...otherVariables, [item]: dataItem, [index]: toLoopKey(key)};
    });

    (async () => {
      await Promise.all(elements.map(node => component.initialize(node)));

      // A newer render already replaced this one, so its nodes must not reach the DOM.
      if (el.__x_each_nodes !== rendered || !el.parentNode) {
        return;
      }

      if (array[idx + 1] && join) {
        nodes.push(document.createTextNode(join));
      }

      (rendered.at(-1) ?? el).after(...nodes);
      rendered.push(...nodes);
    })();
  });
}
