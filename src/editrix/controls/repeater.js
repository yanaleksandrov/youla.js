/**
 * The "repeater" control — a generic Figma/Elementor-style repeater. Unlike "fill" (controls/
 * fill.js), whose rows are a fixed Fill shape with exactly one v-filler field each, a repeater's
 * own item shape is declared entirely by its field definition's own `fields` array (any mix of the
 * types in REPEATER_FIELD_TYPES below), so this one control covers every future "list of things,
 * each with a few fields" need (FAQ items, tabs, nav links, ...) instead of hand-rolling a new
 * fill.js-shaped module per block type. Declare it like any other control:
 *
 *   {
 *     name: 'items', type: 'repeater', default: [{ question: '…', answer: '…', highlighted: false }],
 *     min: 0, max: 10, // both optional; see minItems()/maxItems() below — default: 0 / unlimited.
 *     // "min: 1, max: 1" is a special case: exactly one item, permanently — see createRepeaterItem()'s
 *     // own "locked" comment for what that changes about a row's own markup.
 *     fields: [
 *       { name: 'question', title: 'Question', type: 'text', default: 'New question' },
 *       { name: 'answer', title: 'Answer', type: 'text', default: '' },
 *       { name: 'highlighted', title: 'Highlight', type: 'switcher', default: false },
 *     ],
 *   }
 *
 * Value shape: object[], each keyed by the declared fields' own `name`s — for the example above,
 * `[{ question: '...', answer: '...', highlighted: false }, ...]`.
 *
 * Same "DOM shape depends on value, so it's built and kept in sync by hand" situation as fill.js —
 * see that file's own header comment, which applies here verbatim (rows are created once, in
 * repeaterList()'s ":data-owner" binding, and only touched again on add/remove/reorder or an
 * active-block switch; v-each was ruled out there for the same reasons).
 */

import { animateReorder } from '../animate-reorder';

// One entry per field type a repeater item can use — what <template id="editrix-control-*">
// (sidebar.html) its own input is cloned from, and how repeaterField() (below) reads/writes it.
// Reuses the exact same templates/markup CONTROL_RENDERERS (controls/render.js) builds top-level
// text/switcher/color fields from, so a repeater's own fields look and behave identically to their
// top-level counterparts. "select" is deliberately left out — sidebar.html's own
// "#editrix-control-select" template hard-codes align's own option list rather than reading it off
// a definition (see its own comment in controls/data.js), so it isn't reusable generically yet;
// adding a type here (plus a case in repeaterField() below) is the only step needed to use it.
const REPEATER_FIELD_TEMPLATES = {
  text: 'editrix-control-text',
  switcher: 'editrix-control-switcher',
  color: 'editrix-control-color',
};

/**
 * Clones a single-root <template>'s content by id — same convention as fill.js's own helper.
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

// A row's own index is read off its "data-index" rather than baked into its bindings, exactly like
// fill.js's own fillIndexOf() — so add/remove/reorder only ever need to touch "data-index".
function itemIndexOf(el) {
  return +el.closest('[data-repeater-item]').dataset.index;
}

function readItems(component, name) {
  return component.getValue(name) || [];
}

// "min"/"max" (both optional, on the repeater's own definition, right alongside "fields" — see
// this file's own header comment) — how many items the list is allowed to hold, each independent
// of whether the other was even declared: leaving "max" off means "no ceiling", not "same as min".
// "min" floors at 0 — a repeater can be emptied out entirely unless a block author says otherwise
// — while "max" floors at 1 (a repeater always has room for at least one item; "the list can never
// have any items" isn't a thing this control supports). Declaring `{ min: 1, max: 1 }` locks the
// list to exactly one item, permanently — see createRepeaterItem()'s own "locked" comment for what
// that changes about a row's own markup, and repeaterAdd()'s "+" for why it hides in that case too.
function minItems(component, name) {
  const declared = component._controls[name]?.min;
  return Math.max(0, declared ?? 0);
}

function maxItems(component, name) {
  const declared = component._controls[name]?.max;
  return declared === undefined ? Infinity : Math.max(1, declared);
}

// True once a repeater is locked to exactly one permanent item ("min: 1, max: 1") — see
// createRepeaterItem()'s own comment for what that changes about a row's own markup.
function isLockedToOneItem(component, name) {
  return minItems(component, name) === 1 && maxItems(component, name) === 1;
}

function writeItems(component, name, items) {
  component.setValue(name, items);
}

// Merges "patch" into one item by index — fill.js's own patchFillAt(), generalized to an
// arbitrarily-shaped item instead of a fixed Fill.
function patchItemAt(component, name, index, patch) {
  const items = readItems(component, name);
  writeItems(component, name, items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
}

function renumberRepeaterItems(list) {
  [...list.children].forEach((row, index) => {
    row.dataset.index = index;
  });
}

// Same leak concern as fill.js's own destroyFillItemFillers() — v-filler (youla-filler.js) hangs
// document/window-level listeners and a floating panel off any <input> it mounts on (a repeater's
// own "color"-type fields), and nothing watches for that input leaving the DOM. A plain sweep over
// every <input> (rather than fill.js's targeted "[data-part='filler']" selector) is fine here — a
// repeater's other field types never set "_x_filler", so destroy() is simply never called on them.
function destroyItemFillers(scope) {
  scope.querySelectorAll('input').forEach((input) => input._x_filler?.destroy());
}

// One fresh item, seeded from each declared field's own default.
function createDefaultItem(fields) {
  return Object.fromEntries(fields.map((field) => [field.name, field.default]));
}

/**
 * Builds one item field's own markup — a clone of whichever REPEATER_FIELD_TEMPLATES entry its
 * type maps to, wrapped in ".editrix-field" (the same wrapper class controls/base.js's field()
 * uses, reused here directly rather than duplicating its title/spacing rules — see fields.scss)
 * so a repeater's own fields read identically to their top-level counterparts, just without the
 * tooltip/description/condition machinery a full field() registration brings — a repeater item's
 * own fields are declared once, statically, by the repeater's own definition, not independently
 * conditional.
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
 * Builds one repeater row — drag handle, a collapsible head (label + caret), remove, and its own
 * declared fields inside the collapsible body.
 *
 * "locked" (true only for a "min: 1, max: 1" repeater — isLockedToOneItem() above) hides the head
 * entirely (".editrix-repeater-item__head", styled in repeater.scss) — dragging/collapsing/
 * removing a permanently-single item has nothing to act on (nothing to reorder against, nothing
 * else to remove down to), so the row reads as a plain, always-expanded field group instead of a
 * collapsible list item. The body's own "hidden unless .is-open" rule (repeater.scss) is bypassed
 * the same way, in CSS, off this same class — repeaterToggle() itself is left registered on the
 * (now hidden) head rather than special-cased away, since it simply never gets a click to handle.
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
  el.querySelector('[data-part="remove"]').setAttribute('v-bind', `e.repeaterRemove(${nameArg})`);

  const body = el.querySelector('[data-part="body"]');
  fields.forEach((fieldDef) => body.append(createRepeaterField(name, fieldDef)));

  return el;
}

/**
 * Builds the repeater control's own outer shell — the list's mount point, the "+" button that
 * appends a fresh item seeded from the repeater's own declared field defaults, and the expand/
 * collapse-all button. Registered as controls/render.js's CONTROL_RENDERERS.repeater; both buttons
 * (`[data-part="add"]`/`[data-part="toggle-all"]`) get relocated into its section's
 * `.editrix-section-head` by contentFields() (youla-editrix.js), exactly like the fill control's
 * own "+" — see that file's own comment.
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
    // v-bind="e.repeaterList(name)" on ".editrix-repeater-list" — builds this field's rows the
    // first time it's resolved, and again whenever the *active block* changes. Mirrors fill.js's
    // own fillList() exactly, including why ":data-owner" (not v-each) is doing the building — see
    // that file's own comment.
    //
    // Its own "@dragover.prevent"/"@drop.prevent" make the *list itself* — not just each row — a
    // valid drop target too: repeaterItemRoot()'s own "@dragover.prevent" only fires while the
    // pointer sits over a row, so without this, any bit of the list's own box that isn't part of a
    // row would have nothing calling preventDefault() as the pointer crosses it, and the browser
    // falls back to its default "not-allowed" cursor for anywhere preventDefault() wasn't called on
    // "dragover". Belt-and-braces at this point rather than the actual fix, now that
    // ".editrix-repeater-list" no longer has a "gap" of its own for the pointer to cross in the
    // first place (repeater.scss) — kept here in case some future change reintroduces list-level
    // padding/spacing a row doesn't itself cover. No reorder logic needed either way:
    // repeaterItemRoot() already re-fires (and keeps reordering) the moment the pointer re-enters a
    // row.
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
        // "dropEffect" set here too, for the same reason repeaterItemRoot()'s own "@dragover"
        // sets it — see that binding's own comment — so this fallback path pins the cursor the
        // same way instead of leaving it unset on whatever sliver of the list it ever actually
        // fires for.
        '@dragover.prevent'(e) {
          e.dataTransfer.dropEffect = 'move';
        },
        '@drop.prevent'() {},
      };
    },

    // v-bind="e.repeaterAdd(name)" on the control's own "+" button — hidden once "max" (default:
    // unlimited) is reached, so an explicit "min: 1, max: 1" repeater (isLockedToOneItem()) never
    // shows it at all, matching a fixed one-item list's own "add" button making no sense to offer
    // in the first place.
    repeaterAdd(name) {
      return {
        'v-show'() {
          return readItems(this, name).length < maxItems(this, name);
        },
        '@click'() {
          const items = readItems(this, name);

          // Belt-and-braces against the "v-show" above ever getting bypassed (e.g. a stray click
          // queued right as the count crosses "max") — same reasoning as repeaterRemove()'s own
          // "min" guard below.
          if (items.length >= maxItems(this, name)) {
            return;
          }

          const fields = this._controls[name]?.fields || [];
          const index = items.length;

          writeItems(this, name, [...items, createDefaultItem(fields)]);

          // ".editrix-section", not ".editrix-repeater": contentFields() (youla-editrix.js)
          // relocates this button out of ".editrix-repeater" into the section's own head row, so
          // ".editrix-repeater" (and its "[data-part='list']") is no longer an ancestor — the
          // section is the nearest element still common to both. Same reasoning as fill.js's own
          // fillAdd().
          const list = this.$el.closest('.editrix-section').querySelector('[data-part="list"]');
          const row = createRepeaterItem(name, index, fields, isLockedToOneItem(this, name));
          list.append(row);
          this.$root.__x.initialize(row);
        },
      };
    },

    // v-bind="e.repeaterItemRoot(name)" on a row's own root — draggable reordering, identical to
    // fill.js's own fillItemRoot() (adapted to this module's readItems/writeItems), plus the same
    // animateReorder() FLIP animation youla-editrix.js's own sortable() uses: swapping the dragged
    // row past a sibling still reorders the DOM immediately (writeItems()/renumberRepeaterItems()
    // on @dragend still just read whatever order is currently on screen), but every row that
    // shifts as a result now slides into its new spot instead of snapping there — see
    // animate-reorder.js's own comment for how. Needs ".editrix-repeater-item" to declare a
    // "transform" transition of its own (repeater.scss) — animateReorder() only drives the
    // property, the actual easing/duration is CSS's.
    repeaterItemRoot(name) {
      return {
        ':draggable': 'true',
        // "effectAllowed"/"dropEffect" — left unset, a native HTML5 drag's own OS-drawn cursor
        // (not a CSS "cursor" property — that has no effect once a real drag session is under
        // way) is free to fall back to its own per-browser default on every single "dragover"
        // tick, and that default isn't guaranteed stable frame to frame even while hovering a
        // location that's been "preventDefault()"-ed the entire time — which reads exactly as the
        // reported flicker between the drag icon and "not-allowed", regardless of whether
        // "dragover" itself was prevented. Declaring both explicitly, once here and again on every
        // "dragover" below, pins the browser to one answer instead of leaving it to guess.
        '@dragstart'(e) {
          this.$el.classList.add('is-dragging');
          e.dataTransfer.effectAllowed = 'move';
        },
        '@dragover.prevent'(e) {
          e.dataTransfer.dropEffect = 'move';

          const row = this.$el;
          const dragging = row.parentElement.querySelector('.is-dragging');

          if (!dragging || dragging === row) {
            return;
          }

          const after = e.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
          const before = after ? row.nextElementSibling : row;

          // "dragover" fires continuously while the pointer sits still, not just on real
          // movement — skip the (would-be no-op) reorder and its animation when nothing would
          // actually change, same reasoning as sortable()'s own guard (youla-editrix.js).
          if (dragging.nextElementSibling === before) {
            return;
          }

          animateReorder(row.parentElement, () => {
            row.parentElement.insertBefore(dragging, before);
          });
        },
        '@drop.prevent'() {},
        '@dragend'() {
          const list = this.$el.parentElement;
          this.$el.classList.remove('is-dragging');

          const items = readItems(this, name);
          writeItems(this, name, [...list.children].map((row) => items[+row.dataset.index]));
          renumberRepeaterItems(list);
        },
      };
    },

    // v-bind="e.repeaterToggle(name)" on a row's own head — expands/collapses its body. Purely a
    // DOM class, not part of the reactive value, same as this control's own "is-dragging".
    repeaterToggle() {
      return {
        '@click.stop.prevent'() {
          this.$el.closest('[data-repeater-item]').classList.toggle('is-open');
        },
      };
    },

    // v-bind="e.repeaterToggleAll(name)" on the control's own expand/collapse-all button
    // (`[data-part="toggle-all"]`, renderRepeaterControl()) — every row open, or every row closed,
    // whichever the *current* mix isn't: any collapsed row means "expand all" (open every row);
    // all-open means "collapse all". Same "plain DOM class, nothing reactive to key a binding off"
    // situation as repeaterToggle() above, so the icon/title are set directly here too, rather than
    // through a ":class"/":title" binding with no state to actually read.
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

    // v-bind="e.repeaterLabel(name, 'question')" on a row's head label — echoes its first declared
    // field's own current value back as that row's summary (Elementor's own repeater does the
    // same), falling back to "Item N" once that field is empty or the repeater has no fields at all.
    repeaterLabel(name, key) {
      return {
        'v-text'() {
          const index = itemIndexOf(this.$el);
          const value = key ? readItems(this, name)[index]?.[key] : undefined;

          return (typeof value === 'string' && value.trim()) || `Item ${index + 1}`;
        },
      };
    },

    // v-bind="e.repeaterRemove(name)" on a row's trash icon — hidden once "min" (default: 0, i.e.
    // no floor — every item can be removed) is reached, so the list can never be emptied below
    // whatever floor it declares. Otherwise identical to fill.js's own fillRemove(). Note that a
    // "min: 1, max: 1" repeater (isLockedToOneItem()) hides this same icon's whole row — see
    // createRepeaterItem()'s own comment — so this guard never actually has a chance to fire there.
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

    // v-bind="e.repeaterField(name, 'question')" on one item field's own input — dispatches on
    // that field's own declared type (REPEATER_FIELD_TEMPLATES) for which binding shape to build,
    // mirroring controls/data.js's own text()/switcher()/color() one-for-one (disabled included —
    // a plain ":disabled" attribute for text/switcher, the "disabled" option v-filler itself reads
    // for color, exactly as data.js's own color() passes it), just reading/writing this item's own
    // slot (readItems()[index][key]) instead of a top-level setting.
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
