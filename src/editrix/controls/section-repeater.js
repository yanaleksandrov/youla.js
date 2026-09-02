/**
 * The "repeatable section" — a section (youla-editrix.js's contentFields()) that repeats its own
 * `fields` as a whole, instead of a single field being a repeater. Meant for a couple of short
 * fields always shown in full (a links list, say), as opposed to control/repeater's classic
 * collapsible repeater, which suits heavier per-item field sets where a scannable summary matters
 * more than seeing everything at once.
 *
 * Declare it on a section, not a field — `name`/`min`/`max`/`default` sit alongside `heading`/
 * `tooltip`, and `fields` becomes the per-item template:
 *
 *   {
 *     heading: 'Content',
 *     repeatable: true,
 *     name: 'links', min: 1, max: 6, default: [{ label: 'Home', url: '#' }],
 *     fields: [
 *       { name: 'label', title: 'Label', type: 'text', default: 'New link' },
 *       { name: 'url', title: 'URL', type: 'text', default: '' },
 *     ],
 *   }
 *
 * "+" lives in the section's own head (there's exactly one, built alongside the section itself —
 * contentFields()), not relocated there from anywhere. Each item is one row — drag handle and remove
 * flanking a column of the item's own fields, stacked one per line (createSectionRepeaterItem()
 * below) — with no separate toolbar/body split. Each field still gets the *full* field() chrome
 * (title/tooltip/description, and — see sectionField() below — "condition") via sectionField()/
 * sectionFieldTooltip()/sectionFieldDescription() below — unlike a classic repeater row's trimmed
 * createRepeaterField() (control/repeater), since there's no collapsed state to save space for. Value
 * dispatch itself (text/switcher/color/fill) is shared, unchanged, with the classic repeater — see
 * createRepeaterFieldControl()/repeaterField() (control/repeater) — only the chrome differs; the
 * value-array plumbing (read/write/patch/min-max/condition) is controls/repeatable.js, shared by
 * both.
 *
 * Value shape: object[], keyed by each field's own `name` — identical to a classic repeater's.
 */

import { createSortableItem } from '../sortable';
import { createRepeaterFieldControl } from '../control/repeater';
import { cloneTemplateElement } from './template';
import {
  readItems, writeItems, patchItemAt, createDefaultItem, itemIndexOf, renumberItems, destroyItemFillers, minItems, maxItems, isItemConditionMet,
} from './repeatable';

// The declared field definition behind one item field — static per (repeatableName, key) pair, the same for every item, so title/tooltip/description can be read straight off it with no item-index involved.
function itemFieldDef(component, repeatableName, key) {
  return (component._controls[repeatableName]?.fields || []).find((field) => field.name === key);
}

/**
 * Builds one item field's full chrome — a clone of "editrix-field-template" (the same chrome
 * every top-level field uses, controls/render.js's renderField()) around
 * createRepeaterFieldControl()'s raw input, wired to this repeatable section's own item-scoped
 * bindings instead of base.js's field()/fieldTooltip()/fieldDescription() (which would register a
 * stray top-level setting under the field's bare name — item fields aren't unique panel-wide, only
 * within their own repeatable set).
 *
 * @param {string} name - The repeatable section's own setting name.
 * @param {Object} fieldDef - One entry of its own `fields` definition.
 * @returns {HTMLElement}
 */
function buildSectionItemField(name, fieldDef) {
  const root = cloneTemplateElement('editrix-field-template');
  const field = root.matches('.editrix-field') ? root : root.querySelector('.editrix-field');
  const nameArg = JSON.stringify(name);
  const keyArg = JSON.stringify(fieldDef.name);

  field.setAttribute('v-bind', `e.sectionField(${nameArg}, ${keyArg})`);
  field.querySelector('.editrix-field__tooltip').setAttribute('v-bind', `e.sectionFieldTooltip(${nameArg}, ${keyArg})`);
  field.querySelector('.editrix-field__description').setAttribute('v-bind', `e.sectionFieldDescription(${nameArg}, ${keyArg})`);
  field.querySelector('.editrix-field__control').append(createRepeaterFieldControl(name, fieldDef));

  return field;
}

/**
 * Builds one repeatable-section item — drag handle and remove flanking a column of the item's own
 * fields (each in full field() chrome), stacked one per line rather than side by side.
 *
 * @param {string} name
 * @param {number} index
 * @param {Object[]} fields - The section's own `fields` definition.
 * @returns {HTMLElement}
 */
function createSectionRepeaterItem(name, index, fields) {
  const el = document.createElement('div');
  const nameArg = JSON.stringify(name);

  el.className = 'editrix-section-item';
  el.dataset.index = index;
  el.setAttribute('v-bind', `e.sectionRepeaterItemRoot(${nameArg})`);
  el.innerHTML = '<i class="ph ph-dots-six-vertical editrix-section-item__handle" title="Drag to reorder"></i>';

  const fieldsColumn = document.createElement('div');
  fieldsColumn.className = 'editrix-section-item__fields';
  fields.forEach((fieldDef) => fieldsColumn.append(buildSectionItemField(name, fieldDef)));
  el.append(fieldsColumn);

  const remove = document.createElement('i');
  remove.className = 'ph ph-trash editrix-section-item__remove';
  remove.title = 'Remove item';
  remove.setAttribute('v-bind', `e.sectionRepeaterRemove(${nameArg})`);
  el.append(remove);

  return el;
}

/**
 * Builds a repeatable section's items mount point — contentFields() (youla-editrix.js) appends this
 * into the section's own ".editrix-section-body" in place of a plain fields.map(renderField()).
 *
 * @param {string} name
 * @param {Object} limits - { min, max, default } off the section's own config (alongside `heading`/`tooltip`/`name`).
 * @param {Object[]} fields - The section's own `fields` definition (the per-item template).
 * @returns {HTMLElement}
 */
export function renderSectionRepeaterItems(name, limits, fields) {
  const el = document.createElement('div');
  el.className = 'editrix-section-items';
  el.setAttribute('v-bind', `e.sectionRepeaterList(${JSON.stringify(name)}, ${JSON.stringify(limits)}, ${JSON.stringify(fields)})`);
  return el;
}

/**
 * Builds a repeatable section's own "+" icon — contentFields() appends this into the section's
 * ".editrix-section-buttons" alongside any other section-head icon.
 *
 * @param {string} name
 * @param {Object} limits
 * @param {Object[]} fields
 * @returns {HTMLElement}
 */
export function renderSectionRepeaterAdd(name, limits, fields) {
  const el = document.createElement('i');
  el.className = 'ph ph-plus';
  el.title = 'Add item';
  el.setAttribute('v-bind', `e.sectionRepeaterAdd(${JSON.stringify(name)}, ${JSON.stringify(limits)}, ${JSON.stringify(fields)})`);
  return el;
}

// Registers the repeatable section's own control definition — min/max/fields, so getValue()/setValue()/minItems()/maxItems() all work through the usual _controls[name] plumbing, same as any other field.
function registerSectionRepeater(component, name, limits, fields) {
  const { min, max, default: defaultValue } = limits;
  component.registerControl(name, 'section-repeater', { min, max, default: defaultValue, fields });
}

export function createSectionRepeaterControl() {
  return {
    // v-bind="e.sectionRepeaterList(name, limits, fields)" — registers the repeatable section (see registerSectionRepeater() above), then builds items the first time it's resolved and again whenever the active block changes — same ":data-owner" pattern as repeaterList() (repeater.js), for the same reason (v-each would rebuild every item on each re-render).
    sectionRepeaterList(name, limits, fields) {
      registerSectionRepeater(this, name, limits, fields);

      return {
        ':data-owner'() {
          const owner = this.activeBlock || '__page__';

          if (this.$el.dataset.owner !== owner) {
            this.$el.dataset.owner = owner;
            destroyItemFillers(this.$el);
            this.$el.innerHTML = '';

            readItems(this, name).forEach((item, index) => {
              const row = createSectionRepeaterItem(name, index, fields);
              this.$el.append(row);
              this.$root.__x.initialize(row);
            });
          }
          return owner;
        },
      };
    },

    // v-bind="e.sectionRepeaterAdd(name, limits, fields)" on the section head's "+" icon — hidden once "max" is reached. Registers the same control definition as sectionRepeaterList() above (registerControl() is a no-op past the first call — base.js compares before writing), since this icon can resolve before or after the items list depending on DOM order.
    sectionRepeaterAdd(name, limits, fields) {
      registerSectionRepeater(this, name, limits, fields);

      return {
        'v-show'() {
          return readItems(this, name).length < maxItems(this, name);
        },
        '@click'() {
          const items = readItems(this, name);

          // Belt-and-braces against "v-show" being bypassed by a stray click right at the "max" boundary.
          if (items.length >= maxItems(this, name)) {
            return;
          }

          const index = items.length;
          writeItems(this, name, [...items, createDefaultItem(fields)]);

          const list = this.$el.closest('.editrix-section').querySelector('.editrix-section-items');
          const row = createSectionRepeaterItem(name, index, fields);
          list.append(row);
          this.$root.__x.initialize(row);
        },
      };
    },

    // v-bind="e.sectionRepeaterItemRoot(name)" on an item's own root — draggable reordering via sortable.js's createSortableItem(), same as repeaterItemRoot() (repeater.js).
    sectionRepeaterItemRoot(name) {
      return createSortableItem({
        read: (component) => readItems(component, name),
        write: (component, items) => writeItems(component, name, items),
      });
    },

    // v-bind="e.sectionRepeaterRemove(name)" on an item's trash icon — hidden once "min" is reached.
    sectionRepeaterRemove(name) {
      return {
        'v-show'() {
          return readItems(this, name).length > minItems(this, name);
        },
        '@click.stop.prevent'() {
          const items = readItems(this, name);

          // Same belt-and-braces as sectionRepeaterAdd()'s own "max" guard.
          if (items.length <= minItems(this, name)) {
            return;
          }

          const item = this.$el.closest('.editrix-section-item');
          const index = itemIndexOf(item);
          const list = item.parentElement;

          writeItems(this, name, items.filter((_, i) => i !== index));
          destroyItemFillers(item);
          item.remove();
          renumberItems(list);
        },
      };
    },

    // v-bind="e.sectionField(name, 'label')" on one item field's own ".editrix-field" wrapper — the item-scoped counterpart of base.js's field(): "condition" is checked against this same item's own values via isItemConditionMet() (controls/repeatable.js), not top-level settings; "responsive" stays out of scope (no per-device axis makes sense for one item's own field).
    sectionField(name, key) {
      return {
        'v-show'() {
          const item = readItems(this, name)[itemIndexOf(this.$el)];
          return isItemConditionMet(item, itemFieldDef(this, name, key)?.condition);
        },
        ':class'() {
          const def = itemFieldDef(this, name, key);
          return { [`editrix-field--${def?.type}`]: true };
        },
        ':data-title'() {
          return itemFieldDef(this, name, key)?.title || '';
        },
      };
    },

    // v-bind="e.sectionFieldTooltip(name, 'label')" — item-scoped counterpart of base.js's fieldTooltip().
    sectionFieldTooltip(name, key) {
      return {
        'v-show'() {
          return !!itemFieldDef(this, name, key)?.tooltip;
        },
        'v-tooltip.click'() {
          return itemFieldDef(this, name, key)?.tooltip;
        },
      };
    },

    // v-bind="e.sectionFieldDescription(name, 'label')" — item-scoped counterpart of base.js's fieldDescription().
    sectionFieldDescription(name, key) {
      return {
        'v-show'() {
          return !!itemFieldDef(this, name, key)?.description;
        },
        'v-text'() {
          return itemFieldDef(this, name, key)?.description;
        },
      };
    },
  };
}
