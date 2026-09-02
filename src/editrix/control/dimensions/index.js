/**
 * The "dimensions" control — 4 linked side numbers plus a unit, dispatched by
 * CONTROL_RENDERERS.dimensions (controls/render.js). Its own value parts (linkedNumber()/
 * linkToggle()/unitSelect()) stay in controls/base.js and controls/unit.js — shared compound-value
 * machinery, also used by slider.
 */

import { cloneTemplateFragment } from '../../controls/template';

export function renderDimensions(name, title) {
  const el = cloneTemplateFragment('editrix-control-dimensions');

  el.querySelectorAll('[data-side]').forEach((input) => {
    input.setAttribute('v-bind', `e.linkedNumber(${JSON.stringify(name)}, ${JSON.stringify(input.dataset.side)}, dimensionSides)`);
  });

  el.querySelector('[data-part="link-toggle"]').setAttribute('v-bind', `e.linkToggle(${JSON.stringify(name)})`);
  el.querySelector('[data-part="unit"]').setAttribute('v-bind', `e.unitSelect(${JSON.stringify(name)})`);
  el.querySelector('.editrix-borders-values').setAttribute('data-title', title);
  return el;
}
