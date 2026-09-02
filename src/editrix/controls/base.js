/**
 * The control system's shared core: the settings/definition registry, condition/responsive
 * resolution, and the wrapper chrome (label/tooltip/description) every control type is built on.
 *
 * A control's "definition" (label, tooltip, description, default, value, condition, responsive,
 * plus whatever the control type needs) is the object literal passed as a factory's second
 * argument, right there in markup; its *value* lives separately, in `settings[name]`.
 *
 * @returns {Object} Properties/methods to spread into `Youla.data('editrix', () => ({ ... }))`.
 */

// CSS length units every unit control's <select> offers — see unitSelect() and "units" below.
const CONTROL_UNITS = ['px', '%', 'em', 'rem', 'vw', 'vh'];

// A field's own starting point: an explicit "value" — the backend's actual current content for
// this specific field, as opposed to "default" (what a brand-new/never-edited field starts as) —
// wins wherever "default" would otherwise apply. Absent "value" (the common case — most fields
// don't carry backend content, just an authoring default), this is exactly "default".
function initialValue(def) {
  return def?.value !== undefined ? def.value : def?.default;
}

export function createControlsBase() {
  return {
    // Every control's definition, keyed by name, refreshed on every render; go through getValue()/setValue()/isConditionMet() rather than reading this directly.
    _controls: {},

    // Every block's current control values, keyed by block id (youla-editrix.js's container() via `this.activeBlock`) then control name; use getValue()/setValue() rather than reading this directly.
    settings: {},

    // Which breakpoint a `responsive: true` control currently reads/writes — fixed at 'desktop' until a device switcher exists.
    responsiveDevice: 'desktop',

    // Shared with sidebar.html's unit <select> templates (v-each="unit in units").
    units: CONTROL_UNITS,

    // Which block's settings the Content tab reads/writes; null (nothing selected yet) falls back to a shared "__page__" bucket.
    activeBlock: null,

    /**
     * The active block's own settings object, created on first use.
     *
     * @returns {Object}
     */
    blockSettings() {
      const key = this.activeBlock || '__page__';
      return this.settings[key] || (this.settings[key] = {});
    },

    /**
     * Registers/refreshes "name"'s control definition, and seeds its value (an explicit "value",
     * falling back to "default" — see initialValue() above) the first time it's used. field() is
     * the only caller — every control instance registers once, on its wrapper.
     *
     * @param {string} name - The setting's key, unique across the whole panel.
     * @param {string} type - The control type (used for the `editrix-field--<type>` class).
     * @param {Object} [options] - label/tooltip/description/default/value/condition/responsive, plus type-specific options.
     * @returns {Object} The definition, for the calling factory's own use.
     */
    registerControl(name, type, options = {}) {
      const def = { name, type, ...options };

      // Compare before writing — _controls is reactive, so an unconditional write would trigger the very refresh that just called this, forever.
      if (JSON.stringify(this._controls[name]) !== JSON.stringify(def)) {
        this._controls[name] = def;
      }

      const bucket = this.blockSettings();
      if (bucket[name] === undefined) {
        bucket[name] = def.responsive ? {} : initialValue(def);
      }
      return def;
    },

    /**
     * Reads a control's current value on the active block, resolving the active device first if
     * it's responsive.
     *
     * @param {string} name
     * @returns {*}
     */
    getValue(name) {
      const def = this._controls[name];
      const raw = this.blockSettings()[name];

      if (def?.responsive) {
        const value = (raw || {})[this.responsiveDevice];
        return value !== undefined ? value : initialValue(def);
      }
      return raw !== undefined ? raw : initialValue(def);
    },

    /**
     * Writes a control's current value on the active block, scoped to the active device first if
     * it's responsive.
     *
     * @param {string} name
     * @param {*} value
     */
    setValue(name, value) {
      const def = this._controls[name];
      const bucket = this.blockSettings();

      if (def?.responsive) {
        bucket[name] = { ...(bucket[name] || {}), [this.responsiveDevice]: value };
      } else {
        bucket[name] = value;
      }
    },

    /**
     * Merges a patch into an object-valued control's current value, so a change to one part
     * doesn't clobber the others.
     *
     * @param {string} name
     * @param {Object} patch
     */
    patchValue(name, patch) {
      this.setValue(name, { ...this.getValue(name), ...patch });
    },

    /**
     * Elementor-style condition check, as used by a control's `condition` option: every key must
     * match — an array means "one of these", a trailing "!" on the key negates it.
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
     * The one reusable template every control is built from — v-bind="e.field(...)" on a
     * control's outer `.editrix-field`, registering the control and returning its show/class/title
     * bindings; pair with `v-bind="e.fieldTooltip(name)"` for the tooltip icon.
     *
     * @param {string} name - The setting's key, unique across the whole panel.
     * @param {string} [title] - The control's label.
     * @param {string} [tooltip] - Extra help text, shown by fieldTooltip()'s icon on click.
     * @param {Object} [options] - type/default/value/condition/responsive/description, plus type-specific options.
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
          return { [`editrix-field--${def?.type}`]: true };
        },
        ':data-title'() {
          return this._controls[name]?.label || '';
        },
      };
    },

    // v-bind="e.fieldTooltip(name)" on a control's "?" icon — reuses v-tooltip, triggered on click since the icon itself is the target; hidden without tooltip text.
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

    // v-bind="e.fieldDescription(name)" on `.editrix-field__description` — hidden without a description.
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

    // v-bind="e.fieldAffix(name, 'prefix'/'suffix')" on static text glued to a control's input (e.g. slider()) — hidden unless the field declares that key.
    fieldAffix(name, key) {
      return {
        'v-show'() {
          return !!this._controls[name]?.[key];
        },
        'v-text'() {
          return this._controls[name]?.[key] || '';
        },
      };
    },

    // Compound values: shared by every multi-value/unit control (url, dimensions, slider, ...), whose setting is one object with several named parts.

    // v-bind="e.part(name, 'url')" on a text-like input for one part of a compound value.
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

    // v-bind="e.partNumber(name, 'blur')" on a number input for one numeric part.
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

    // v-bind="e.partSwitch(name, 'is_external')" on a checkbox for one boolean part.
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

    // v-bind="e.unitSelect(name)" on the unit <select> a slider/dimensions/gaps control shares.
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

    // v-bind="e.linkedNumber(name, 'top', ['top','right','bottom','left'])" on one side's number input — while linked, editing any part updates every part in "allKeys" together.
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

    // v-bind="e.linkToggle(name)" on the link/unlink button paired with linkedNumber() above.
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
