import { directive } from '../directives';

/**
 * Sets the element's HTML content from the bound expression: markup in the value is parsed
 * into real DOM nodes, without escaping. Only use this with trusted content.
 *
 * @param {HTMLElement} el
 * @param {*} output - the directive attribute's expression, evaluated against the component's data.
 * @param {object} attribute - the parsed attribute descriptor (name, modifiers, expression).
 * @param {Component} component - the owning component instance.
 */
directive('html', (el, output, attribute, component) => {
  output = output ?? '';

  // Cached raw input, since the browser can re-serialize markup differently than written; skip if unchanged.
  if (el._x_html === output) {
    return;
  }

  el._x_html = output;
  el.innerHTML = output;
});
