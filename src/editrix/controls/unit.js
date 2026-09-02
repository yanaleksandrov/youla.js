/**
 * "Unit" controls — a compound value that pairs one or more numbers with a CSS length unit
 * (Elementor's slider/dimensions/gaps controls). Their wrapper is just `field(...)` like any other
 * (controls/base.js); partNumber()/fieldAffix()/unitSelect()/linkedNumber()/linkToggle()/
 * sliderRange() below are their parts.
 *
 * Value shapes, for reference:
 *   slider:     { size: 0, unit: 'px' }
 *   dimensions: { top: 0, right: 0, bottom: 0, left: 0, unit: 'px', isLinked: true }
 */

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

    // v-bind="e.fieldAffix('prefix'/'suffix')" on static text glued to a control's input (e.g. slider()) — hidden unless the field declares that key.
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

    // v-bind="e.partNumber('size')" on a number input for one numeric part — "name" comes from the
    // closest ".editrix-field" wrapper's own "data-name" (controls/base.js's fieldName()).
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

    // v-bind="e.unitSelect()" on the unit <select> a slider/dimensions/gaps control shares.
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

    // v-bind="e.linkedNumber('top', ['top','right','bottom','left'])" on one side's number input — while linked, editing any part updates every part in "allKeys" together.
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

    // v-bind="e.linkToggle()" on the link/unlink button paired with linkedNumber() above.
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

    // v-bind="e.dimensionsTitle()" on ".editrix-borders-values" — the widget's own small overlay
    // label (borders.scss's ".editrix-borders-values:before"), duplicating the field's own outer
    // title (controls/base.js's field()'s ":data-title") since this value has nowhere shared to
    // read from except the ".editrix-field" wrapper itself.
    dimensionsTitle() {
      return {
        ':data-title'() {
          return this._controls[fieldName(this.$el)]?.label || '';
        },
      };
    },

    // v-bind="e.sliderRange()" on a slider's <input type="range"> — partNumber() plus min/max/step off the control's own definition.
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
