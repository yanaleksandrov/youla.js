import { directive } from '../directives';
import { saferEval } from '../eval';
import { withMagicVariables, splitMagicVariables } from '../magic-variables';
import { getElementMethods } from '../methods';
import { toRaw } from '../reactivity';
import { hasDirective } from '../dom';

const EACH_EXPRESSION = /^\(?([\w]+)(?:,\s*(\w+))?\)?\s+in\s+(.*?)(?:\s+join\s+'([^']+)')?$/;

// Loop templates already warned about, so a refresh doesn't repeat the warning.
const warnedShadowing = new WeakSet();

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
 * On a `<template>`, its inert content is rendered instead of the element itself. Nodes are reused
 * across renders, matched by `u-key` (or `:key`) or, without it, by item identity.
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

  // Mirrors a "u-bind"/self expression as a real attribute, so CSS hides the template and domWalk() stops at it; clones drop it again.
  if (el.tagName !== 'TEMPLATE' && attribute.name === 'u-each') {
    el.setAttribute('u-each', expression);
  }

  const { item, index, items, join } = parseEachExpression(expression);

  if (!warnedShadowing.has(el)) {
    warnedShadowing.add(el);
    [item, index].filter(name => name && name in component.scope).forEach(name => {
      console.warn(`Youla.js: loop variable "${name}" in u-each="${expression}" shadows "${name}" of the component data.`);
    });
  }

  const { magicVariables, otherVariables } = splitMagicVariables(additionalHelperVariables);

  const context = withMagicVariables(component.scope, magicVariables, getElementMethods(el, component));

  // Resolves "items" against the component's data; a nested u-each's parent item is available via otherVariables.
  let dataItems;

  if (Number.isInteger(+items)) {
    dataItems = Array.from({length: +items}, (_, i) => i + 1);
  } else {
    try {
      dataItems = saferEval(`${items}`, context, otherVariables);
    } catch (error) {
      return;
    }
  }

  if (attribute.modifiers.includes('lazy')) {
    el.setAttribute(attribute.directive, expression);
    el.removeAttribute(attribute.name);
    return;
  }

  const keyExpression = el.getAttribute('u-key') ?? el.getAttribute(':key');

  // Without "u-key" an item is matched by identity: the same object, or the same primitive value.
  render(el, dataItems, { item, index, join }, component, otherVariables, (variables) => {
    if (!keyExpression) {
      return toRaw(variables[item]);
    }
    try {
      return saferEval(keyExpression, context, variables);
    } catch (error) {
      return undefined;
    }
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
 * Clones one item's nodes: the "<template>"'s content roots, or the loop element itself.
 *
 * @returns {{nodes: Node[], elements: HTMLElement[]}}
 */
function cloneItem(el) {
  if (el.tagName === 'TEMPLATE') {
    const nodes = [...el.content.cloneNode(true).childNodes];

    return { nodes, elements: nodes.filter(node => node.nodeType === Node.ELEMENT_NODE) };
  }

  const clone = el.cloneNode(true);

  ['u-each', 'u-key', ':key'].forEach(name => clone.removeAttribute(name));

  return { nodes: [clone], elements: [clone] };
}

/**
 * Marks a reused node's subtree so the ongoing refresh re-runs all of its bindings with the new loop variables.
 */
function markForRefresh(node) {
  if (node.__x && node.__x.root === node) {
    node.__x.refresh(true);
    return;
  }

  node.__x_force_refresh = true;
  node.querySelectorAll('*').forEach(child => child.__x_force_refresh = true);
}

/**
 * Renders items by key: nodes of an existing key stay in the DOM and are updated and reordered in place,
 * new keys are cloned and initialized, vanished keys are removed.
 */
function render(el, dataItems, { item, index, join }, component, otherVariables, getKey) {
  const previous = el.__x_each_entries;
  const entries  = new Map();
  const ordered  = [];
  const created  = [];

  // The first render replaces whatever the server left after a non-template loop element.
  if (!previous && el.tagName !== 'TEMPLATE') {
    while (el.nextSibling && !(el.nextSibling.nodeType === Node.ELEMENT_NODE && el.nextSibling.hasAttribute('u-each'))) {
      el.nextSibling.remove();
    }
  }

  Object.entries(dataItems ?? []).forEach(([rawKey, dataItem]) => {
    const forData = {...otherVariables, [item]: dataItem, [index]: toLoopKey(rawKey)};
    const key     = getKey(forData);

    if (entries.has(key)) {
      console.warn(`Youla.js: duplicate key "${key}" in u-each, the item is rendered without reuse.`);
    }

    let entry = !entries.has(key) && previous?.get(key);

    if (entry) {
      entry.elements.forEach(node => {
        node.__x_for_data = forData;
        markForRefresh(node);
      });
    } else {
      entry = cloneItem(el);
      entry.elements.forEach(node => {
        node.__x_for_data = forData;
        node.__x_each_clone = true;
      });
      entry.elements.forEach(node => component.initialize(node));
      created.push(...entry.elements);
    }

    if (!entries.has(key)) {
      entries.set(key, entry);
    }
    ordered.push(entry);
  });

  const nodes = ordered.flatMap((entry, idx) => {
    return join && idx < ordered.length - 1 ? [...entry.nodes, document.createTextNode(join)] : entry.nodes;
  });

  // Covers vanished keys, duplicates and old separators alike.
  const kept = new Set(nodes);
  el.__x_each_nodes?.forEach(node => kept.has(node) || node.remove());

  // Only out-of-place nodes are moved, so reused nodes that keep their order are never detached.
  let cursor = el;
  nodes.forEach(node => {
    if (cursor.nextSibling !== node) {
      cursor.after(node);
    }
    cursor = node;
  });

  el.__x_each_entries = entries;
  el.__x_each_nodes = nodes;

  if (el.isConnected) {
    initializeNestedComponents(created, component.constructor);
  }
}

/**
 * Initializes "u-data" components inside newly inserted clones, which the page's initial discovery
 * has already passed and its mutation watcher may not have started observing yet.
 */
function initializeNestedComponents(elements, Component) {
  elements
    .flatMap(node => [node, ...node.querySelectorAll('*')])
    .filter(node => !node.__x && hasDirective(node, 'u-data'))
    .forEach(node => {
      try {
        new Component(node);
      } catch (error) {
        delete node.__x;
        console.error('Youla.js: failed to initialize component', node, error);
      }
    });
}
