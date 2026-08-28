/**
 * The control system's shared core: the settings/definition registry, condition/responsive
 * resolution, and the wrapper chrome (label/tooltip/description) every control type is built on.
 *
 * Youla.js has no component-rendering system — directives/`v-bind` only ever react over markup
 * that's already on the page, they can't generate it. So unlike Elementor (whose PHP/JS renders
 * a control's markup from its config), a control here is real HTML wired up with `v-bind` — either
 * hand-written directly in a view, or (sections/sidebar.html's "Content" tab) cloned at runtime
 * from a `<template>` and wired the same way (see controls/render.js). What this module (and
 * data.js/multi-value.js/unit.js) provides is the reusable *behavior* every control type is
 * composed from, so the actual amount of markup+JS per control stays small, and adding a new
 * control type never means duplicating the label/tooltip/description/condition/responsive plumbing.
 *
 * A control's "definition" (label, tooltip, description, default, condition, disabled,
 * responsive, plus whatever the control type itself needs — e.g. `options` for select()) is
 * whatever object literal is passed as a control factory's second argument, right there in
 * markup: `v-bind="e.text('title', { label: 'Title', default: 'Untitled' })"`. Its *value* lives
 * separately, in `settings[name]`, exactly like Elementor's `element.getSettings()`.
 *
 * @returns {Object} Properties/methods to spread into `Youla.data('editrix', () => ({ ... }))`.
 */

// The CSS length units every unit control's <select> offers — see unitSelect() and "units" below.
const CONTROL_UNITS = ['px', '%', 'em', 'rem', 'vw', 'vh'];

export function createControlsBase() {
  return {
    // Every control's definition, keyed by name — refreshed on every render (so a dynamic
    // `condition`/`disabled`/`label` stays live), populated by registerControl() below. Treat as
    // read-only; go through getValue()/setValue()/isConditionMet() instead of reading it directly.
    _controls: {},

    // Every control's current value, keyed by name — Elementor calls this "settings". A
    // responsive control's entry is itself keyed by device ({desktop, tablet, mobile}); use
    // getValue()/setValue() rather than reading/writing this directly, so callers never need to
    // care whether a given control happens to be responsive.
    settings: {},

    // Which breakpoint a `responsive: true` control currently reads/writes — matches Elementor's
    // single device switcher in its editor toolbar, one for the whole panel rather than one per
    // field. Fixed at 'desktop' for now (no switcher UI exists yet); getValue()/setValue() already
    // key off it, so a control declaring `responsive: true` keeps working once one is added.
    responsiveDevice: 'desktop',

    // The CSS length units every unit control's <select> offers — v-each="unit in units" (see
    // sections/sidebar.html's field template library), so unitSelect() and its markup share one
    // source of truth.
    units: CONTROL_UNITS,

    /**
     * Registers/refreshes "name"'s control definition, and seeds its value's default the first
     * time it's used. field() (below) is the only caller — every control instance registers once,
     * on its wrapper — so a control's config lives entirely where it's written in markup, with no
     * separate schema to keep in sync, while still supporting a `condition`/`disabled`/`label`
     * that changes at runtime.
     *
     * @param {string} name - The setting's key, unique across the whole panel.
     * @param {string} type - The control type (used for the `editrix-field--<type>` class).
     * @param {Object} [options] - label/tooltip/description/default/condition/disabled/responsive,
     *   plus whatever the control type itself reads off its own definition (e.g. `min`/`max`/`step`
     *   for slider(), `options` for select()).
     * @returns {Object} The definition, for the calling factory's own use.
     */
    registerControl(name, type, options = {}) {
      const def = { name, type, ...options };

      // resolveAttributes() re-evaluates every v-bind expression — and so calls this — on every
      // refresh pass, by design (see docs/v-bind.html's tabButton() example). _controls is part
      // of the reactive data (so plain markup expressions like "_controls['align'].options" can
      // read it), which means writing it unconditionally here would count as a change on every
      // single pass, triggering the very refresh that just called it — forever. Comparing first
      // breaks that loop: a write (and the refresh it schedules) only happens when something in
      // the definition actually changed.
      if (JSON.stringify(this._controls[name]) !== JSON.stringify(def)) {
        this._controls[name] = def;
      }

      if (this.settings[name] === undefined) {
        this.settings[name] = def.responsive ? {} : def.default;
      }
      return def;
    },

    /**
     * Reads a control's current value, resolving the active device first if it's responsive.
     *
     * @param {string} name
     * @returns {*}
     */
    getValue(name) {
      const def = this._controls[name];
      const raw = this.settings[name];

      if (def?.responsive) {
        const value = (raw || {})[this.responsiveDevice];
        return value !== undefined ? value : def.default;
      }
      return raw !== undefined ? raw : def?.default;
    },

    /**
     * Writes a control's current value, scoped to the active device first if it's responsive.
     *
     * @param {string} name
     * @param {*} value
     */
    setValue(name, value) {
      const def = this._controls[name];

      if (def?.responsive) {
        this.settings[name] = { ...(this.settings[name] || {}), [this.responsiveDevice]: value };
      } else {
        this.settings[name] = value;
      }
    },

    /**
     * Merges a patch into an object-valued control's current value — url()/media()/dimensions()
     * and friends all store `{ ...several named fields }`, so a change to just one of them (e.g.
     * dragging the "top" side of a dimensions control) shouldn't clobber the others.
     *
     * @param {string} name
     * @param {Object} patch
     */
    patchValue(name, patch) {
      this.setValue(name, { ...this.getValue(name), ...patch });
    },

    /**
     * Elementor-style condition check, as used by a control's `condition` option: every key must
     * match — an array means "one of these"; a trailing "!" on the key negates that key's check;
     * an `undefined` expected value just means "is truthy". `{}`/`null`/`undefined` always passes.
     *
     * @param {Object} [condition] - e.g. `{ show_icon: true }`, `{ 'unit!': 'custom' }`.
     * @returns {boolean}
     */
    isConditionMet(condition) {
      if (!condition) {
        return true;
      }

      return Object.entries(condition).every(([key, expected]) => {
        const negate = key.endsWith('!');
        const actual = this.getValue(negate ? key.slice(0, -1) : key);
        const matches = Array.isArray(expected)
          ? expected.includes(actual)
          : expected === undefined ? !!actual : actual === expected;

        return negate ? !matches : matches;
      });
    },

    /**
     * The one reusable template every control is built from — v-bind="e.field('title', 'Title',
     * 'Helper text', { type: 'text', default: 'Untitled', ... })" on a control's outer
     * `.editrix-field`, with the control's own markup (an <input>, a compound control's several
     * parts, ...) as its children, plus a `v-bind="e.fieldTooltip('title')"` icon for the
     * tooltip — see below. Registers the control (so this must run before anything else reads
     * `name`, which is exactly why it belongs on the wrapper — the parent, walked before its
     * children — rather than on the control's own field element).
     *
     * Renders the title via CSS (`.editrix-field:before { content: attr(data-title) }`, the same
     * `data-title` convention controls/borders.scss already uses) rather than a separate label
     * element — entirely optional: given no title, nothing renders (an empty `data-title`
     * produces no `:before` content).
     *
     * @param {string} name - The setting's key, unique across the whole panel.
     * @param {string} [title] - The control's label, shown above (or, for switcher/popover_toggle,
     *   beside) its field.
     * @param {string} [tooltip] - Extra help text, shown by fieldTooltip()'s icon on click.
     * @param {Object} [options] - type/default/condition/disabled/responsive/description, plus
     *   whatever the control type itself reads off its own definition.
     * @returns {Object} The wrapper's bindings.
     */
    field(name, title, tooltip, options = {}) {
      this.registerControl(name, options.type || 'field', { label: title, tooltip, ...options });

      return {
        'v-show'() {
          return this.isConditionMet(this._controls[name]?.condition);
        },
        ':class'() {
          const def = this._controls[name];
          return {
            [`editrix-field--${def?.type}`]: true,
            'is-disabled': !!def?.disabled,
          };
        },
        ':data-title'() {
          return this._controls[name]?.label || '';
        },
      };
    },

    // v-bind="e.fieldTooltip('title')" on the small "?" icon next to a control's title — reuses
    // the existing `v-tooltip` directive (youla-tooltip.js), triggered by `.click` (not the
    // directive's default hover) since the icon itself is the click target; hidden entirely when
    // no tooltip text is given.
    fieldTooltip(name) {
      return {
        'v-show'() {
          return !!this._controls[name]?.tooltip;
        },
        'v-tooltip.click'() {
          return this._controls[name]?.tooltip;
        },
      };
    },

    // v-bind="e.fieldDescription('title')" on `.editrix-field__description`, below the field —
    // hidden entirely when no description is given.
    fieldDescription(name) {
      return {
        'v-show'() {
          return !!this._controls[name]?.description;
        },
        'v-text'() {
          return this._controls[name]?.description;
        },
      };
    },

    // --- Compound values: shared by every multi-value/unit control (url, media, dimensions, ---
    // --- slider, ...), whose setting is one object with several named parts. A compound       ---
    // --- control's wrapper is just field(name, title, tooltip, { type: 'url', default: {...} }) ---
    // --- like any other — its parts (below) are what set it apart, not a separate registration. ---

    // v-bind="e.part('link', 'url')" on a text-like input for one part of a compound value.
    part(name, key) {
      return {
        ':value'() {
          return (this.getValue(name) || {})[key] ?? '';
        },
        '@input'(e) {
          this.patchValue(name, { [key]: e.target.value });
        },
      };
    },

    // v-bind="e.partNumber('box_shadow', 'blur')" on a number input for one numeric part.
    partNumber(name, key) {
      return {
        ':value'() {
          return (this.getValue(name) || {})[key] ?? 0;
        },
        '@input'(e) {
          this.patchValue(name, { [key]: parseFloat(e.target.value) || 0 });
        },
      };
    },

    // v-bind="e.partSwitch('link', 'is_external')" on a checkbox for one boolean part.
    partSwitch(name, key) {
      return {
        ':checked'() {
          return !!(this.getValue(name) || {})[key];
        },
        '@change'(e) {
          this.patchValue(name, { [key]: e.target.checked });
        },
      };
    },

    // v-bind="e.unitSelect('gap')" on the unit <select> a slider/dimensions/gaps control shares —
    // the same handful of CSS length units, so a control just brings its own value/min/max.
    unitSelect(name) {
      return {
        ':value'() {
          return (this.getValue(name) || {}).unit ?? 'px';
        },
        '@change'(e) {
          this.patchValue(name, { unit: e.target.value });
        },
      };
    },

    // v-bind="e.linkedNumber('padding', 'top', ['top','right','bottom','left'])" on one side's
    // number input, for a compound value with an `isLinked` flag (dimensions/gaps): while linked,
    // editing any one part updates every part in "allKeys" together; unlinked, only its own part.
    linkedNumber(name, key, allKeys) {
      return {
        ':value'() {
          return (this.getValue(name) || {})[key] ?? 0;
        },
        '@input'(e) {
          const value = parseFloat(e.target.value) || 0;
          const current = this.getValue(name) || {};

          this.patchValue(name, current.isLinked
            ? Object.fromEntries(allKeys.map((k) => [k, value]))
            : { [key]: value });
        },
      };
    },

    // v-bind="e.linkToggle('padding')" on the link/unlink button paired with linkedNumber() above.
    linkToggle(name) {
      return {
        ':class'() {
          return {
            'is-linked': !!(this.getValue(name) || {}).isLinked
          };
        },
        '@click'() {
          this.patchValue(name, { isLinked: !(this.getValue(name) || {}).isLinked });
        },
      };
    },
  };
}
