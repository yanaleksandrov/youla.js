/**
 * "Data" controls — plain-value fields, as opposed to the multi-value/unit controls in the sibling
 * files whose value is itself a small object. Phase 1 ships text/switcher/select/color; more types
 * follow the same pattern. Registration happens once, on the control's wrapper (base.js's field()).
 */
export function createDataControls() {
  return {
    // v-bind="e.text(name)" on a plain text <input>.
    text(name) {
      return {
        ':value'() {
          return this.getValue(name) ?? '';
        },
        ':placeholder'() {
          return this._controls[name]?.placeholder ?? '';
        },
        '@input'(e) {
          this.setValue(name, e.target.value);
        },
      };
    },

    // v-bind="e.switcher(name)" on a checkbox <input>.
    switcher(name) {
      return {
        ':checked'() {
          return !!this.getValue(name);
        },
        '@change'(e) {
          this.setValue(name, e.target.checked);
        },
      };
    },

    /**
     * A single-select dropdown. `<option>`s are built once, imperatively, from the field's own
     * declared `options` map (controls/render.js's CONTROL_RENDERERS.select) rather than `v-each`'d —
     * v-each's dependency check would re-render (and reset) the list on every selection change.
     */
    select(name) {
      return {
        ':value'() {
          return this.getValue(name) ?? '';
        },
        '@change'(e) {
          this.setValue(name, e.target.value);
        },
      };
    },

    // v-bind="e.color(name)" — Figma-style swatch + hex + alpha (v-filler), locked to solid color; replaces the old native <input type="color">, which has no alpha or palette.
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
