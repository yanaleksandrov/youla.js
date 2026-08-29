/**
 * Renders control instances at runtime by cloning the <template> library shipped in
 * sections/sidebar.html's "Content" panel — Youla.js has no component-rendering system (see
 * base.js's header comment: a control is "real, hand-written HTML using v-bind to wire behavior
 * on top"), so composing one from a plain JS definition works the same way v-each (directives/
 * v-each.js) and container() (youla-editrix.js) already build markup dynamically elsewhere in
 * this codebase: clone → wire attributes with plain setAttribute() calls (never string-
 * interpolated into HTML text, so nothing here ever needs escaping) → component.initialize() to
 * activate the clone's directives.
 *
 * Every control's own inner markup stays in its own <template id="editrix-control-*"> — this file
 * only knows which element(s) inside that clone need which binding. Adding a new control type
 * means adding its <template> plus one entry below; nothing else changes.
 */

import { renderFillControl } from './fill';

/**
 * Clones a <template>'s content by id.
 *
 * @param {string} id
 * @returns {DocumentFragment}
 */
function cloneTemplate(id) {
  const template = document.getElementById(id);

  if (!template) {
    throw new Error(`Youla.js: no <template id="${id}"> found — is sections/sidebar.html's field template library missing this control type?`);
  }
  return template.content.cloneNode(true);
}

// Control types whose own markup reads better stacked in its own column (url/media/slider) rather
// than sharing the title's row (text/switcher/select/color/dimensions) — see fields.scss's
// ".editrix-field-row" rule.
const ROW_TYPES = new Set(['url', 'media', 'slider', 'fill']);

// One renderer per control type — each returns that type's own markup (a clone of its own
// <template>, fully wired via setAttribute()), so renderField() below never needs to know a
// type's internal structure.
const CONTROL_RENDERERS = {
  text(name) {
    const el = cloneTemplate('editrix-control-text');
    el.querySelector('input').setAttribute('v-bind', `e.text(${JSON.stringify(name)})`);
    return el;
  },

  switcher(name) {
    const el = cloneTemplate('editrix-control-switcher');
    el.querySelector('input').setAttribute('v-bind', `e.switcher(${JSON.stringify(name)})`);
    return el;
  },

  select(name) {
    const el = cloneTemplate('editrix-control-select');
    el.querySelector('select').setAttribute('v-bind', `e.select(${JSON.stringify(name)})`);
    return el;
  },

  color(name) {
    const el = cloneTemplate('editrix-control-color');
    el.querySelector('input').setAttribute('v-bind', `e.color(${JSON.stringify(name)})`);
    return el;
  },

  url(name) {
    const el = cloneTemplate('editrix-control-url');
    el.querySelector('[data-part="url"]').setAttribute('v-bind', `e.part(${JSON.stringify(name)}, 'url')`);
    el.querySelector('[data-part="is_external"]').setAttribute('v-bind', `e.partSwitch(${JSON.stringify(name)}, 'is_external')`);
    el.querySelector('[data-part="nofollow"]').setAttribute('v-bind', `e.partSwitch(${JSON.stringify(name)}, 'nofollow')`);
    return el;
  },

  media(name) {
    const el = cloneTemplate('editrix-control-media');
    el.querySelector('[data-part="preview"]').setAttribute(':style', `'background-image:url(' + (getValue(${JSON.stringify(name)})?.url || '') + ')'`);
    el.querySelector('[data-part="url"]').setAttribute('v-bind', `e.part(${JSON.stringify(name)}, 'url')`);
    return el;
  },

  slider(name) {
    const el = cloneTemplate('editrix-control-slider');
    el.querySelector('[data-part="range"]').setAttribute('v-bind', `e.sliderRange(${JSON.stringify(name)})`);
    el.querySelector('[data-part="prefix"]').setAttribute('v-bind', `e.fieldAffix(${JSON.stringify(name)}, 'prefix')`);
    el.querySelector('[data-part="size"]').setAttribute('v-bind', `e.partNumber(${JSON.stringify(name)}, 'size')`);
    el.querySelector('[data-part="suffix"]').setAttribute('v-bind', `e.fieldAffix(${JSON.stringify(name)}, 'suffix')`);
    el.querySelector('[data-part="unit"]').setAttribute('v-bind', `e.unitSelect(${JSON.stringify(name)})`);
    return el;
  },

  dimensions(name, title) {
    const el = cloneTemplate('editrix-control-dimensions');

    el.querySelectorAll('[data-side]').forEach((input) => {
      input.setAttribute('v-bind', `e.linkedNumber(${JSON.stringify(name)}, ${JSON.stringify(input.dataset.side)}, dimensionSides)`);
    });

    el.querySelector('[data-part="link-toggle"]').setAttribute('v-bind', `e.linkToggle(${JSON.stringify(name)})`);
    el.querySelector('[data-part="unit"]').setAttribute('v-bind', `e.unitSelect(${JSON.stringify(name)})`);
    el.querySelector('.editrix-borders-values').setAttribute('data-title', title);
    return el;
  },

  // The "fill" control's own markup/wiring is involved enough (a repeater of popovers, each with
  // its own type-switch tabs) to live in its own module — see controls/fill.js's header comment
  // for why it's built imperatively rather than the way every renderer above builds a fixed shape.
  fill(name) {
    return renderFillControl(name);
  },
};

/**
 * Renders one full control instance: the shared wrapper (title/tooltip/control slot/description,
 * "#editrix-field-template") around whichever control type's own markup — the definition shape
 * matches e.field()'s own signature (plugins/editrix/controls/base.js) exactly, so an entry here
 * is exactly what you'd otherwise write by hand as `v-bind="e.field(name, title, tooltip, options)"`.
 *
 * @param {Object} def
 * @param {string} def.name - The setting's key, unique across the whole panel.
 * @param {string} def.title
 * @param {string} [def.tooltip]
 * @param {Object} def.options - type/default/condition/... — same shape e.field() reads.
 * @returns {HTMLElement} The `.editrix-control` wrapper, fully wired, not yet inserted into the DOM.
 */
export function renderField({ name, title, tooltip = '', options }) {
  const renderControl = CONTROL_RENDERERS[options.type];

  if (!renderControl) {
    throw new Error(`Youla.js: no control renderer registered for type "${options.type}" (field "${name}").`);
  }

  const wrapper = cloneTemplate('editrix-field-template').firstElementChild;
  const field = wrapper.querySelector('.editrix-field');

  field.setAttribute('v-bind', `e.field(${JSON.stringify(name)}, ${JSON.stringify(title)}, ${JSON.stringify(tooltip)}, ${JSON.stringify(options)})`);
  field.querySelector('.editrix-field__tooltip').setAttribute('v-bind', `e.fieldTooltip(${JSON.stringify(name)})`);
  field.querySelector('.editrix-field__description').setAttribute('v-bind', `e.fieldDescription(${JSON.stringify(name)})`);

  const controlSlot = field.querySelector('.editrix-field__control');
  controlSlot.classList.toggle('editrix-field-row', ROW_TYPES.has(options.type));
  controlSlot.append(renderControl(name, title));

  return wrapper;
}
