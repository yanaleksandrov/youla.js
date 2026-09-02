/**
 * The "switcher" control — a checkbox toggle, dispatched by CONTROL_RENDERERS.switcher (controls/render.js).
 */

import { cloneTemplateFragment } from '../../controls/template';

export function renderSwitcher(name) {
  const el = cloneTemplateFragment('editrix-control-switcher');
  el.querySelector('input').setAttribute('v-bind', `e.switcher(${JSON.stringify(name)})`);
  return el;
}

export function createSwitcherControl() {
  return {
    // v-bind="e.switcher(name)" on a checkbox <input>.
    switcher(name) {
      return {
        ':checked'() {
          return !!this.getValue(name);
        },
        '@change'(e) {
          this.setValue(name, e.target.checked);
        },
      };
    },
  };
}
