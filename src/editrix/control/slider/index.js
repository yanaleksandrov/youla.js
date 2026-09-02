/**
 * The "slider" control — a range input paired with a unit, dispatched by CONTROL_RENDERERS.slider
 * (controls/render.js). Its own value parts (sliderRange()/fieldAffix()/unitSelect()) stay in
 * controls/unit.js and controls/base.js — shared compound-value machinery, also used by dimensions.
 */

import { cloneTemplateFragment } from '../../controls/template';

export function renderSlider(name) {
  const el = cloneTemplateFragment('editrix-control-slider');
  el.querySelector('[data-part="range"]').setAttribute('v-bind', `e.sliderRange(${JSON.stringify(name)})`);
  el.querySelector('[data-part="prefix"]').setAttribute('v-bind', `e.fieldAffix(${JSON.stringify(name)}, 'prefix')`);
  el.querySelector('[data-part="size"]').setAttribute('v-bind', `e.partNumber(${JSON.stringify(name)}, 'size')`);
  el.querySelector('[data-part="suffix"]').setAttribute('v-bind', `e.fieldAffix(${JSON.stringify(name)}, 'suffix')`);
  el.querySelector('[data-part="unit"]').setAttribute('v-bind', `e.unitSelect(${JSON.stringify(name)})`);
  return el;
}
