/**
 * The "url" control — a link URL plus open-in-new-tab/nofollow flags, dispatched by
 * CONTROL_RENDERERS.url (controls/render.js). Its own value parts (part()/partSwitch()) stay in
 * controls/base.js — shared compound-value machinery, also used by dimensions/slider.
 */

import { cloneTemplateFragment } from '../../controls/template';

export function renderUrl(name) {
  const el = cloneTemplateFragment('editrix-control-url');
  el.querySelector('[data-part="url"]').setAttribute('v-bind', `e.part(${JSON.stringify(name)}, 'url')`);
  el.querySelector('[data-part="is_external"]').setAttribute('v-bind', `e.partSwitch(${JSON.stringify(name)}, 'is_external')`);
  el.querySelector('[data-part="nofollow"]').setAttribute('v-bind', `e.partSwitch(${JSON.stringify(name)}, 'nofollow')`);
  return el;
}
