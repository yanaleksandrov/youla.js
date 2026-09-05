/**
 * Reads a binding's "name" off the closest ".editrix-field" wrapper's own "data-name" (set
 * by field() below), instead of taking it as an argument.
 */
export function fieldName(el) {
  return el.closest('.editrix-field').dataset.name;
}

/**
 * An explicit "value" wins over "default" when both are present.
 */
function initialValue(def) {
  return def?.value !== undefined ? def.value : def?.default;
}

export function createControlsBase() {
  return {
    // Every control's definition, keyed by name, refreshed on every render; go through getValue()/setValue()/isConditionMet() rather than reading this directly.
    _controls: {},

    // Every block's current control values, keyed by block id (youla-editrix.js's container() via `this.activeBlock`) then control name; use getValue()/setValue() rather than reading this directly.
    settings: {},

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
     * Registers/refreshes "name"'s control definition and seeds its value on first use. field()
     * is the only caller.
     *
     * @param {string} name - The setting's key, unique across the whole panel.
     * @param {string} type - The control type (used for the `editrix-field--<type>` class).
     * @param {Object} [options] - label/tooltip/description/default/value/condition, plus type-specific options.
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
        bucket[name] = initialValue(def);
      }
      return def;
    },

    /**
     * Reads a control's current value on the active block.
     *
     * @param {string} name
     * @returns {*}
     */
    getValue(name) {
      const def = this._controls[name];
      const raw = this.blockSettings()[name];

      return raw !== undefined ? raw : initialValue(def);
    },

    /**
     * Writes a control's current value on the active block.
     *
     * @param {string} name
     * @param {*} value
     */
    setValue(name, value) {
      const bucket = this.blockSettings();

      bucket[name] = value;

      // Relays the change to other connected clients — a no-op for a page-level (__page__ bucket)
      // control, since only per-block content is collaboratively locked/broadcast (see editrix/collab
      // and youla-editrix.js's own broadcastChange()).
      if (this.activeBlock) {
        this.broadcastChange(this.activeBlock);
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
     * The wrapper every control is built from — v-bind="e.field(...)" on `.editrix-field`,
     * registering the control and returning its show/class/title/name bindings.
     *
     * @param {string} name - The setting's key, unique across the whole panel.
     * @param {string} [title] - The control's label.
     * @param {string} [tooltip] - Extra help text, shown by fieldTooltip()'s icon on click.
     * @param {Object} [options] - type/default/value/condition/description, plus type-specific options.
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
        ':data-name'() {
          return name;
        },
      };
    },

    /**
     * v-bind="e.fieldTooltip(name, dark)" on a control's "?" icon — reuses v-tooltip, triggered on
     * click since the icon itself is the target; hidden without tooltip text. "dark" (renderField(),
     * editrix/controls/render.js) is style-dark everywhere except the toolbox.
     */
    fieldTooltip(name, dark) {
      return {
        'v-show'() {
          return !!this._controls[name]?.tooltip;
        },
        [`v-tooltip.click${dark ? '.style-dark' : ''}`]() {
          return this._controls[name]?.tooltip;
        },
      };
    },

    /**
     * v-bind="e.fieldDescription(name)" on `.editrix-field__description` — hidden without a
     * description.
     */
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
  };
}
