/**
 * The "text" control — a plain text <input>, cloned from "editrix-control-text" by convention
 * (controls/render.js's renderField(), no renderer registered for "text"). Its own binding is fully
 * static (control/text/index.html) — "name" comes from the closest ".editrix-field" wrapper's own
 * "data-name" (controls/base.js's field()), not an argument.
 */

import { fieldName } from '../../controls/base';

export function createTextControl() {
  return {
    // v-bind="e.text()" on a plain text <input>.
    text() {
      return {
        ':value'() {
          return this.getValue(fieldName(this.$el)) ?? '';
        },
        ':placeholder'() {
          return this._controls[fieldName(this.$el)]?.placeholder ?? '';
        },
        '@input'(e) {
          this.setValue(fieldName(this.$el), e.target.value);
        },
      };
    },
  };
}
