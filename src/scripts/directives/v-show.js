import { directive } from '../directives';

/**
 * Toggles the element's visibility via its inline `display` style, without
 * removing it from the DOM. Also keeps the `hidden` attribute in sync so the
 * "author `hidden` up front" flicker-prevention pattern keeps working.
 *
 * @param {HTMLElement} el
 * @param {*} output - the directive attribute's expression, evaluated against the component's data; truthy shows the element.
 * @param {object} attribute - the parsed attribute descriptor (name, modifiers, expression).
 * @param {Component} component - the owning component instance.
 */
directive('show', (el, output, attribute, component) => {
  // Cache the original inline display once, so re-showing doesn't force "block" over a flex/grid/etc value.
  if (el._x_originalDisplay === undefined) {
    el._x_originalDisplay = el.style.display === 'none' ? '' : el.style.display;
  }

  el.style.display = output ? el._x_originalDisplay : 'none';

  // Keep "hidden" in sync so the flicker-prevention pattern doesn't get stuck hiding a shown element.
  el.toggleAttribute('hidden', !output);
});
