// Renders control instances at runtime by cloning a <template>. Each control's own markup lives in its own folder under src/editrix/control/<type>/index.html, required from view/editrix.html.
// "editrix-control-<type>" is cloned by convention — every type's own bindings read their "name" off the closest ".editrix-field" wrapper's "data-name".

import { cloneTemplateFragment } from './template';

// Types whose markup reads better stacked in its own column — see fields.scss's ".editrix-field-row".
const ROW_TYPES = new Set(['url', 'slider', 'repeater']);

/**
 * Renders one full control instance: the shared chrome around the control type's own markup.
 *
 * @param {Object} def
 * @param {string} def.name - The setting's key, unique across the whole panel.
 * @param {string} def.title
 * @param {string} def.tooltip
 * @param {boolean} [def.dark] - Every field tooltip in the editor is style-dark except the
 *   toolbox's own (see renderSections()'s own "dark" param, youla-editrix.js).
 * @param {Object} rest - type/default/value/description/condition, plus type-specific options.
 * @returns {HTMLElement} The template's root element (its `.editrix-field`, or a wrapper around it), fully wired, not yet inserted into the DOM.
 */
export function renderField({ name, title, tooltip, dark, ...rest }) {
  const root = cloneTemplateFragment('editrix-field-template').firstElementChild;
  const field = root.matches('.editrix-field') ? root : root.querySelector('.editrix-field');

  field.setAttribute('v-bind', `e.field(${JSON.stringify(name)}, ${JSON.stringify(title)}, ${JSON.stringify(tooltip)}, ${JSON.stringify(rest)})`);
  field.querySelector('.editrix-field__tooltip').setAttribute('v-bind', `e.fieldTooltip(${JSON.stringify(name)}, ${JSON.stringify(!!dark)})`);
  field.querySelector('.editrix-field__description').setAttribute('v-bind', `e.fieldDescription(${JSON.stringify(name)})`);

  const controlSlot = field.querySelector('.editrix-field__control');
  controlSlot.classList.toggle('editrix-field-row', ROW_TYPES.has(rest.type));
  // cloneTemplateFragment() throws its own "no <template>" error for a genuinely unknown type.
  controlSlot.append(cloneTemplateFragment(`editrix-control-${rest.type}`));

  return root;
}
