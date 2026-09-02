/**
 * Toolbox > generic multi-line text control — e.g. the "Page" panel's title field. Unlike a name-
 * parametrized control like control/text, it reads/writes a top-level reactive property directly
 * (this[name]), not through getValue()/setValue() (controls/base.js): the toolbox's own section
 * stays visible regardless of which block is selected, so routing through the block-content
 * settings system (keyed by "activeBlock") would silently write the value into whichever block is
 * selected. Cloned from "editrix-control-textarea" by convention (controls/render.js's
 * renderField(), no renderer registered for "textarea") — "name" comes from the closest
 * ".editrix-field" wrapper's own "data-name" (controls/base.js's field()/fieldName()).
 */

import { fieldName } from '../../controls/base';

export function createTextareaControl() {
  return {
    // v-bind="e.textarea()" on the <textarea> itself.
    textarea() {
      return {
        // Native form-field name, matching what "v-prop" used to auto-assign (scripts/props.js's hydrateProps()) — nothing here depends on it, kept for parity.
        ':name'() {
          return fieldName(this.$el);
        },
        ':value'() {
          return this[fieldName(this.$el)] ?? '';
        },
        ':placeholder'() {
          return this._controls[fieldName(this.$el)]?.placeholder ?? '';
        },
        '@input'(e) {
          this[fieldName(this.$el)] = e.target.value;
        },
      };
    },
  };
}
