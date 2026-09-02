/**
 * The "text" control — a plain text <input>, dispatched by CONTROL_RENDERERS.text (controls/render.js).
 */

import { cloneTemplateFragment } from '../../controls/template';

export function renderText(name) {
  const el = cloneTemplateFragment('editrix-control-text');
  el.querySelector('input').setAttribute('v-bind', `e.text(${JSON.stringify(name)})`);
  return el;
}

export function createTextControl() {
  return {
    // v-bind="e.text(name)" on a plain text <input>.
    text(name) {
      return {
        ':value'() {
          return this.getValue(name) ?? '';
        },
        ':placeholder'() {
          return this._controls[name]?.placeholder ?? '';
        },
        '@input'(e) {
          this.setValue(name, e.target.value);
        },
      };
    },
  };
}
