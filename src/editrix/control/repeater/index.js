/**
 * The "repeater" control — a generic Figma/Elementor-style collapsible repeater. An item's shape is
 * declared entirely by the control's own `fields` array (any mix of REPEATER_FIELD_TEMPLATES below),
 * so one control covers FAQ items, tabs, nav links, and (via the "fill" field type) a Figma-style
 * multi-fill list.
 *
 * Declare it like any other control:
 *
 *   {
 *     name: 'items', type: 'repeater', default: [{ question: '…', answer: '…', highlighted: false }],
 *     // value: [ ...the backend's actual current items... ], // optional — wins over "default" here exactly like on any other field (controls/base.js's registerControl()); a brand-new item added via "+" still seeds from each sub-field's own "default" below, never "value" — see createDefaultItem() (controls/repeatable.js).
 *     min: 0, max: 10, // optional — see minItems()/maxItems() (controls/repeatable.js); default: 0 / unlimited.
 *     disabled: false, // optional — see isHideable()/repeaterVisibility() below.
 *     fields: [
 *       { name: 'question', title: 'Question', type: 'text', default: 'New question' },
 *       { name: 'answer', title: 'Answer', type: 'text', default: '' },
 *       { name: 'highlighted', title: 'Highlight', type: 'switcher', default: false },
 *       // "condition" on a field here checks *this same item's* own values, not the block's —
 *       // see isItemConditionMet() (controls/repeatable.js).
 *       { name: 'accent_color', title: 'Accent color', type: 'color', condition: { highlighted: true } },
 *     ],
 *   }
 *
 * Value shape: object[], keyed by each field's own `name`, plus a reserved top-level "visible" key
 * (repeaterVisibility() below) on items belonging to a "disabled: true" repeater.
 *
 * A repeater's DOM shape depends on its *value* (row count), so — unlike text()/switcher()/color()
 * (control/text, control/switcher, control/color), whose markup is fixed — rows are built once and
 * only touched again on add/remove/reorder or when the active block changes. v-each was ruled out for
 * rows: it rebuilds every clone on each re-render, closing whatever row a user has open.
 *
 * A repeater's own row chrome (drag handle, echoed label, collapsible body) suits item shapes with
 * several/heavier fields, where a scannable summary matters more than seeing everything at once. For
 * a couple of short fields always shown in full (a links list, say), see the "repeatable section"
 * (controls/section-repeater.js) instead — same underlying value engine (controls/repeatable.js),
 * different chrome: no row/collapse at all, full field() UI (title/tooltip/description) per field,
 * "+" living in the section's own head rather than below a list.
 */

import { createSortableItem } from '../../sortable';
import { cloneTemplateElement } from '../../controls/template';
import {
  readItems, writeItems, patchItemAt, createDefaultItem, itemIndexOf, renumberItems, destroyItemFillers, minItems, maxItems, isItemConditionMet,
} from '../../controls/repeatable';

// Maps a repeater field type to the <template id="editrix-control-*"> it clones — see createRepeaterFieldControl() below. "select" isn't supported here; sidebar.html's own select template is hard-coded.
// "fill" reuses "color"'s template but stores a compound { type, color, alpha, image, video } object instead of a flat hex string.
const REPEATER_FIELD_TEMPLATES = {
  text: 'editrix-control-text',
  switcher: 'editrix-control-switcher',
  color: 'editrix-control-color',
  fill: 'editrix-control-color',
};

// True once a repeater is locked to exactly one permanent item ("min: 1, max: 1") — see createRepeaterItem()'s own comment.
function isLockedToOneItem(component, name) {
  return minItems(component, name) === 1 && maxItems(component, name) === 1;
}

// "disabled" (optional, formerly named "hideable") opts a repeater into a per-item visibility toggle (repeaterVisibility() below), Figma's per-fill "eye" icon; off by default. Named for the config key, not the behavior — isHideable() is what it actually gates.
function isHideable(component, name) {
  return !!component._controls[name]?.disabled;
}

// An item is visible unless explicitly toggled off — "visible" is a reserved top-level key, not a declared field, so older items default to "on".
function itemVisible(item) {
  return item?.visible !== false;
}

/**
 * Builds one item field's raw control markup — a clone of its REPEATER_FIELD_TEMPLATES entry, wired
 * to read/write this item's own slot via "e.repeaterField(name, key)". No wrapper chrome of its
 * own — the caller decides how to frame it: createRepeaterField() below wraps it in a trimmed
 * ".editrix-field" div (no tooltip/description/condition); section-repeater.js wraps the exact same
 * markup in the full "editrix-field-template" chrome instead, so both share this one clone-and-wire
 * step without duplicating REPEATER_FIELD_TEMPLATES or the per-type dispatch (repeaterField() below).
 *
 * @param {string} name - The repeatable control's own setting name.
 * @param {Object} fieldDef - One entry of its own `fields` definition.
 * @returns {HTMLElement}
 */
export function createRepeaterFieldControl(name, fieldDef) {
  const templateId = REPEATER_FIELD_TEMPLATES[fieldDef.type];

  if (!templateId) {
    throw new Error(`Youla.js: repeater field "${fieldDef.name}" has unsupported type "${fieldDef.type}" — add it to REPEATER_FIELD_TEMPLATES (control/repeater/index.js).`);
  }

  const control = cloneTemplateElement(templateId);
  // REPEATER_FIELD_TEMPLATES' own templates (text/switcher/color) are single-root — the clone IS the input, not a wrapper around one — so check the root itself before searching its descendants.
  const input = control.matches('input, select') ? control : control.querySelector('input, select');

  input.setAttribute('v-bind', `e.repeaterField(${JSON.stringify(name)}, ${JSON.stringify(fieldDef.name)})`);

  return control;
}

/**
 * Builds one item field's own markup for a classic repeater row — createRepeaterFieldControl()'s
 * control wrapped in ".editrix-field" (the same wrapper class controls/base.js's field() uses) but
 * without the tooltip/description machinery a full field() registration brings. "condition" (if the
 * field declares one) still works — see repeaterFieldVisibility() below — checked against this same
 * item's own values, not top-level settings.
 *
 * @param {string} name - The repeater control's own setting name.
 * @param {Object} fieldDef - One entry of the repeater's own `fields` definition.
 * @returns {HTMLElement}
 */
function createRepeaterField(name, fieldDef) {
  const wrapper = document.createElement('div');
  wrapper.className = `editrix-field editrix-field--${fieldDef.type}`;
  wrapper.dataset.title = fieldDef.title || '';
  wrapper.setAttribute('v-bind', `e.repeaterFieldVisibility(${JSON.stringify(name)}, ${JSON.stringify(fieldDef.name)})`);

  const control = document.createElement('div');
  control.className = 'editrix-field__control';
  control.append(createRepeaterFieldControl(name, fieldDef));
  wrapper.append(control);

  return wrapper;
}

/**
 * Builds one repeater row — drag handle, a collapsible head (label + optional visibility toggle),
 * remove, and its declared fields inside the collapsible body.
 *
 * "locked" (a "min: 1, max: 1" repeater) hides the head entirely in CSS (repeater.scss) — a
 * permanently-single item has nothing to drag/collapse/remove down to, so the row reads as a plain,
 * always-expanded field group. The visibility icon is always present in markup; its own "v-show"
 * (repeaterVisibility() below) decides whether it renders.
 *
 * @param {string} name
 * @param {number} index
 * @param {Object[]} fields - The repeater's own `fields` definition.
 * @param {boolean} locked
 * @returns {HTMLElement}
 */
function createRepeaterItem(name, index, fields, locked) {
  const el = cloneTemplateElement('editrix-repeater-item-template');
  const nameArg = JSON.stringify(name);

  el.dataset.index = index;
  el.classList.toggle('is-locked', locked);
  el.setAttribute('v-bind', `e.repeaterItemRoot(${nameArg})`);
  el.querySelector('[data-part="toggle"]').setAttribute('v-bind', `e.repeaterToggle(${nameArg})`);
  el.querySelector('[data-part="label"]').setAttribute('v-bind', `e.repeaterLabel(${nameArg}, ${JSON.stringify(fields[0]?.name || '')})`);
  el.querySelector('[data-part="visibility"]').setAttribute('v-bind', `e.repeaterVisibility(${nameArg})`);
  el.querySelector('[data-part="remove"]').setAttribute('v-bind', `e.repeaterRemove(${nameArg})`);

  const body = el.querySelector('[data-part="body"]');
  fields.forEach((fieldDef) => body.append(createRepeaterField(name, fieldDef)));

  return el;
}

/**
 * Builds the repeater control's own outer shell: the list's mount point, the expand/collapse-all
 * button, and an "Add item" button below the list. Registered as CONTROL_RENDERERS.repeater
 * (controls/render.js); contentFields() (youla-editrix.js) relocates the expand/collapse-all button
 * into the section head — "add" always stays below the list.
 *
 * @param {string} name
 * @returns {HTMLElement}
 */
export function renderRepeater(name) {
  const el = cloneTemplateElement('editrix-control-repeater');
  const nameArg = JSON.stringify(name);

  el.querySelector('[data-part="list"]').setAttribute('v-bind', `e.repeaterList(${nameArg})`);
  el.querySelector('[data-part="toggle-all"]').setAttribute('v-bind', `e.repeaterToggleAll(${nameArg})`);
  el.querySelector('[data-part="add"]').setAttribute('v-bind', `e.repeaterAdd(${nameArg})`);

  return el;
}

export function createRepeaterControl() {
  return {
    // v-bind="e.repeaterList(name)" — builds this field's rows the first time it's resolved, and again whenever the active block changes (see this file's header comment for why ":data-owner", not v-each, builds them).
    // "@dragover.prevent"/"@drop.prevent" make the list itself a valid drop target too, in case some bit of its own box isn't covered by a row.
    repeaterList(name) {
      return {
        ':data-owner'() {
          const owner = this.activeBlock || '__page__';

          if (this.$el.dataset.owner !== owner) {
            this.$el.dataset.owner = owner;
            destroyItemFillers(this.$el);
            this.$el.innerHTML = '';

            const fields = this._controls[name]?.fields || [];
            const locked = isLockedToOneItem(this, name);
            readItems(this, name).forEach((item, index) => {
              const row = createRepeaterItem(name, index, fields, locked);
              this.$el.append(row);
              this.$root.__x.initialize(row);
            });
          }
          return owner;
        },
        // Same dropEffect pinning as sortable.js's createSortableItem()'s own "@dragover".
        '@dragover.prevent'(e) {
          e.dataTransfer.dropEffect = 'move';
        },
        '@drop.prevent'() {},
      };
    },

    // v-bind="e.repeaterAdd(name)" on the "Add item" button below the list — hidden once "max" (default: unlimited) is reached, so a locked ("min: 1, max: 1") repeater never shows it.
    repeaterAdd(name) {
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

          const fields = this._controls[name]?.fields || [];
          const index = items.length;

          writeItems(this, name, [...items, createDefaultItem(fields)]);

          const list = this.$el.closest('.editrix-repeater').querySelector('[data-part="list"]');
          const row = createRepeaterItem(name, index, fields, isLockedToOneItem(this, name));
          list.append(row);
          this.$root.__x.initialize(row);
        },
      };
    },

    // v-bind="e.repeaterItemRoot(name)" on a row's own root — draggable reordering via sortable.js's createSortableItem(), animated by animateReorder(). Needs ".editrix-repeater-item" to declare its own "transform" transition (repeater.scss).
    repeaterItemRoot(name) {
      return createSortableItem({
        read: (component) => readItems(component, name),
        write: (component, items) => writeItems(component, name, items),
      });
    },

    // v-bind="e.repeaterToggle(name)" on a row's head — expands/collapses its body; a plain DOM class, not part of the reactive value.
    repeaterToggle() {
      return {
        '@click.stop.prevent'() {
          this.$el.closest('[data-repeater-item]').classList.toggle('is-open');
        },
      };
    },

    // v-bind="e.repeaterToggleAll(name)" — expands every row if any is collapsed, otherwise collapses all; icon/title are set directly since there's no reactive state to bind them to.
    repeaterToggleAll(name) {
      return {
        '@click'() {
          const list = this.$el.closest('.editrix-section')?.querySelector('[data-part="list"]');
          const rows = list ? [...list.children] : [];
          const allOpen = rows.length > 0 && rows.every((row) => row.classList.contains('is-open'));

          rows.forEach((row) => row.classList.toggle('is-open', !allOpen));

          this.$el.classList.toggle('ph-caret-double-down', allOpen);
          this.$el.classList.toggle('ph-caret-double-up', !allOpen);
          this.$el.title = allOpen ? 'Expand all' : 'Collapse all';
        },
      };
    },

    // v-bind="e.repeaterLabel(name, 'question')" — echoes the row's first declared field back as its summary (Elementor's own repeater does the same), falling back to "Item N" once empty.
    repeaterLabel(name, key) {
      return {
        'v-text'() {
          const index = itemIndexOf(this.$el);
          const value = key ? readItems(this, name)[index]?.[key] : undefined;

          return (typeof value === 'string' && value.trim()) || `Item ${index + 1}`;
        },
      };
    },

    // v-bind="e.repeaterVisibility(name)" on a row's eye icon — hides an item without removing it (Figma's own per-fill toggle); opt-in per repeater via "disabled" (isHideable() above). Toggles a reserved top-level "visible" key, not a declared field.
    repeaterVisibility(name) {
      return {
        'v-show'() {
          return isHideable(this, name);
        },
        ':class'() {
          const visible = itemVisible(readItems(this, name)[itemIndexOf(this.$el)]);
          return { 'ph-eye': visible, 'ph-eye-slash': !visible };
        },
        '@click.stop.prevent'() {
          const index = itemIndexOf(this.$el);
          const visible = itemVisible(readItems(this, name)[index]);
          patchItemAt(this, name, index, { visible: !visible });
        },
      };
    },

    // v-bind="e.repeaterRemove(name)" on a row's trash icon — hidden once "min" (default: 0) is reached. A locked ("min: 1, max: 1") repeater hides the whole row instead (createRepeaterItem()), so this guard never actually fires there.
    repeaterRemove(name) {
      return {
        'v-show'() {
          return readItems(this, name).length > minItems(this, name);
        },
        '@click.stop.prevent'() {
          const items = readItems(this, name);

          // Same belt-and-braces as repeaterAdd()'s own "max" guard.
          if (items.length <= minItems(this, name)) {
            return;
          }

          const row = this.$el.closest('[data-repeater-item]');
          const index = itemIndexOf(row);
          const list = row.parentElement;

          writeItems(this, name, items.filter((_, i) => i !== index));
          destroyItemFillers(row);
          row.remove();
          renumberItems(list);
        },
      };
    },

    // v-bind="e.repeaterFieldVisibility(name, 'accent_color')" on an item field's own ".editrix-field" wrapper (createRepeaterField() above) — item-scoped counterpart of base.js's field() "v-show", via isItemConditionMet() (controls/repeatable.js): the field's declared "condition" is checked against this same item's own values, not top-level settings.
    repeaterFieldVisibility(name, key) {
      return {
        'v-show'() {
          const fieldDef = (this._controls[name]?.fields || []).find((field) => field.name === key);
          const item = readItems(this, name)[itemIndexOf(this.$el)];

          return isItemConditionMet(item, fieldDef?.condition);
        },
      };
    },

    // v-bind="e.repeaterField(name, 'question')" — dispatches on the field's declared type, mirroring control/text/control/switcher/control/color but reading/writing this item's own slot instead of a top-level setting. Shared by classic repeater rows (createRepeaterField() above) and repeatable-section items (section-repeater.js) alike — see createRepeaterFieldControl()'s own comment.
    repeaterField(name, key) {
      const fieldDef = (this._controls[name]?.fields || []).find((field) => field.name === key);

      if (fieldDef?.type === 'switcher') {
        return {
          ':checked'() {
            return !!readItems(this, name)[itemIndexOf(this.$el)]?.[key];
          },
          '@change'(e) {
            patchItemAt(this, name, itemIndexOf(this.$el), { [key]: e.target.checked });
          },
        };
      }

      if (fieldDef?.type === 'color') {
        return {
          'v-filler'() {
            if (!this.$el._x_filler) {
              this.$el.value = readItems(this, name)[itemIndexOf(this.$el)]?.[key] ?? fieldDef.default ?? '#000000';
            }

            return {
              sources: ['solid'],
              onChange: (hex) => patchItemAt(this, name, itemIndexOf(this.$el), { [key]: hex }),
            };
          },
        };
      }

      // "fill" — the compound solid/image/video/alpha counterpart to "color" above: value is a whole { type, color, alpha, image, video } object under item[key], not a flat hex string. "sources" is this field's own option (default: all three), so one repeater can mix a full "fill" field with a solid-only "color" field.
      if (fieldDef?.type === 'fill') {
        return {
          'v-filler'() {
            const index = itemIndexOf(this.$el);
            const fill = readItems(this, name)[index]?.[key] || fieldDef.default || {};

            if (!this.$el._x_filler) {
              this.$el.value = fill.color || '#1069FB';
            }

            return {
              sources: fieldDef.sources || ['solid', 'image', 'video'],
              alpha: fill.alpha ?? 100,
              source: fill.type,
              image: fill.image || undefined,
              video: fill.video || undefined,
              onChange: (hex, alpha) => patchItemAt(this, name, index, { [key]: { ...fill, color: hex, alpha } }),
              onSourceChange: (type) => patchItemAt(this, name, index, { [key]: { ...fill, type } }),
              // Both image and video persist here — dropping one would reseed every future mount from a stale value, discarding whatever the user just uploaded.
              onMediaChange: (type, media) => patchItemAt(this, name, index, { [key]: { ...fill, [type]: { ...media } } }),
            };
          },
        };
      }

      // Default: "text".
      return {
        ':value'() {
          return readItems(this, name)[itemIndexOf(this.$el)]?.[key] ?? '';
        },
        ':placeholder'() {
          return fieldDef?.placeholder ?? '';
        },
        '@input'(e) {
          patchItemAt(this, name, itemIndexOf(this.$el), { [key]: e.target.value });
        },
      };
    },
  };
}
