/**
 * "Unit" controls — a compound value that pairs one or more numbers with a CSS length unit
 * (Elementor's slider/dimensions/gaps controls). No wrapper factory of their own: sliderRange()/
 * partNumber()/linkedNumber()/linkToggle()/unitSelect() (base.js) are what's actually reused.
 *
 * Value shapes, for reference:
 *   slider:     { size: 0, unit: 'px' }
 *   dimensions: { top: 0, right: 0, bottom: 0, left: 0, unit: 'px', isLinked: true }
 */

// The 4 side keys a dimensions control links together — see linkedNumber() (base.js).
const DIMENSION_SIDES = ['top', 'right', 'bottom', 'left'];

export function createUnitControls() {
  return {
    dimensionSides: DIMENSION_SIDES,

    // v-bind="e.sliderRange(name)" on a slider's <input type="range"> — partNumber() plus min/max/step off the control's own definition.
    sliderRange(name) {
      return {
        ...this.partNumber(name, 'size'),
        ':min'() {
          return this._controls[name]?.min ?? 0;
        },
        ':max'() {
          return this._controls[name]?.max ?? 100;
        },
        ':step'() {
          return this._controls[name]?.step ?? 1;
        },
        // Compact sidebar row, not a full-size slider — hide Ranger's floating label and tick scale.
        'v-ranger': '{ labelIsVisible: false, scaleTicksCount: 0 }',
      };
    },
  };
}
