import { directive } from '../directives';

/**
 * Sets the element's HTML content from the bound expression: markup in the value is parsed
 * into real DOM nodes, without escaping. Only use this with trusted content.
 *
 * @param {HTMLElement} el
 * @param {*} output - the directive attribute's expression, evaluated against the component's data.
 * @param {object} attribute - the parsed attribute descriptor (directive name, modifiers, raw expression, etc. — see parseAttribute in ../helpers).
 * @param {Component} component - the owning component instance.
 */
directive('html', (el, output, attribute, component) => {
  output = output ?? '';

  // Skip elements whose markup didn't actually change, so unrelated refreshes
  // don't tear down and rebuild content that's holding focus, playing media, etc.
  // Cache the raw input rather than comparing against el.innerHTML, since the
  // browser can re-serialize markup differently than it was written.
  if (el._x_html === output) {
    return;
  }

  el._x_html = output;
  el.innerHTML = output;
});
