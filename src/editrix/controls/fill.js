/**
 * The "fill" control — a Figma-style multi-fill list (solid color, image and video for now; see
 * FILL_TYPES below for what a type needs to plug in, so a "gradient" type can be added later by
 * adding one more registry entry there). Each row is flat — drag handle, a single v-filler field,
 * visibility toggle, remove — with no popover of its own: v-filler (youla-filler.js) already
 * covers solid color (HSV + alpha), image/video upload, and switching between all three, in its
 * own dialog — so the "+" button (renderFillControl() below) always adds a solid fill outright,
 * Figma-style; switching an individual row to "Image"/"Video" happens inside its own v-filler
 * dialog, not through a type-picker menu here. FILL_TYPES still says what a fresh fill of a given
 * type looks like, for whenever fillAdd() is called with something other than 'solid'.
 *
 * Value shape: Fill[], each `{ type, visible, color, alpha, image, video }` — "image"/"video" are
 * null until that source has something uploaded, then `{ dataUrl, fit, rotation, ...filters }` for
 * image (see youla-filler.js's own Filler.MEDIA_FILTERS for the filter keys) or
 * `{ dataUrl, fit, rotation, ...settings }` for video (Filler.VIDEO_SETTINGS for the setting keys).
 *
 * Unlike every other control in this system, a fill list's own DOM shape (how many rows exist)
 * depends on its *value*, not just its definition — so, unlike text()/color()/media()/... (whose
 * markup is fixed and only ever needs its bindings re-evaluated), a fill list is built and kept in
 * sync by hand: rows are created once (fillList()'s ":data-owner" binding below, the same
 * imperative-build technique youla-editrix.js's contentFields()/container() already use) and only
 * touched again when a fill is actually added/removed/reordered, or the active block changes
 * underneath it. v-each (directives/v-each.js) was ruled out for the rows themselves: it tears
 * down and rebuilds every clone on each re-render, which would slam shut whatever fill's popover a
 * user has open — and drop keystrokes/drag state — on every edit made inside it.
 */

// One entry per fill type this control knows how to edit — what a fresh fill of that type looks
// like. The "+" button (fillAdd() below) only ever calls this with 'solid'; 'image' stays
// registered so fillAdd() itself doesn't need to change if something other than the button ever
// needs to add one directly (switching an *existing* row to "Image" instead goes through its own
// v-filler dialog — onSourceChange below just patches `type`, it never touches this map).
const FILL_TYPES = {
  solid: {
    createDefault: () => ({ type: 'solid', visible: true, color: '#1069FB', alpha: 100, image: null, video: null }),
  },
  image: {
    createDefault: () => ({ type: 'image', visible: true, color: '#1069FB', alpha: 100, image: null, video: null }),
  },
};

/**
 * Clones a single-root <template>'s content by id — every template this control uses
 * (view/editrix/controls/fill.html) has exactly one root element, so callers get that element
 * back directly instead of the raw DocumentFragment.
 *
 * @param {string} id
 * @returns {HTMLElement}
 */
function cloneTemplate(id) {
  const template = document.getElementById(id);

  if (!template) {
    throw new Error(`Youla.js: no <template id="${id}"> found — is view/editrix/controls/fill.html missing?`);
  }
  return template.content.firstElementChild.cloneNode(true);
}

// A fill row's own index is read off its "data-index" rather than baked into its bindings (unlike
// controls/render.js's own renderers, which bake "name" straight into each part's v-bind string)
// — so add/remove/reorder only ever need to touch "data-index", never re-wire a row's attributes.
function fillIndexOf(el) {
  return +el.closest('[data-fill-item]').dataset.index;
}

function readFills(component, name) {
  return component.getValue(name) || [];
}

function writeFills(component, name, fills) {
  component.setValue(name, fills);
}

// Merges "patch" into one fill by index — patchValue()'s (controls/base.js) index-less equivalent,
// for a control whose value is an *array* of compound objects rather than a single one.
function patchFillAt(component, name, index, patch) {
  const fills = readFills(component, name);
  writeFills(component, name, fills.map((fill, i) => (i === index ? { ...fill, ...patch } : fill)));
}

// Renumbers every row still in "list" to match its current DOM order — the one bit of bookkeeping
// add/remove/reorder all need once they're done changing which rows exist or where they sit.
function renumberFillItems(list) {
  [...list.children].forEach((row, index) => {
    row.dataset.index = index;
  });
}

// v-filler (youla-filler.js) hangs document/window-level listeners and a body-appended floating
// panel off any open dialog/dropdown, and nothing watches for its <input> leaving the DOM — so
// every caller pulling a fill row out (rebuilding the list, or removing one row) MUST destroy its
// filler instance(s) first, or the leftover listeners and panel leak for the rest of the session.
function destroyFillItemFillers(scope) {
  scope.querySelectorAll('[data-part="filler"]').forEach((filler) => filler._x_filler?.destroy());
}

/**
 * Builds one fill row — a clone of "editrix-fill-item-template" with every part's own v-bind
 * wired via setAttribute (same convention as controls/render.js's own renderers), ready to be
 * appended and, if the caller isn't already inside the framework's own DOM walk (see fillList()'s
 * comment below), initialized.
 *
 * @param {string} name - The fill control's own setting name.
 * @param {number} index - This row's position in the fill array.
 * @param {object} fill - This row's own current value, for its one-time initial seeding.
 * @returns {HTMLElement}
 */
function createFillItem(name, index, fill) {
  const el = cloneTemplate('editrix-fill-item-template');
  const nameArg = JSON.stringify(name);

  el.dataset.index = index;
  el.setAttribute('v-bind', `e.fillItemRoot(${nameArg})`);

  el.querySelector('[data-part="visibility"]').setAttribute('v-bind', `e.fillVisibility(${nameArg})`);
  el.querySelector('[data-part="remove"]').setAttribute('v-bind', `e.fillRemove(${nameArg})`);

  const filler = el.querySelector('[data-part="filler"]');
  // v-filler reads an <input>'s own "value" only once, at construction (see Filler's constructor,
  // youla-filler.js) — set as a real attribute here, the same one-time-setup convention "data-index"
  // above uses, rather than a reactive ":value" binding that would fight v-filler's own rendering.
  filler.value = fill.color || '#1069FB';
  filler.setAttribute('v-bind', `e.fillFiller(${nameArg})`);

  return el;
}

/**
 * Builds the fill control's own outer shell (the list's mount point, plus the "+" button that
 * adds a solid fill outright — built once, right here, since unlike the rows themselves it never
 * depends on the field's value). Registered as controls/render.js's CONTROL_RENDERERS.fill,
 * exactly like every other control type's own renderer. The "+" button itself (`[data-part="add"]`)
 * gets relocated into its section's `.editrix-section-head` by contentFields() (youla-editrix.js),
 * matching every other section's own head-row buttons — see that file's own comment.
 *
 * @param {string} name
 * @returns {HTMLElement}
 */
export function renderFillControl(name) {
  const el = cloneTemplate('editrix-control-fill');
  const nameArg = JSON.stringify(name);

  el.querySelector('[data-part="list"]').setAttribute('v-bind', `e.fillList(${nameArg})`);
  el.querySelector('[data-part="add"]').setAttribute('v-bind', `e.fillAdd(${nameArg}, 'solid')`);

  return el;
}

export function createFillControl() {
  return {
    // v-bind="e.fillList(name)" on ".editrix-fill-list" — builds this field's rows the first time
    // it's resolved, and again whenever the *active block* changes, since a different block's own
    // fill array can be a different length than whatever rows are currently on screen (the Content
    // tab's fields — see contentFields(), youla-editrix.js — are built once for the whole session,
    // not re-mounted per block). ":data-owner" doubles as that guard and as a real, harmless
    // attribute recording which block the rows on screen belong to. Ordinary edits — add/remove/
    // reorder, or any field inside a row's own popover — never touch this path: they patch
    // "settings" directly and let the framework's normal, non-destructive re-render handle the rest.
    fillList(name) {
      return {
        ':data-owner'() {
          const owner = this.activeBlock || '__page__';

          if (this.$el.dataset.owner !== owner) {
            this.$el.dataset.owner = owner;
            destroyFillItemFillers(this.$el);
            this.$el.innerHTML = '';
            readFills(this, name).forEach((fill, index) => {
              const row = createFillItem(name, index, fill);
              this.$el.append(row);
              // Wires this row's @click/@dragstart/... listeners and its v-filler input, the same
              // way fillAdd() below already does for a single appended row — skipping it here left
              // every row built by *this* path with none of its directives ever applied: visibility/
              // remove never got a click listener and drag-reorder never got wired, so hide/show,
              // delete and sorting silently did nothing from the very first render (and after every
              // active-block switch), even though v-filler kept working — its binding still gets
              // picked up by the framework's normal reactive refresh() pass, unlike event listeners.
              this.$root.__x.initialize(row);
            });
          }
          return owner;
        },
      };
    },

    // v-bind="e.fillAdd(name, 'solid')" on the control's own "+" button — appends a fresh fill of
    // that type and its row together, immediately, Figma-style (no type-picker in between).
    fillAdd(name, type) {
      return {
        '@click'() {
          const fills = readFills(this, name);
          const index = fills.length;
          const fill = FILL_TYPES[type].createDefault();

          writeFills(this, name, [...fills, fill]);

          // ".editrix-section", not ".editrix-fill": contentFields() (youla-editrix.js) relocates
          // this button out of ".editrix-fill" into the section's own head row, so ".editrix-fill"
          // (and its "[data-part='list']") is no longer an ancestor — the section is the nearest
          // element still common to both.
          const list = this.$el.closest('.editrix-section').querySelector('[data-part="list"]');
          const row = createFillItem(name, index, fill);
          list.append(row);
          this.$root.__x.initialize(row);
        },
      };
    },

    // v-bind="e.fillItemRoot(name)" on a row's own root — draggable reordering, mirroring
    // youla-editrix.js's own e.sortable() (adapted for a control-system value instead of a
    // top-level reactive property). No popover of its own to auto-close here — v-filler's dialog
    // (fillFiller() below) handles that itself.
    fillItemRoot(name) {
      return {
        ':draggable': 'true',
        '@dragstart'() {
          this.$el.classList.add('is-dragging');
        },
        '@dragover.prevent'(e) {
          const row = this.$el;
          const dragging = row.parentElement.querySelector('.is-dragging');

          if (!dragging || dragging === row) {
            return;
          }

          const after = e.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
          const before = after ? row.nextElementSibling : row;

          if (dragging.nextElementSibling !== before) {
            row.parentElement.insertBefore(dragging, before);
          }
        },
        '@drop.prevent'() {},
        '@dragend'() {
          const list = this.$el.parentElement;
          this.$el.classList.remove('is-dragging');

          const fills = readFills(this, name);
          writeFills(this, name, [...list.children].map((row) => fills[+row.dataset.index]));
          renumberFillItems(list);
        },
      };
    },

    // v-bind="e.fillVisibility(name)" on a row's eye icon — hides a fill without removing it,
    // matching Figma's own per-fill visibility toggle.
    fillVisibility(name) {
      return {
        ':class'() {
          const visible = readFills(this, name)[fillIndexOf(this.$el)]?.visible ?? true;
          return { 'ph-eye': visible, 'ph-eye-slash': !visible };
        },
        '@click.stop.prevent'() {
          const index = fillIndexOf(this.$el);
          const visible = readFills(this, name)[index]?.visible ?? true;
          patchFillAt(this, name, index, { visible: !visible });
        },
      };
    },

    // v-bind="e.fillRemove(name)" on a row's trash icon.
    fillRemove(name) {
      return {
        '@click.stop.prevent'() {
          const row = this.$el.closest('[data-fill-item]');
          const index = fillIndexOf(row);
          const list = row.parentElement;

          writeFills(this, name, readFills(this, name).filter((_, i) => i !== index));
          destroyFillItemFillers(row);
          row.remove();
          renumberFillItems(list);
        },
      };
    },

    // v-bind="e.fillFiller(name)" on a row's own <input> — the entire color/image/video editing
    // surface (swatch, hex field, alpha, image/video upload + correction dialog, and switching
    // between all three) is v-filler's own; this just keeps the row's own Fill in sync with
    // whatever the user does inside it. "source"/"image"/"video" seed the widget from the fill's
    // current value (see the seeding comment on Filler's own constructor, youla-filler.js) — read
    // once, on this row's first mount, same as createFillItem()'s one-time ":value" attribute;
    // later re-evaluations just echo the same values back onto an already-mounted instance, which
    // is a no-op (see update(), same file).
    fillFiller(name) {
      return {
        'v-filler'() {
          const index = fillIndexOf(this.$el);
          const fill = readFills(this, name)[index] || {};

          return {
            sources: ['solid', 'image', 'video'],
            alpha: fill.alpha ?? 100,
            source: fill.type,
            image: fill.image || undefined,
            video: fill.video || undefined,
            onChange: (hex, alpha) => patchFillAt(this, name, index, { color: hex, alpha }),
            onSourceChange: (type) => patchFillAt(this, name, index, { type }),
            onMediaChange: (type, media) => {
              // Both image and video persist here — leaving video out (as before, when it wasn't
              // a selectable source yet) would seed every future mount from a permanently-null
              // fill.video, discarding whatever the user just uploaded on every re-render.
              patchFillAt(this, name, index, { [type]: { ...media } });
            },
          };
        },
      };
    },
  };
}
