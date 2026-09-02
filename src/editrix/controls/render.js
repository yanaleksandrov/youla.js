/**
 * Renders control instances at runtime by cloning a <template>: clone → wire attributes via
 * setAttribute() (never string-interpolated into HTML text) → component.initialize() to activate
 * the clone's directives.
 *
 * Each control's own markup + renderer lives in its own folder under src/editrix/control/<type>/
 * (index.html + index.js), required directly from view/editrix.html — see control/repeater/index.js's
 * own comment for why. Adding a new control type means adding its folder, requiring its index.html
 * from editrix.html, plus one entry below.
 */

import { cloneTemplateFragment } from './template';
import { renderText } from '../control/text';
import { renderSwitcher } from '../control/switcher';
import { renderSelect } from '../control/select';
import { renderColor } from '../control/color';
import { renderUrl } from '../control/url';
import { renderSlider } from '../control/slider';
import { renderDimensions } from '../control/dimensions';
import { renderRepeater } from '../control/repeater';
import { renderTextarea } from '../control/textarea';
import { renderGallery } from '../control/gallery';
import { renderMeta } from '../control/meta';
import { renderCategories } from '../control/categories';
import { renderMargin } from '../control/margin';
import { renderPadding } from '../control/padding';
import { renderBorders } from '../control/borders';
import { renderAlignment } from '../control/alignment';
import { renderCssClasses } from '../control/css-classes';

// Control types whose markup reads better stacked in its own column rather than sharing the title's row — see fields.scss's ".editrix-field-row" rule.
const ROW_TYPES = new Set(['url', 'slider', 'repeater']);

// One renderer per control type, each from its own src/editrix/control/<type>/index.js — so renderField() below never needs to know a type's internal structure.
const CONTROL_RENDERERS = {
  text: renderText,
  switcher: renderSwitcher,
  select: renderSelect,
  color: renderColor,
  url: renderUrl,
  slider: renderSlider,
  dimensions: renderDimensions,
  repeater: renderRepeater,

  // Toolbox controls (youla-editrix.js's toolboxSections, TOOLBOX's own sections — #editrix-data) —
  // fixed, single-instance controls with their own bindings already baked into their markup
  // (page-level state like "thumbnails"/"author"/"terms", not a name-keyed setting), so unlike every
  // renderer above they ignore their arguments. Still mounted via renderField() like any other
  // field, so its generic title chrome (`.editrix-field:before`) already applies for free — margin/
  // padding/alignment set a real "title" in #editrix-data's config; the rest leave it empty, so that
  // chrome stays invisible (fields.scss's `[data-title=""]` rule) rather than being skipped structurally.
  textarea: renderTextarea,
  gallery: renderGallery,
  meta: renderMeta,
  categories: renderCategories,
  margin: renderMargin,
  padding: renderPadding,
  borders: renderBorders,
  alignment: renderAlignment,
  'css-classes': renderCssClasses,
};

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
  const renderControl = CONTROL_RENDERERS[rest.type];

  if (!renderControl) {
    throw new Error(`Youla.js: no control renderer registered for type "${rest.type}" (field "${name}").`);
  }

  const root = cloneTemplateFragment('editrix-field-template').firstElementChild;
  const field = root.matches('.editrix-field') ? root : root.querySelector('.editrix-field');

  field.setAttribute('v-bind', `e.field(${JSON.stringify(name)}, ${JSON.stringify(title)}, ${JSON.stringify(tooltip)}, ${JSON.stringify(rest)})`);
  field.querySelector('.editrix-field__tooltip').setAttribute('v-bind', `e.fieldTooltip(${JSON.stringify(name)})`);
  field.querySelector('.editrix-field__description').setAttribute('v-bind', `e.fieldDescription(${JSON.stringify(name)})`);

  const controlSlot = field.querySelector('.editrix-field__control');
  controlSlot.classList.toggle('editrix-field-row', ROW_TYPES.has(rest.type));
  controlSlot.append(renderControl(name, title, rest));

  return root;
}
