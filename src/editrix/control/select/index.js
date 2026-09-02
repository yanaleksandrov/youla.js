/**
 * The "select" control — a single-select dropdown, cloned from "editrix-control-select" by
 * convention (controls/render.js's renderField(), no renderer registered for "select"). Its whole
 * binding is one static "v-bind" (control/select/index.html) — "name" comes from the closest
 * ".editrix-field" wrapper's own "data-name" (controls/base.js's field()).
 */

import { fieldName } from '../../controls/base';

export function createSelectControl() {
  return {
    // v-bind="e.select()" on the <select> itself.
    select() {
      return {
        ':value'() {
          return this.getValue(fieldName(this.$el)) ?? '';
        },
        '@change'(e) {
          this.setValue(fieldName(this.$el), e.target.value);
        },

        // "@load" fires once, synchronously, right when this element mounts — builds this field's
        // own <option>s here, imperatively, off its declared "options" map (an { value: label } map,
        // off the field's own static config). Not v-each'd like sidebar.html's `unit in units`:
        // "options" differs per field, but ":value"/"@change" above still change on every selection,
        // and v-each's dependency tracking would rebuild (and reset) the whole list on every one of those.
        '@load'() {
          const options = this._controls[fieldName(this.$el)]?.options || {};

          Object.entries(options).forEach(([value, label]) => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = label;
            this.$el.append(option);
          });
        },
      };
    },
  };
}
