/**
 * The "repeater" control — a generic Figma/Elementor-style repeater. An item's shape is declared
 * entirely by the control's own `fields` array (any mix of REPEATER_FIELD_TEMPLATES below), so one
 * control covers FAQ items, tabs, nav links, and (via the "fill" field type) a Figma-style
 * multi-fill list.
 *
 * Declare it like any other control:
 *
 *   {
 *     name: 'items', type: 'repeater', default: [{ question: '…', answer: '…', highlighted: false }],
 *     min: 0, max: 10, // optional — see minItems()/maxItems() below; default: 0 / unlimited.
 *     hideable: false, // optional — see isHideable()/repeaterVisibility() below.
 *     fields: [
 *       { name: 'question', title: 'Question', type: 'text', default: 'New question' },
 *       { name: 'answer', title: 'Answer', type: 'text', default: '' },
 *       { name: 'highlighted', title: 'Highlight', type: 'switcher', default: false },
 *     ],
 *   }
 *
 * Value shape: object[], keyed by each field's own `name`, plus a reserved top-level "visible" key
 * (repeaterVisibility() below) on items belonging to a "hideable: true" repeater.
 *
 * A repeater's DOM shape depends on its *value* (row count), so — unlike text()/switcher()/color()
 * (controls/data.js), whose markup is fixed — rows are built once and only touched again on
 * add/remove/reorder or when the active block changes. v-each was ruled out for rows: it rebuilds
 * every clone on each re-render, closing whatever row a user has open.
 */

import { createSortableItem } from '../sortable';

// Maps a repeater field type to the <template id="editrix-control-*"> it clones — see repeaterField() below. "select" isn't supported here; sidebar.html's own select template is hard-coded.
// "fill" reuses "color"'s template but stores a compound { type, color, alpha, image, video } object instead of a flat hex string.
const REPEATER_FIELD_TEMPLATES = {
  text: 'editrix-control-text',
  switcher: 'editrix-control-switcher',
  color: 'editrix-control-color',
  fill: 'editrix-control-color',
};

/**
 * Clones a single-root <template>'s content by id.
 *
 * @param {string} id
 * @returns {HTMLElement}
 */
function cloneTemplate(id) {
  const template = document.getElementById(id);

  if (!template) {
    throw new Error(`Youla.js: no <template id="${id}"> found — is view/editrix/controls/repeater.html missing?`);
  }
  return template.content.firstElementChild.cloneNode(true);
}

// A row's own index is read off its "data-index" rather than baked into its bindings, so add/remove/reorder only ever need to touch that attribute.
function itemIndexOf(el) {
  return +el.closest('[data-repeater-item]').dataset.index;
}

function readItems(component, name) {
  return component.getValue(name) || [];
}

// "min"/"max" (both optional, alongside "fields") bound how many items a repeater may hold; leaving "max" off means unlimited, not "same as min".
// "min" floors at 0 (the list can be emptied) and "max" floors at 1; `{ min: 1, max: 1 }` locks the list to exactly one permanent item — see createRepeaterItem()'s "locked" handling.
function minItems(component, name) {
  const declared = component._controls[name]?.min;
  return Math.max(0, declared ?? 0);
}

function maxItems(component, name) {
  const declared = component._controls[name]?.max;
  return declared === undefined ? Infinity : Math.max(1, declared);
}

// True once a repeater is locked to exactly one permanent item ("min: 1, max: 1") — see createRepeaterItem()'s own comment.
function isLockedToOneItem(component, name) {
  return minItems(component, name) === 1 && maxItems(component, name) === 1;
}

// "hideable" (optional) opts a repeater into a per-item visibility toggle (repeaterVisibility() below), Figma's per-fill "eye" icon; off by default.
function isHideable(component, name) {
  return !!component._controls[name]?.hideable;
}

// An item is visible unless explicitly toggled off — "visible" is a reserved top-level key, not a declared field, so older items default to "on".
function itemVisible(item) {
  return item?.visible !== false;
}

function writeItems(component, name, items) {
  component.setValue(name, items);
}

// Merges "patch" into one item by index.
function patchItemAt(component, name, index, patch) {
  const items = readItems(component, name);
  writeItems(component, name, items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
}

function renumberRepeaterItems(list) {
  [...list.children].forEach((row, index) => {
    row.dataset.index = index;
  });
}

// v-filler hangs document-level listeners on any <input> it mounts, with nothing watching for that input leaving the DOM — sweep every <input> and destroy() before wiping innerHTML.
function destroyItemFillers(scope) {
  scope.querySelectorAll('input').forEach((input) => input._x_filler?.destroy());
}

// One fresh item, seeded from each declared field's own default.
function createDefaultItem(fields) {
  return Object.fromEntries(fields.map((field) => [field.name, field.default]));
}

/**
 * Builds one item field's own markup — a clone of its REPEATER_FIELD_TEMPLATES entry, wrapped in
 * ".editrix-field" (the same wrapper class controls/base.js's field() uses) but without the
 * tooltip/description/condition machinery a full field() registration brings.
 *
 * @param {string} name - The repeater control's own setting name.
 * @param {Object} fieldDef - One entry of the repeater's own `fields` definition.
 * @returns {HTMLElement}
 */
function createRepeaterField(name, fieldDef) {
  const templateId = REPEATER_FIELD_TEMPLATES[fieldDef.type];

  if (!templateId) {
    throw new Error(`Youla.js: repeater field "${fieldDef.name}" has unsupported type "${fieldDef.type}" — add it to REPEATER_FIELD_TEMPLATES (controls/repeater.js).`);
  }

  const wrapper = document.createElement('div');
  wrapper.className = `editrix-field editrix-field--${fieldDef.type}`;
  wrapper.dataset.title = fieldDef.title || '';

  const control = document.createElement('div');
  control.className = 'editrix-field__control';
  control.append(cloneTemplate(templateId));
  wrapper.append(control);

  const input = wrapper.querySelector('input, select');
  input.setAttribute('v-bind', `e.repeaterField(${JSON.stringify(name)}, ${JSON.stringify(fieldDef.name)})`);

  return wrapper;
}

/**
 * Builds one repeater row — drag handle, a collapsible head (label + caret + optional visibility
 * toggle), remove, and its declared fields inside the collapsible body.
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
  const el = cloneTemplate('editrix-repeater-item-template');
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
 * Builds the repeater control's own outer shell: the list's mount point, the "+" add button, and
 * the expand/collapse-all button. Registered as CONTROL_RENDERERS.repeater (controls/render.js);
 * both buttons get relocated into the section head by contentFields() (youla-editrix.js).
 *
 * @param {string} name
 * @returns {HTMLElement}
 */
export function renderRepeaterControl(name) {
  const el = cloneTemplate('editrix-control-repeater');
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

    // v-bind="e.repeaterAdd(name)" on the "+" button — hidden once "max" (default: unlimited) is reached, so a locked ("min: 1, max: 1") repeater never shows it.
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

          // ".editrix-section", not ".editrix-repeater": contentFields() relocates this button into the section's own head row, so the section is the nearest ancestor common to both.
          const list = this.$el.closest('.editrix-section').querySelector('[data-part="list"]');
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

    // v-bind="e.repeaterVisibility(name)" on a row's eye icon — hides an item without removing it (Figma's own per-fill toggle); opt-in per repeater via "hideable" (isHideable() above). Toggles a reserved top-level "visible" key, not a declared field.
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
          renumberRepeaterItems(list);
        },
      };
    },

    // v-bind="e.repeaterField(name, 'question')" — dispatches on the field's declared type, mirroring controls/data.js's text()/switcher()/color() but reading/writing this item's own slot instead of a top-level setting.
    repeaterField(name, key) {
      const fieldDef = (this._controls[name]?.fields || []).find((field) => field.name === key);

      if (fieldDef?.type === 'switcher') {
        return {
          ':checked'() {
            return !!readItems(this, name)[itemIndexOf(this.$el)]?.[key];
          },
          ':disabled'() {
            return !!this._controls[name]?.disabled;
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
              disabled: !!this._controls[name]?.disabled,
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
              disabled: !!this._controls[name]?.disabled,
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
        ':disabled'() {
          return !!this._controls[name]?.disabled;
        },
        '@input'(e) {
          patchItemAt(this, name, itemIndexOf(this.$el), { [key]: e.target.value });
        },
      };
    },
  };
}
