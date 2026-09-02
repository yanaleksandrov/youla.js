// The "color" control — Figma-style swatch + hex + alpha (v-filler). Fully static markup
// (control/color/index.html); "name" comes from the closest ".editrix-field" wrapper's "data-name".
// Reused by control/repeater's own "color"/"fill" item fields, which overwrite this "v-bind".

import { fieldName } from '../../controls/base';

export function createColorControl() {
  return {
    color() {
      return {
        'v-filler'() {
          const name = fieldName(this.$el);

          // Seed the input's value once, before v-filler mounts (it never reads the framework's own value) — guarded so it doesn't fight the mounted widget afterward.
          if (!this.$el._x_filler) {
            this.$el.value = this.getValue(name) ?? '#000000';
          }

          return {
            sources: ['solid'],
            onChange: (hex) => this.setValue(name, hex),
          };
        },
      };
    },
  };
}
