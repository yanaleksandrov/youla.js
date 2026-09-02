// The "switcher" control — a checkbox toggle. Fully static markup (control/switcher/index.html);
// "name" comes from the closest ".editrix-field" wrapper's "data-name" (controls/base.js's field()).

import { fieldName } from '../../controls/base';

export function createSwitcherControl() {
  return {
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
