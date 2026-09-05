// The "repeater" control — a collapsible, reorderable list whose item shape is the control's own
// `fields` array. Rows are built once, not v-each'd (would reset an open row on re-render); every
// row binding takes no "name" (via fieldName()) except repeaterField()/repeaterFieldVisibility().

import { createSortableItem } from '../../sortable';
import { cloneTemplateElement } from '../../controls/template';
import { fieldName } from '../../controls/base';
import {
  readItems, writeItems, patchItemAt, createDefaultItem, itemIndexOf, renumberItems, destroyItemFillers, minItems, maxItems, isItemConditionMet,
} from '../../controls/repeatable';

// Field type → <template id="editrix-control-*"> to clone; "select" isn't supported (sidebar.html's own select template is hard-coded).
// "fill" reuses "color"'s template but stores a compound { type, color, alpha, image, video } object.
const REPEATER_FIELD_TEMPLATES = {
  text: 'editrix-control-text',
  switcher: 'editrix-control-switcher',
  color: 'editrix-control-color',
  fill: 'editrix-control-color',
};

/**
 * True once a repeater is locked to exactly one permanent item ("min: 1, max: 1") — see
 * repeaterItemRoot()'s own ":class".
 */
function isLockedToOneItem(component, name) {
  return minItems(component, name) === 1 && maxItems(component, name) === 1;
}

/**
 * "disabled" opts into a per-item visibility toggle (repeaterVisibility()) — off by default;
 * named for the config key, isHideable() gates it.
 */
function isHideable(component, name) {
  return !!component._controls[name]?.disabled;
}

/**
 * An item is visible unless explicitly toggled off — "visible" is a reserved top-level key, not
 * a declared field.
 */
function itemVisible(item) {
  return item?.visible !== false;
}

/**
 * Clones one item field's raw control from REPEATER_FIELD_TEMPLATES, wired to "e.repeaterField(name,
 * key)". No wrapper chrome — createRepeaterField() below and section-repeater.js each wrap it
 * differently, sharing this one clone-and-wire step.
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
  // REPEATER_FIELD_TEMPLATES' own templates (text/switcher/color) are single-root — the clone IS the input, not a wrapper around one.
  const input = control.matches('input, select') ? control : control.querySelector('input, select');

  input.setAttribute('v-bind', `e.repeaterField(${JSON.stringify(name)}, ${JSON.stringify(fieldDef.name)})`);

  return control;
}

/**
 * Wraps one item field in a trimmed ".editrix-field" (no tooltip/description, but "condition" still
 * works via repeaterFieldVisibility()). Takes "name" explicitly — this wrapper reuses the
 * ".editrix-field" class without a "data-name", so fieldName() would resolve to the wrong ancestor.
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
 * Builds one repeater row. Chrome bindings are already static in editrix-repeater-item-template —
 * only "data-index" and the declared fields genuinely depend on this call.
 *
 * @param {string} name
 * @param {number} index
 * @param {Object[]} fields - The repeater's own `fields` definition.
 * @returns {HTMLElement}
 */
function createRepeaterItem(name, index, fields) {
  const el = cloneTemplateElement('editrix-repeater-item-template');

  el.dataset.index = index;

  const body = el.querySelector('[data-part="body"]');
  fields.forEach((fieldDef) => body.append(createRepeaterField(name, fieldDef)));

  return el;
}

export function createRepeaterControl() {
  return {
    /**
     * v-bind="e.repeaterList()" — builds rows on first resolve and whenever the active block
     * changes. "@dragover.prevent"/"@drop.prevent" make the list itself a valid drop target too.
     */
    repeaterList() {
      return {
        ':data-owner'() {
          const name = fieldName(this.$el);
          const owner = this.activeBlock || '__page__';

          if (this.$el.dataset.owner !== owner) {
            this.$el.dataset.owner = owner;
            destroyItemFillers(this.$el);
            this.$el.innerHTML = '';

            const fields = this._controls[name]?.fields || [];
            readItems(this, name).forEach((item, index) => {
              const row = createRepeaterItem(name, index, fields);
              this.$el.append(row);
              this.$root.__x.initialize(row);
            });
          }
          return owner;
        },
        '@dragover.prevent'(e) {
          e.dataTransfer.dropEffect = 'move';
        },
        '@drop.prevent'() {},
      };
    },

    /**
     * v-bind="e.repeaterAdd()" — hidden once "max" is reached (a locked "min:1,max:1" repeater
     * never shows it).
     */
    repeaterAdd() {
      return {
        'v-show'() {
          const name = fieldName(this.$el);
          return readItems(this, name).length < maxItems(this, name);
        },
        '@click'() {
          const name = fieldName(this.$el);
          const items = readItems(this, name);

          // Belt-and-braces against "v-show" being bypassed by a stray click right at the "max" boundary.
          if (items.length >= maxItems(this, name)) {
            return;
          }

          const fields = this._controls[name]?.fields || [];
          const index = items.length;

          writeItems(this, name, [...items, createDefaultItem(fields)]);

          const list = this.$el.closest('.editrix-repeater').querySelector('[data-part="list"]');
          const row = createRepeaterItem(name, index, fields);

          // Open right away — a freshly added item is empty, so its fields are exactly what the user is about to fill in next.
          row.classList.add('is-open');
          list.append(row);
          this.$root.__x.initialize(row);
        },
      };
    },

    /**
     * v-bind="e.repeaterItemRoot()" — draggable reordering (sortable.js); ":class" hides the head
     * once locked to one permanent item ("min:1,max:1").
     */
    repeaterItemRoot() {
      return {
        ...createSortableItem({
          read: (component) => readItems(component, fieldName(component.$el)),
          write: (component, items) => writeItems(component, fieldName(component.$el), items),
          handle: '.editrix-repeater-item__handle',
        }),
        ':class'() {
          return { 'is-locked': isLockedToOneItem(this, fieldName(this.$el)) };
        },
      };
    },

    /**
     * v-bind="e.repeaterToggle()" — expands/collapses the body via a plain DOM class, not the
     * reactive value.
     */
    repeaterToggle() {
      return {
        '@click.stop.prevent'() {
          this.$el.closest('[data-repeater-item]').classList.toggle('is-open');
        },
      };
    },

    /**
     * v-bind="e.repeaterToggleAll()" — expands/collapses all rows. Takes no "name": contentFields()
     * relocates this icon into the section head, so it works via closest ".editrix-section", not
     * ".editrix-field".
     */
    repeaterToggleAll() {
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

    /**
     * v-bind="e.repeaterLabel()" — echoes the row's first declared field as its summary, falling
     * back to "Item N".
     */
    repeaterLabel() {
      return {
        'v-text'() {
          const name = fieldName(this.$el);
          const key = this._controls[name]?.fields?.[0]?.name || '';
          const index = itemIndexOf(this.$el);
          const value = key ? readItems(this, name)[index]?.[key] : undefined;

          return (typeof value === 'string' && value.trim()) || `Item ${index + 1}`;
        },
      };
    },

    /**
     * v-bind="e.repeaterVisibility()" — hides an item without removing it; opt-in via "disabled"
     * (isHideable()), toggles the reserved "visible" key.
     */
    repeaterVisibility() {
      return {
        'v-show'() {
          return isHideable(this, fieldName(this.$el));
        },
        ':class'() {
          const name = fieldName(this.$el);
          const visible = itemVisible(readItems(this, name)[itemIndexOf(this.$el)]);
          return { 'ph-eye': visible, 'ph-eye-slash': !visible };
        },
        '@click.stop.prevent'() {
          const name = fieldName(this.$el);
          const index = itemIndexOf(this.$el);
          const visible = itemVisible(readItems(this, name)[index]);
          patchItemAt(this, name, index, { visible: !visible });
        },
      };
    },

    /**
     * v-bind="e.repeaterRemove()" — hidden once "min" is reached; a locked repeater hides the
     * whole row instead (repeaterItemRoot()'s ":class").
     */
    repeaterRemove() {
      return {
        'v-show'() {
          const name = fieldName(this.$el);
          return readItems(this, name).length > minItems(this, name);
        },
        '@click.stop.prevent'() {
          const name = fieldName(this.$el);
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

    /**
     * v-bind="e.repeaterFieldVisibility(name, 'accent_color')" — item-scoped "v-show": "condition"
     * checked against this item's own values (createRepeaterField()'s own comment explains the
     * explicit "name").
     */
    repeaterFieldVisibility(name, key) {
      return {
        'v-show'() {
          const fieldDef = (this._controls[name]?.fields || []).find((field) => field.name === key);
          const item = readItems(this, name)[itemIndexOf(this.$el)];

          return isItemConditionMet(item, fieldDef?.condition);
        },
      };
    },

    /**
     * v-bind="e.repeaterField(name, 'question')" — dispatches on the field's type, reading/writing
     * this item's own slot. Shared by classic rows and repeatable-section items
     * (createRepeaterFieldControl()).
     */
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

      // "fill" — compound solid/image/video/alpha counterpart to "color": value is a { type, color, alpha, image, video } object, not a flat hex string.
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
