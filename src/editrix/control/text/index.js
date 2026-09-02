// The "text" control — a plain text <input>. Fully static markup (control/text/index.html); "name"
// comes from the closest ".editrix-field" wrapper's "data-name" (controls/base.js's field()).

import { fieldName } from '../../controls/base';

export function createTextControl() {
  return {
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
