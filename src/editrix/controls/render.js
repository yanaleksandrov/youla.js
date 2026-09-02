/**
 * Renders control instances at runtime by cloning a <template>: clone → wire attributes via
 * setAttribute() (never string-interpolated into HTML text) → component.initialize() to activate
 * the clone's directives.
 *
 * Each control's own markup lives in its own partial under view/editrix/controls/<type>.html (one
 * <template id="editrix-control-*"> each), required directly from view/editrix.html rather than
 * nested inside sidebar.html's own text — see repeater.html's own comment for why. Adding a new
 * control type means adding its partial, requiring it from editrix.html, plus one entry below.
 */

import { renderRepeaterControl } from './repeater';

/**
 * Clones a <template>'s content by id.
 *
 * @param {string} id
 * @returns {DocumentFragment}
 */
function cloneTemplate(id) {
  const template = document.getElementById(id);

  if (!template) {
    throw new Error(`Youla.js: no <template id="${id}"> found — is view/editrix/controls/${id.replace('editrix-control-', '')}.html missing, or not required from view/editrix.html?`);
  }
  return template.content.cloneNode(true);
}

// Control types whose markup reads better stacked in its own column rather than sharing the title's row — see fields.scss's ".editrix-field-row" rule.
const ROW_TYPES = new Set(['url', 'slider', 'repeater']);

// One renderer per control type — returns that type's own wired markup, so renderField() below never needs to know a type's internal structure.
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

  // "options" (an { value: label } map) builds the actual <option>s here, once, at render time — the field's own static config, not reactive state, so no need for a v-each. select.html's own template ships with none.
  select(name, title, rest) {
    const el = cloneTemplate('editrix-control-select');
    const select = el.querySelector('select');

    select.setAttribute('v-bind', `e.select(${JSON.stringify(name)})`);
    Object.entries(rest.options || {}).forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.append(option);
    });

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

  // Rows are built imperatively since a repeater's DOM shape depends on its value — see controls/repeater.js's own header comment.
  repeater(name) {
    return renderRepeaterControl(name);
  },

  // Toolbox > generic multi-line text control — e.g. the "Page" panel's title field. Unlike every
  // renderer below this one, it IS parametrized by "name" (and an optional "placeholder", rest) —
  // but still bound straight to a top-level reactive property via "v-prop", not through
  // getValue()/setValue() (controls/base.js): the toolbox's own section stays visible regardless of
  // which block is selected, so routing through the block-content settings system (keyed by
  // "activeBlock") would silently write the title into whichever block happens to be selected.
  textarea(name, title, rest) {
    const el = cloneTemplate('editrix-control-textarea');
    const field = el.querySelector('textarea');

    field.setAttribute('v-prop', name);
    if (rest?.placeholder) {
      field.setAttribute('placeholder', rest.placeholder);
    }
    return el;
  },

  // Toolbox controls (youla-editrix.js's toolboxSections, TOOLBOX's own sections — #editrix-data) —
  // fixed, single-instance controls with their own bindings already baked into their markup
  // (page-level state like "thumbnails"/"author"/"terms", not a name-keyed setting), so unlike every
  // renderer above they ignore their arguments. Still mounted via renderField() like any other
  // field — title/tooltip/description are just left empty, so that chrome stays invisible
  // (fields.scss's `[data-title=""]` rule) rather than being skipped structurally.
  gallery() {
    return cloneTemplate('editrix-control-gallery');
  },

  meta() {
    return cloneTemplate('editrix-control-meta');
  },

  categories() {
    return cloneTemplate('editrix-control-categories');
  },

  margin() {
    return cloneTemplate('editrix-control-margin');
  },

  padding() {
    return cloneTemplate('editrix-control-padding');
  },

  borders() {
    return cloneTemplate('editrix-control-borders');
  },

  alignment() {
    return cloneTemplate('editrix-control-alignment');
  },

  'css-classes'() {
    return cloneTemplate('editrix-control-css-classes');
  },
};

/**
 * Renders one full control instance: the shared wrapper (title/tooltip/control slot/description,
 * "#editrix-field-template") around whichever control type's own markup.
 *
 * @param {Object} def
 * @param {string} def.name - The setting's key, unique across the whole panel.
 * @param {string} def.title
 * @param {string} def.tooltip
 * @param {Object} rest - type/default/value/description/condition/responsive, plus type-specific options.
 * @returns {HTMLElement} The `.editrix-control` wrapper, fully wired, not yet inserted into the DOM.
 */
export function renderField({ name, title, tooltip, ...rest }) {
  const renderControl = CONTROL_RENDERERS[rest.type];

  if (!renderControl) {
    throw new Error(`Youla.js: no control renderer registered for type "${rest.type}" (field "${name}").`);
  }

  const wrapper = cloneTemplate('editrix-field-template').firstElementChild;
  const field = wrapper.querySelector('.editrix-field');

  field.setAttribute('v-bind', `e.field(${JSON.stringify(name)}, ${JSON.stringify(title)}, ${JSON.stringify(tooltip)}, ${JSON.stringify(rest)})`);
  field.querySelector('.editrix-field__tooltip').setAttribute('v-bind', `e.fieldTooltip(${JSON.stringify(name)})`);
  field.querySelector('.editrix-field__description').setAttribute('v-bind', `e.fieldDescription(${JSON.stringify(name)})`);

  const controlSlot = field.querySelector('.editrix-field__control');
  controlSlot.classList.toggle('editrix-field-row', ROW_TYPES.has(rest.type));
  controlSlot.append(renderControl(name, title, rest));

  return wrapper;
}
