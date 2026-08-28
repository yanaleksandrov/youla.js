/**
 * "Unit" controls — a compound value that pairs one or more numbers with a CSS length unit
 * (Elementor's own slider/dimensions/gaps controls, which this mirrors). Like multi-value.js,
 * there's no wrapper factory of their own: a unit control's wrapper is just
 * `field(name, title, tooltip, { type: 'slider', default: {...}, min: 0, max: 100 })` like any
 * other — sliderRange()/partNumber()/linkedNumber()/linkToggle()/unitSelect() (base.js) are what's
 * actually reused. `gaps` is the same pattern as `dimensions` (2 parts instead of 4, no separate
 * "row"/"column" linking beyond what linkedNumber() already gives it) once this one's reviewed.
 *
 * Value shapes, for reference:
 *   slider:     { size: 0, unit: 'px' }
 *   dimensions: { top: 0, right: 0, bottom: 0, left: 0, unit: 'px', isLinked: true }
 */

// The 4 side keys a dimensions control links together — v-bind="e.linkedNumber(name, 'top',
// dimensionSides)" (see controls/render.js's dimensions() renderer), so the "which sides move
// together when linked" list lives in exactly one place, reachable from markup the same way units
// (base.js) is.
const DIMENSION_SIDES = ['top', 'right', 'bottom', 'left'];

export function createUnitControls() {
  return {
    dimensionSides: DIMENSION_SIDES,

    // v-bind="e.sliderRange('width')" on a slider control's `<input type="range">` — partNumber()'s
    // value/change behavior, plus the min/max/step off the control's own definition.
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
        'v-ranger': '',
      };
    },
  };
}
