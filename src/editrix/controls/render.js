/**
 * Renders control instances at runtime by cloning a <template>. Each control's own markup lives in
 * its own folder under src/editrix/control/<type>/index.html, required directly from
 * view/editrix.html — see control/repeater/index.js's own comment for why.
 *
 * "editrix-control-<type>" is cloned by convention (renderField() below) — every control type's own
 * bindings read straight off the closest ".editrix-field" wrapper's own "data-name" (controls/
 * base.js's field()/fieldName()), even ones whose own DOM shape depends on their value (repeater's
 * row count) or needs its own imperative setup (select's own "<option>"s, built by its own "@load",
 * control/select/index.html) — so no per-type renderer function is needed here at all. Adding a new
 * control type means just adding its folder + index.html and requiring it from editrix.html.
 */

import { cloneTemplateFragment } from './template';

// Control types whose markup reads better stacked in its own column rather than sharing the title's row — see fields.scss's ".editrix-field-row" rule.
const ROW_TYPES = new Set(['url', 'slider', 'repeater']);

/**
 * Renders one full control instance: the shared chrome (title/tooltip/control slot/description,
 * "#editrix-field-template") around whichever control type's own markup.
 *
 * @param {Object} def
 * @param {string} def.name - The setting's key, unique across the whole panel.
 * @param {string} def.title
 * @param {string} def.tooltip
 * @param {Object} rest - type/default/value/description/condition/responsive, plus type-specific options.
 * @returns {HTMLElement} The template's root element (its `.editrix-field`, or a wrapper around it), fully wired, not yet inserted into the DOM.
 */
export function renderField({ name, title, tooltip, ...rest }) {
  const root = cloneTemplateFragment('editrix-field-template').firstElementChild;
  const field = root.matches('.editrix-field') ? root : root.querySelector('.editrix-field');

  field.setAttribute('v-bind', `e.field(${JSON.stringify(name)}, ${JSON.stringify(title)}, ${JSON.stringify(tooltip)}, ${JSON.stringify(rest)})`);
  field.querySelector('.editrix-field__tooltip').setAttribute('v-bind', `e.fieldTooltip(${JSON.stringify(name)})`);
  field.querySelector('.editrix-field__description').setAttribute('v-bind', `e.fieldDescription(${JSON.stringify(name)})`);

  const controlSlot = field.querySelector('.editrix-field__control');
  controlSlot.classList.toggle('editrix-field-row', ROW_TYPES.has(rest.type));
  // cloneTemplateFragment() throws its own "no <template>" error for a genuinely unknown type.
  controlSlot.append(cloneTemplateFragment(`editrix-control-${rest.type}`));

  return root;
}
