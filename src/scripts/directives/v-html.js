import { directive } from '../directives';

/**
 * Sets the element's HTML content from the bound expression: markup in the value is parsed
 * into real DOM nodes, without escaping. Only use this with trusted content.
 *
 * @param {HTMLElement} el
 * @param {*} output - the directive attribute's expression, evaluated against the component's data.
 * @param {object} attribute - the parsed attribute descriptor (directive name, modifiers, raw expression, etc. — see parseAttribute in ../attributes).
 * @param {Component} component - the owning component instance.
 */
directive('html', (el, output, attribute, component) => {
  output = output ?? '';

  // Skip elements whose markup didn't actually change (cached raw input, since the browser can re-serialize markup differently than it was written), so unrelated refreshes don't disrupt content.
  if (el._x_html === output) {
    return;
  }

  el._x_html = output;
  el.innerHTML = output;
});
