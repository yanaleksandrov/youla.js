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

    // A color swatch. v-bind="e.color('accent_color')" on an <input type="color"> inside a
    // field(..., { type: 'color', default: '#000000' }) wrapper — a native picker stands in for
    // Elementor's full color picker (palette + alpha channel) for now; the value shape (a hex
    // string) stays the same when that's swapped in later.
    color(name) {
      return {
        ':value'() {
          return this.getValue(name) ?? '#000000';
        },
        ':disabled'() {
          return !!this._controls[name]?.disabled;
        },
        '@input'(e) {
          this.setValue(name, e.target.value);
        },
      };
    },
  };
}
