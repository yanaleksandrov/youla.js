/**
 * The "switcher" control — a checkbox toggle, cloned from "editrix-control-switcher" by convention
 * (controls/render.js's renderField(), no renderer registered for "switcher"). Its own binding is
 * fully static (control/switcher/index.html) — "name" comes from the closest ".editrix-field"
 * wrapper's own "data-name" (controls/base.js's field()), not an argument.
 */

import { fieldName } from '../../controls/base';

export function createSwitcherControl() {
  return {
    // v-bind="e.switcher()" on a checkbox <input>.
    switcher() {
      return {
        ':checked'() {
          return !!this.getValue(fieldName(this.$el));
        },
        '@change'(e) {
          this.setValue(fieldName(this.$el), e.target.checked);
        },
      };
    },
  };
}
