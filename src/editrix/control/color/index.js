/**
 * The "color" control — Figma-style swatch + hex + alpha (v-filler), cloned from
 * "editrix-control-color" by convention (controls/render.js's renderField(), no renderer registered
 * for "color"). Its own binding is fully static (control/color/index.html) — "name" comes from the
 * closest ".editrix-field" wrapper's own "data-name" (controls/base.js's field()), not an argument.
 * (control/repeater/index.js reuses this same template for its own "color"/"fill" item fields,
 * overwriting this "v-bind" with its own "e.repeaterField(...)" — see createRepeaterFieldControl()'s
 * own comment.)
 */

import { fieldName } from '../../controls/base';

export function createColorControl() {
  return {
    // v-bind="e.color()" — locked to solid color; replaces the old native <input type="color">, which has no alpha or palette.
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
