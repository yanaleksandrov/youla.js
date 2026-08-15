import { directive } from '../directives';

directive('show', (el, output, attribute, component) => {
  // Trust whatever the server already rendered on first paint (no flicker) and
  // only start actively toggling once bound data actually changes.
  if (attribute.modifiers.includes('lazy')) {
    el.setAttribute(attribute.directive, attribute.expression);
    el.removeAttribute(attribute.name);
    return;
  }

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
