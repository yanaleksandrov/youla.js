/**
 * "Data" controls — plain-value fields (as opposed to the multi-value/unit controls in the
 * sibling files, whose value is itself a small object). Phase 1 ships text/switcher/select/color;
 * the rest of the list (number, textarea, wysiwyg, code, hidden, popover_toggle, select2, choose,
 * visual_choice, font, date_time, gallery, repeater, animation, exit_animation, hover_animation)
 * follow the same pattern once this one's reviewed.
 *
 * Every factory here is just the field element's own bindings (value/checked, its change handler,
 * disabled) built on getValue()/setValue() — never `v-prop`, since a `settings` value can be
 * responsive (device-keyed) and `v-prop` only ever targets one fixed path. Registration itself
 * happens once, on the control's wrapper — see base.js's field() — so by the time any of these
 * run, `name` is already registered.
 */
export function createDataControls() {
  return {
    // A plain text input. v-bind="e.text('title')" on an <input> inside a
    // field('title', ..., { type: 'text', ... }) wrapper.
    text(name) {
      return {
        ':value'() {
          return this.getValue(name) ?? '';
        },
        ':placeholder'() {
          return this._controls[name]?.placeholder ?? '';
        },
        ':disabled'() {
          return !!this._controls[name]?.disabled;
        },
        '@input'(e) {
          this.setValue(name, e.target.value);
        },
      };
    },

    // A boolean toggle switch. v-bind="e.switcher('show_icon')" on an <input type="checkbox">
    // inside a field(..., { type: 'switcher', default: false }) wrapper.
    switcher(name) {
      return {
        ':checked'() {
          return !!this.getValue(name);
        },
        ':disabled'() {
          return !!this._controls[name]?.disabled;
        },
        '@change'(e) {
          this.setValue(name, e.target.checked);
        },
      };
    },

    /**
     * A single-select dropdown. `v-bind="e.select('align')"` on a `<select>`; `<option>`s are
     * written by hand (see sections/sidebar.html's "#editrix-control-select" template) rather than
     * `v-each`'d from `options` — `v-each`'s
     * own dependency check is a plain substring match against its raw expression text (see
     * directives/v-each.js's `computeOutput()` case), so a loop reading `_controls['align']...`
     * would re-match (and destructively re-render) on *every* write to "align", including the
     * value changing on every selection — undoing the very update that just landed. Pass
     * `options` (`{ value: label }`) to `field()` anyway — Elementor-style, one source of truth
     * for what the field means — even though this control doesn't render option markup from it.
     */
    select(name) {
      return {
        ':value'() {
          return this.getValue(name) ?? '';
        },
        ':disabled'() {
          return !!this._controls[name]?.disabled;
        },
        '@change'(e) {
          this.setValue(name, e.target.value);
        },
      };
    },

    // A color swatch — the same Figma-style swatch + hex field + alpha drag as the "fill" control's
    // own rows (youla-filler.js), locked to solid color only. v-bind="e.color('accent_color')" on
    // a plain <input type="text"> inside a field(..., { type: 'color', default: '#000000' })
    // wrapper. Replaces the native <input type="color"> this control used to render — a browser
    // picker has no alpha channel or palette, and was only ever meant as a placeholder for this.
    color(name) {
      return {
        'v-filler'() {
          // v-filler reads the <input>'s own "value" only once, at construction (see Filler's
          // constructor, youla-filler.js) — the framework never gives this control's own
          // <template> a chance to know the field's current value before v-filler mounts, so seed
          // it here instead, the same one-time convention controls/fill.js's createFillItem() uses
          // for its own row inputs. Guarded on "_x_filler" so it never fights the mounted widget's
          // own state afterward (update() doesn't re-read "value" anyway, but the intent should
          // read as "seed once", not "keep resetting").
          if (!this.$el._x_filler) {
            this.$el.value = this.getValue(name) ?? '#000000';
          }

          return {
            sources: ['solid'],
            disabled: !!this._controls[name]?.disabled,
            onChange: (hex) => this.setValue(name, hex),
          };
        },
      };
    },
  };
}
