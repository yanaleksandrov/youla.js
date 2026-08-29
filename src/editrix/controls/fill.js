/**
 * The "fill" control — a Figma-style multi-fill list (solid color and image for now; see
 * FILL_TYPES below for what a type needs to plug in, so a "gradient" type can be added later by
 * adding one more registry entry there, plus its own popover panel in
 * view/editrix/controls/fill.html, without touching anything solid/image-specific here).
 *
 * Value shape: Fill[], each `{ type, visible, opacity, color?, image?: { url } }` — see
 * FILL_TYPES' own createDefault() for exactly what each type stores.
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

// One entry per fill type this control knows how to edit — the whole "solid vs. image" (later
// "vs. gradient") switch, in one place: what a fresh fill of this type looks like, its list-row
// preview, and its list-row summary text. Everything else (the popover's own type tabs, the "add
// fill" menu) is built from this map, so adding a type here is the only JS-side step adding one
// later needs — its own popover panel still needs markup (one more "data-part" panel in
// view/editrix/controls/fill.html, shown via fillPanel() same as "solid"/"image" below).
const FILL_TYPES = {
  solid: {
    label: 'Solid color',
    icon: 'ph-drop',
    createDefault: () => ({ type: 'solid', visible: true, opacity: 100, color: '#1069fb' }),
    summary: (fill) => (fill.color || '#000000').toUpperCase(),
    previewStyle: (fill) => ({ backgroundColor: fill.color || '#000000', backgroundImage: 'none' }),
  },
  image: {
    label: 'Image',
    icon: 'ph-image',
    createDefault: () => ({ type: 'image', visible: true, opacity: 100, image: { url: '' } }),
    summary: (fill) => (fill.image?.url ? fill.image.url.split('/').pop() : 'No image selected'),
    previewStyle: (fill) => ({
      backgroundColor: 'transparent',
      backgroundImage: fill.image?.url ? `url("${fill.image.url}")` : 'none',
    }),
  },
};

const FILL_TYPE_LIST = Object.entries(FILL_TYPES).map(([value, def]) => ({ value, label: def.label, icon: def.icon }));

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

// Builds a row's popover type-switch tabs (and, via renderFillControl() below, the "add fill"
// menu items) from FILL_TYPE_LIST, so both stay in sync with FILL_TYPES without their own
// hand-written markup.
function buildTypeTabs(row, name) {
  const container = row.querySelector('[data-part="types"]');
  const nameArg = JSON.stringify(name);

  FILL_TYPE_LIST.forEach(({ value, label, icon }) => {
    const tab = document.createElement('span');
    tab.className = 'editrix-buttons-item';
    tab.title = label;
    tab.innerHTML = `<i class="ph ${icon}"></i>`;
    tab.setAttribute('v-bind', `e.fillType(${nameArg}, ${JSON.stringify(value)})`);
    container.append(tab);
  });
}

/**
 * Builds one fill row — a clone of "editrix-fill-item-template" with every part's own v-bind
 * wired via setAttribute (same convention as controls/render.js's own renderers), ready to be
 * appended and, if the caller isn't already inside the framework's own DOM walk (see fillList()'s
 * comment below), initialized.
 *
 * @param {string} name - The fill control's own setting name.
 * @param {number} index - This row's position in the fill array.
 * @returns {HTMLElement}
 */
function createFillItem(name, index) {
  const el = cloneTemplate('editrix-fill-item-template');
  const nameArg = JSON.stringify(name);

  el.dataset.index = index;
  el.setAttribute('v-bind', `e.fillItemRoot(${nameArg})`);

  el.querySelector('[data-part="preview"]').setAttribute('v-bind', `e.fillPreview(${nameArg})`);
  el.querySelector('[data-part="summary"]').setAttribute('v-bind', `e.fillSummary(${nameArg})`);
  el.querySelector('[data-part="visibility"]').setAttribute('v-bind', `e.fillVisibility(${nameArg})`);
  el.querySelector('[data-part="remove"]').setAttribute('v-bind', `e.fillRemove(${nameArg})`);

  el.querySelector('[data-part="solid"]').setAttribute('v-bind', `e.fillPanel(${nameArg}, 'solid')`);
  el.querySelector('[data-part="color"]').setAttribute('v-bind', `e.fillColor(${nameArg})`);
  el.querySelector('[data-part="hex"]').setAttribute('v-bind', `e.fillColorHex(${nameArg})`);
  el.querySelector('[data-part="opacity-range"]').setAttribute('v-bind', `e.fillOpacityRange(${nameArg})`);
  el.querySelector('[data-part="opacity-number"]').setAttribute('v-bind', `e.fillOpacityNumber(${nameArg})`);

  el.querySelector('[data-part="image"]').setAttribute('v-bind', `e.fillPanel(${nameArg}, 'image')`);
  el.querySelector('[data-part="image-preview"]').setAttribute('v-bind', `e.fillImagePreview(${nameArg})`);
  el.querySelector('[data-part="image-url"]').setAttribute('v-bind', `e.fillImageUrl(${nameArg})`);
  el.querySelector('[data-part="image-opacity-range"]').setAttribute('v-bind', `e.fillOpacityRange(${nameArg})`);
  el.querySelector('[data-part="image-opacity-number"]').setAttribute('v-bind', `e.fillOpacityNumber(${nameArg})`);

  buildTypeTabs(el, name);

  return el;
}

/**
 * Builds the fill control's own outer shell (the list's mount point, plus the "add fill" menu —
 * built once, right here, since unlike the rows themselves it never depends on the field's
 * value). Registered as controls/render.js's CONTROL_RENDERERS.fill, exactly like every other
 * control type's own renderer.
 *
 * @param {string} name
 * @returns {HTMLElement}
 */
export function renderFillControl(name) {
  const el = cloneTemplate('editrix-control-fill');
  const nameArg = JSON.stringify(name);

  el.querySelector('[data-part="list"]').setAttribute('v-bind', `e.fillList(${nameArg})`);
  el.querySelector('[data-part="add-toggle"]').setAttribute('v-bind', 'e.detailsAutoClose');

  const menu = el.querySelector('[data-part="add-menu"]');
  FILL_TYPE_LIST.forEach(({ value, label, icon }) => {
    const item = document.createElement('div');
    item.className = 'editrix-list-item';
    item.innerHTML = `<i class="ph ${icon}"></i> ${label}`;
    item.setAttribute('v-bind', `e.fillAdd(${nameArg}, ${JSON.stringify(value)})`);
    menu.append(item);
  });

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
            this.$el.innerHTML = '';
            readFills(this, name).forEach((fill, index) => this.$el.append(createFillItem(name, index)));
          }
          return owner;
        },
      };
    },

    // v-bind="e.fillAdd(name, 'solid')" on an "add fill" menu item — appends a fresh fill of that
    // type and its row together, then closes the menu.
    fillAdd(name, type) {
      return {
        '@click'() {
          const fills = readFills(this, name);
          const index = fills.length;

          writeFills(this, name, [...fills, FILL_TYPES[type].createDefault()]);

          const list = this.$el.closest('.editrix-fill').querySelector('[data-part="list"]');
          const row = createFillItem(name, index);
          list.append(row);
          this.$root.__x.initialize(row);

          this.$el.closest('details').open = false;
        },
      };
    },

    // v-bind="e.fillItemRoot(name)" on a row's own <details> root — draggable reordering (mirrors
    // youla-editrix.js's own e.sortable(), adapted for a control-system value instead of a
    // top-level reactive property) plus the generic outside-click auto-close every other
    // <details> popover in this project already uses.
    fillItemRoot(name) {
      return {
        ...this.detailsAutoClose,
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

    // v-bind="e.fillPreview(name)" on a row's swatch — FILL_TYPES' own previewStyle() drives it.
    fillPreview(name) {
      return {
        ':style'() {
          const fill = readFills(this, name)[fillIndexOf(this.$el)] || {};
          const style = (FILL_TYPES[fill.type] || FILL_TYPES.solid).previewStyle(fill);

          return { ...style, opacity: (fill.opacity ?? 100) / 100 };
        },
      };
    },

    // v-bind="e.fillSummary(name)" on a row's label.
    fillSummary(name) {
      return {
        'v-text'() {
          const fill = readFills(this, name)[fillIndexOf(this.$el)] || {};
          return (FILL_TYPES[fill.type] || FILL_TYPES.solid).summary(fill);
        },
      };
    },

    // v-bind="e.fillVisibility(name)" on a row's eye icon — hides a fill without removing it,
    // matching Figma's own per-fill visibility toggle. ".stop.prevent" keeps the click from also
    // toggling the row's <details> open/closed, since the icon sits inside its <summary>.
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
          row.remove();
          renumberFillItems(list);
        },
      };
    },

    // v-bind="e.fillType(name, 'solid')" on a popover's type-switch tab — switching type replaces
    // the fill with that type's own default value, carrying "visible"/"opacity" over so toggling
    // types doesn't also reset those.
    fillType(name, type) {
      return {
        ':class'() {
          const fill = readFills(this, name)[fillIndexOf(this.$el)] || {};
          return { active: fill.type === type };
        },
        '@click'() {
          const index = fillIndexOf(this.$el);
          const current = readFills(this, name)[index] || {};

          if (current.type === type) {
            return;
          }

          patchFillAt(this, name, index, {
            ...FILL_TYPES[type].createDefault(),
            visible: current.visible ?? true,
            opacity: current.opacity ?? 100,
          });
        },
      };
    },

    // v-bind="e.fillPanel(name, 'solid')" / "...'image')" on a popover's per-type panel.
    fillPanel(name, type) {
      return {
        'v-show'() {
          return (readFills(this, name)[fillIndexOf(this.$el)] || {}).type === type;
        },
      };
    },

    // v-bind="e.fillColor(name)" on a popover's <input type="color">.
    fillColor(name) {
      return {
        ':value'() {
          return readFills(this, name)[fillIndexOf(this.$el)]?.color ?? '#000000';
        },
        '@input'(e) {
          patchFillAt(this, name, fillIndexOf(this.$el), { color: e.target.value });
        },
      };
    },

    // v-bind="e.fillColorHex(name)" on the hex text field beside it — kept in sync both ways,
    // reverting on anything that isn't a bare 6-digit hex rather than writing a broken color.
    fillColorHex(name) {
      return {
        ':value'() {
          return (readFills(this, name)[fillIndexOf(this.$el)]?.color ?? '#000000').replace('#', '').toUpperCase();
        },
        '@change'(e) {
          const index = fillIndexOf(this.$el);
          const current = readFills(this, name)[index]?.color ?? '#000000';
          const value = e.target.value.trim().replace(/^#/, '');

          if (/^[0-9a-f]{6}$/i.test(value)) {
            patchFillAt(this, name, index, { color: `#${value.toLowerCase()}` });
          } else {
            e.target.value = current.replace('#', '').toUpperCase();
          }
        },
      };
    },

    // v-bind="e.fillOpacityRange(name)" / "e.fillOpacityNumber(name)" — shared by both the solid
    // and image panels, since "opacity" means the same thing regardless of fill type. The range
    // input reuses the same v-ranger directive (youla-ranger.js) the slider control's own
    // sliderRange() (controls/unit.js) is built on.
    fillOpacityRange(name) {
      return {
        ':value'() {
          return readFills(this, name)[fillIndexOf(this.$el)]?.opacity ?? 100;
        },
        '@input'(e) {
          patchFillAt(this, name, fillIndexOf(this.$el), { opacity: parseFloat(e.target.value) || 0 });
        },
        'v-ranger': '{ labelIsVisible: false, scaleTicksCount: 0 }',
      };
    },
    fillOpacityNumber(name) {
      return {
        ':value'() {
          return readFills(this, name)[fillIndexOf(this.$el)]?.opacity ?? 100;
        },
        '@input'(e) {
          const value = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0));
          patchFillAt(this, name, fillIndexOf(this.$el), { opacity: value });
        },
      };
    },

    // v-bind="e.fillImageUrl(name)" / "e.fillImagePreview(name)" — a plain URL field stands in
    // for the media library, matching this project's existing media() control (controls/data.js).
    fillImageUrl(name) {
      return {
        ':value'() {
          return readFills(this, name)[fillIndexOf(this.$el)]?.image?.url ?? '';
        },
        '@input'(e) {
          const index = fillIndexOf(this.$el);
          patchFillAt(this, name, index, { image: { ...readFills(this, name)[index]?.image, url: e.target.value } });
        },
      };
    },
    fillImagePreview(name) {
      return {
        ':style'() {
          const url = readFills(this, name)[fillIndexOf(this.$el)]?.image?.url;
          return { backgroundImage: url ? `url("${url}")` : 'none' };
        },
      };
    },
  };
}
