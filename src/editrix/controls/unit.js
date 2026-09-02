// "Unit" controls — a compound value pairing one or more numbers with a CSS length unit (Elementor's slider/dimensions/gaps controls). Wrapper is `field(...)` like any other.
// Value shapes: slider { size: 0, unit: 'px' }; dimensions { top: 0, right: 0, bottom: 0, left: 0, unit: 'px', isLinked: true }.

import { fieldName } from './base';

// The 4 side keys a dimensions control links together — see linkedNumber() below.
const DIMENSION_SIDES = ['top', 'right', 'bottom', 'left'];

// CSS length units every unit control's <select> offers — see unitSelect() and "units" below.
const CONTROL_UNITS = ['px', '%', 'em', 'rem', 'vw', 'vh'];

export function createUnitControls() {
  return {
    dimensionSides: DIMENSION_SIDES,

    // Shared with sidebar.html's unit <select> templates (v-each="unit in units").
    units: CONTROL_UNITS,

    fieldAffix(key) {
      return {
        'v-show'() {
          const name = fieldName(this.$el);
          return !!this._controls[name]?.[key];
        },
        'v-text'() {
          const name = fieldName(this.$el);
          return this._controls[name]?.[key] || '';
        },
      };
    },

    partNumber(key) {
      return {
        ':value'() {
          const name = fieldName(this.$el);
          return (this.getValue(name) || {})[key] ?? 0;
        },
        '@input'(e) {
          const name = fieldName(this.$el);
          this.patchValue(name, { [key]: parseFloat(e.target.value) || 0 });
        },
      };
    },

    unitSelect() {
      return {
        ':value'() {
          const name = fieldName(this.$el);
          return (this.getValue(name) || {}).unit ?? 'px';
        },
        '@change'(e) {
          const name = fieldName(this.$el);
          this.patchValue(name, { unit: e.target.value });
        },
      };
    },

    linkedNumber(key, allKeys) {
      return {
        ':value'() {
          const name = fieldName(this.$el);
          return (this.getValue(name) || {})[key] ?? 0;
        },
        '@input'(e) {
          const name = fieldName(this.$el);
          const value = parseFloat(e.target.value) || 0;
          const current = this.getValue(name) || {};

          this.patchValue(name, current.isLinked
            ? Object.fromEntries(allKeys.map((k) => [k, value]))
            : { [key]: value });
        },
      };
    },

    linkToggle() {
      return {
        ':class'() {
          const name = fieldName(this.$el);
          return {
            'is-linked': !!(this.getValue(name) || {}).isLinked
          };
        },
        '@click'() {
          const name = fieldName(this.$el);
          this.patchValue(name, { isLinked: !(this.getValue(name) || {}).isLinked });
        },
      };
    },

    dimensionsTitle() {
      return {
        ':data-title'() {
          return this._controls[fieldName(this.$el)]?.label || '';
        },
      };
    },

    sliderRange() {
      return {
        ...this.partNumber('size'),
        ':min'() {
          return this._controls[fieldName(this.$el)]?.min ?? 0;
        },
        ':max'() {
          return this._controls[fieldName(this.$el)]?.max ?? 100;
        },
        ':step'() {
          return this._controls[fieldName(this.$el)]?.step ?? 1;
        },
        // Compact sidebar row, not a full-size slider — hide Ranger's floating label and tick scale.
        'v-ranger': '{ labelIsVisible: false, scaleTicksCount: 0 }',
      };
    },
  };
}
