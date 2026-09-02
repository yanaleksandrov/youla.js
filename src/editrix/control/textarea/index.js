// Toolbox > generic multi-line text control (e.g. the "Page" panel's title). Reads/writes a
// top-level property directly (this[name]), not getValue()/setValue() — the toolbox stays visible
// regardless of the active block, so per-block settings would write into the wrong one.

import { fieldName } from '../../controls/base';

export function createTextareaControl() {
  return {
    /**
     * v-bind="e.textarea()" on the <textarea> itself.
     */
    textarea() {
      return {
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
