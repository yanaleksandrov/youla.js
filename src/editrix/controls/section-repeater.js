// The "repeatable section" — declared on a section (`repeatable: true`), it repeats the section's own `fields` as a whole instead of a single field being a repeater.
// Unlike control/repeater's rows, every item field gets the full field() chrome, sharing value dispatch with repeaterField().

import { createSortableItem } from '../sortable';
import { createRepeaterFieldControl } from '../control/repeater';
import { cloneTemplateElement } from './template';
import {
  readItems, writeItems, patchItemAt, createDefaultItem, itemIndexOf, renumberItems, destroyItemFillers, minItems, maxItems, isItemConditionMet,
} from './repeatable';

/**
 * The declared field definition behind one item field — same for every item, so no item-index needed.
 */
function itemFieldDef(component, repeatableName, key) {
  return (component._controls[repeatableName]?.fields || []).find((field) => field.name === key);
}

/**
 * Builds one item field's full chrome — the same "editrix-field-template" every top-level field
 * uses, but wired to item-scoped bindings instead of base.js's field(), since item fields aren't
 * unique panel-wide, only within their own repeatable set.
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

/**
 * Registers the repeatable section's own control definition, same _controls[name] plumbing as
 * any other field.
 */
function registerSectionRepeater(component, name, limits, fields) {
  const { min, max, default: defaultValue } = limits;
  component.registerControl(name, 'section-repeater', { min, max, default: defaultValue, fields });
}

export function createSectionRepeaterControl() {
  return {
    /**
     * Registers the section, then builds items via ":data-owner" — same pattern as
     * repeaterList() (control/repeater), not v-each.
     */
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

    /**
     * The section head's "+" icon — hidden once "max" is reached; registers too, since it may
     * resolve before the items list.
     */
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

    /**
     * Draggable reordering via createSortableItem(), same as repeaterItemRoot() (control/repeater).
     */
    sectionRepeaterItemRoot(name) {
      return createSortableItem({
        read: (component) => readItems(component, name),
        write: (component, items) => writeItems(component, name, items),
        handle: '.editrix-section-item__handle',
      });
    },

    /**
     * v-bind="e.sectionRepeaterRemove(name)" on an item's trash icon — hidden once "min" is reached.
     */
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

    /**
     * Item-scoped counterpart of base.js's field() — "condition" is checked against this
     * item's own values, not top-level settings.
     */
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

    /**
     * v-bind="e.sectionFieldTooltip(name, 'label')" — item-scoped counterpart of base.js's
     * fieldTooltip(). Repeatable sections only ever live in a block's own Content tab, never the
     * toolbox, so — unlike fieldTooltip() — this is unconditionally style-dark.
     */
    sectionFieldTooltip(name, key) {
      return {
        'v-show'() {
          return !!itemFieldDef(this, name, key)?.tooltip;
        },
        'v-tooltip.click.style-dark'() {
          return itemFieldDef(this, name, key)?.tooltip;
        },
      };
    },

    /**
     * v-bind="e.sectionFieldDescription(name, 'label')" — item-scoped counterpart of base.js's
     * fieldDescription().
     */
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
