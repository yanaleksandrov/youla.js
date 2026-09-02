/**
 * The "color" control — Figma-style swatch + hex + alpha (v-filler), dispatched by
 * CONTROL_RENDERERS.color (controls/render.js).
 */

import { cloneTemplateFragment } from '../../controls/template';

export function renderColor(name) {
  const el = cloneTemplateFragment('editrix-control-color');
  el.querySelector('input').setAttribute('v-bind', `e.color(${JSON.stringify(name)})`);
  return el;
}

export function createColorControl() {
  return {
    // v-bind="e.color(name)" — locked to solid color; replaces the old native <input type="color">, which has no alpha or palette.
    color(name) {
      return {
        'v-filler'() {
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
