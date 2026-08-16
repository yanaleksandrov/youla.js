import { directive } from '../directives';

/**
 * Toggles the element's visibility via its inline `display` style, without
 * removing it from the DOM. Also keeps the `hidden` attribute in sync so the
 * "author `hidden` up front" flicker-prevention pattern keeps working.
 *
 * @param {HTMLElement} el
 * @param {*} output - the directive attribute's expression, evaluated against the component's data; truthy shows the element.
 * @param {object} attribute - the parsed attribute descriptor (directive name, modifiers, raw expression, etc. — see parseAttribute in ../helpers).
 * @param {Component} component - the owning component instance.
 */
directive('show', (el, output, attribute, component) => {
  // Cache the element's original inline "display" once, before we ever touch it,
  // so showing it back doesn't force "block" over an inline flex/grid/etc value.
  if (el._x_originalDisplay === undefined) {
    el._x_originalDisplay = el.style.display === 'none' ? '' : el.style.display;
  }

  el.style.display = output ? el._x_originalDisplay : 'none';

  // Keep the "hidden" attribute in sync so the flicker-prevention pattern
  // (authoring "hidden" up front, backed by a "[hidden]{display:none!important}"
  // rule) doesn't get stuck hiding the element once it's meant to be shown.
  el.toggleAttribute('hidden', !output);
});
