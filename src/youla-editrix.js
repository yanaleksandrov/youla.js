import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history, undo, redo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';

import { tooltip } from './editrix/prosemirror/tooltip';
import { baseSchema } from './editrix/prosemirror/schemes/base';
import { titleSchema } from './editrix/prosemirror/schemes/title';

import { createControlsSystem } from './editrix/controls';
import { renderField } from './editrix/controls/render';

// Maps a palette block's identifier (v-bind="e.paletteItem('editrix-text')", sections/sidebar.html)
// to what dropping it onto the canvas creates: the markup it starts with, and which rich-text
// scheme (if any) to mount on it — see container()/mountEditor() below. New block types plug in
// here without touching the drag-and-drop mechanics themselves.
const BLOCK_TEMPLATES = {
  'editrix-text': { html: '<h1>I am text</h1>', scheme: 'base' },
  'editrix-button': { html: '<button type="button">Submit Now!</button>', scheme: null },
};

// Sidebar > Content tab (sections/sidebar.html's field template library) — every control instance
// shown there, grouped under a heading. Each field entry is exactly renderField()'s own argument
// shape (plugins/editrix/controls/render.js), which is exactly e.field()'s own signature — so
// adding a control here never means touching the rendering code itself.
const CONTENT_FIELDS = [
  {
    heading: 'Data controls',
    fields: [
      {
        name: 'title', title: 'Title', tooltip: 'Shown at the top of the block',
        options: {
          type: 'text',
          default: 'Untitled',
          placeholder: 'Enter a title…',
          description: 'Plain text, no formatting',
        },
      },
      {
        name: 'show_title', title: 'Show title', tooltip: 'Hide it without deleting the text',
        options: { type: 'switcher', default: true },
      },
      {
        name: 'align', title: 'Alignment', tooltip: 'Text alignment inside the block',
        options: {
          type: 'select',
          default: 'left',
          options: { left: 'Left', center: 'Center', right: 'Right', justify: 'Justify' },
        },
      },
      {
        name: 'accent_color', title: 'Accent color', tooltip: 'Used for links and highlights',
        options: { type: 'color', default: '#1069fb' },
      },
    ],
  },
  {
    heading: 'Multi-value controls',
    fields: [
      {
        name: 'link', title: 'Link', tooltip: 'Where the button goes',
        options: {
          type: 'url',
          default: { url: '', is_external: false, nofollow: false },
          description: 'Leave empty for no link',
        },
      },
      {
        name: 'cover_image', title: 'Cover image', tooltip: 'A plain URL field stands in for the media library for now',
        options: {
          type: 'media',
          default: { url: '', alt: '' },
          description: 'Paste an image URL',
        },
      },
    ],
  },
  {
    heading: 'Unit controls',
    fields: [
      {
        name: 'width', title: 'Width', tooltip: 'How wide the block is',
        options: { type: 'slider', default: { size: 0, unit: 'px' }, min: 0, max: 100, step: 1 },
      },
      {
        name: 'padding', title: 'Padding', tooltip: 'Space inside the block, on each side',
        options: { type: 'dimensions', default: { top: 0, right: 0, bottom: 0, left: 0, unit: 'px', isLinked: true } },
      },
    ],
  },
];

// Classes toggled on a canvas container while something is being dragged over/from it.
const DRAG_CLASSES = {
  start: 'editrix-dragging-start',
  over: 'editrix-dragging-over',
  top: 'editrix-dragging-top',
  bottom: 'editrix-dragging-bottom',
};

const CONTAINER_TOOLS_HTML = `
  <ul class="editrix-container-tools">
    <li class="editrix-container-tools-item" data-action="edit" title="Edit Container">
      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256">
        <path d="M76 92a16 16 0 1 1-16-16 16 16 0 0 1 16 16Zm52-16a16 16 0 1 0 16 16 16 16 0 0 0-16-16Zm68 32a16 16 0 1 0-16-16 16 16 0 0 0 16 16ZM60 148a16 16 0 1 0 16 16 16 16 0 0 0-16-16Zm68 0a16 16 0 1 0 16 16 16 16 0 0 0-16-16Zm68 0a16 16 0 1 0 16 16 16 16 0 0 0-16-16Z"/>
      </svg>
    </li>
    <li class="editrix-container-tools-item" data-action="delete" title="Delete Container">
      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 256 256">
        <path d="M208 192a12 12 0 0 1-17 17l-63-64-64 63a12 12 0 0 1-17-17l64-63-63-64a12 12 0 0 1 17-17l63 64 64-64a12 12 0 0 1 17 17l-64 64Z"/>
      </svg>
    </li>
  </ul>
`;

// The lone child every block gets, right above its own content — see blockTitle()/readBlockSettings()
// below. Its "title"/"show_title" values come from CONTENT_FIELDS like any other setting; this is
// just the one spot on the canvas (as opposed to the sidebar's Content tab) that renders them.
const BLOCK_TITLE_HTML = '<div class="editrix-block-title"></div>';

// Every CONTENT_FIELDS default, flattened to a plain "{ name: default }" map — the baseline a
// block's own settings are read against on the canvas (readBlockSettings() below) before it's ever
// been selected/edited, so a freshly dropped block already shows "Untitled", left-aligned, etc.
// instead of blank/zeroed fields. Controls/base.js's own getValue() has its own (per-control, not
// per-block) fallback to `def.default` for exactly the same reason, on the sidebar side.
const DEFAULT_BLOCK_SETTINGS = Object.fromEntries(
  CONTENT_FIELDS.flatMap(({ fields }) => fields).map(({ name, options }) => [name, options.default]),
);

// The block currently being dragged, or the palette item about to spawn one — deliberately kept
// outside the reactive data: it's rebuilt on every drag and never rendered, so tracking it would
// only cost refreshes for no benefit. One drag runs at a time, so one shared session is enough.
let dragSession = null;

// Every block dropped/rendered gets a stable "data-blockId" the first time its container() @load
// fires — see container() below — so its own settings (settings[blockId], scoped independently of
// whichever block the sidebar's Content tab currently has active) can be found again later, by
// itself or by any other block.
let blockIdSeq = 0;
function nextBlockId() {
  return `block-${++blockIdSeq}`;
}

/**
 * Reads block "id"'s own settings, merged over DEFAULT_BLOCK_SETTINGS so a field that was never
 * touched still reads its declared default — used by the canvas-facing bindings (a block's own
 * ":style"/blockTitle) that must reflect *that* block's settings regardless of which block (if
 * any) the sidebar currently has active; getValue()/setValue() (controls/base.js) stay the right
 * choice for the sidebar's own fields, which always mean "the active block".
 *
 * @param {Object} component - The reactive `this` from whichever binding is reading.
 * @param {string} [id] - A block's `dataset.blockId`.
 * @returns {Object}
 */
function readBlockSettings(component, id) {
  return { ...DEFAULT_BLOCK_SETTINGS, ...(id ? component.settings[id] : null) };
}

/**
 * Runs "mutate" (a synchronous DOM reorder — e.g. insertBefore) and smoothly animates every
 * affected child from its old screen position to its new one, via the FLIP technique: record
 * every child's rect, mutate, then for whichever ones actually moved, jump them back to their old
 * spot with a transform (no transition) and release it on the next frame so the browser's own
 * "transition" (declared once, in CSS, on whatever item class this is) animates it home. A CSS
 * Grid/Flexbox reflow isn't transitionable on its own — an item just snaps to its new cell the
 * instant the DOM changes — this is what actually makes that snap read as a smooth slide.
 *
 * Generic on purpose: works for any reorderable list of siblings, not just one particular gallery
 * or grid — see sortable() below for its one current caller.
 *
 * @param {HTMLElement} container - The parent whose children are being reordered.
 * @param {Function} mutate - Performs the actual DOM reorder synchronously.
 */
function animateReorder(container, mutate) {
  const children = [...container.children];
  const firstRects = new Map(children.map((el) => [el, el.getBoundingClientRect()]));

  mutate();

  children.forEach((el) => {
    const first = firstRects.get(el);
    const last = el.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;

    if (!dx && !dy) {
      return;
    }

    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;

    requestAnimationFrame(() => {
      el.style.transition = '';
      el.style.transform = '';
    });
  });
}

/**
 * Returns a new "blocks" array with "element" repositioned immediately before/after "anchor" —
 * removing it from its old position first (a no-op if it wasn't already present) covers both
 * reordering an existing block and inserting a freshly dropped one in a single pass. Omitting
 * "anchor" (or passing one no longer in "blocks") appends "element" at the end — exactly what a
 * drop straight onto empty canvas, or below the last block, needs.
 *
 * @param {HTMLElement[]} blocks - The canvas' current block elements, in DOM order.
 * @param {HTMLElement} element - The block being placed.
 * @param {HTMLElement} [anchor] - The block it's being dropped on, if any.
 * @param {boolean} [after] - Whether "element" lands after (vs before) "anchor".
 * @returns {HTMLElement[]} The reordered array.
 */
function reorderBlocks(blocks, element, anchor, after) {
  const withoutElement = blocks.filter((block) => block !== element);
  const anchorIndex = withoutElement.indexOf(anchor);
  const insertIndex = anchorIndex === -1 ? withoutElement.length : anchorIndex + (after ? 1 : 0);

  return [...withoutElement.slice(0, insertIndex), element, ...withoutElement.slice(insertIndex)];
}

/**
 * Builds the DOM element a palette item's blockType drops in as — the one piece that actually
 * knows about BLOCK_TEMPLATES, kept separate from placeDroppedBlock() below so that function
 * never needs to care whether a drop is spawning a brand new block or just moving an existing one.
 *
 * @param {string} blockType - A BLOCK_TEMPLATES key (see paletteItem()).
 * @returns {HTMLElement|null} The new element, or null if "blockType" isn't registered.
 */
function createBlock(blockType) {
  const template = BLOCK_TEMPLATES[blockType];
  if (!template) {
    return null;
  }

  const element = document.createElement('div');
  element.className = 'editrix-container';
  element.innerHTML = template.html;
  element.setAttribute('v-bind', template.scheme !== null ? `e.container('${template.scheme}')` : 'e.container()');
  return element;
}

/**
 * Drops whatever's currently being dragged — a fresh palette item or an existing block being
 * reordered — into the canvas, immediately before/after "anchor" (or at the end, if no anchor is
 * given: a drop straight onto empty canvas, or past the last block). Shared by canvas() and
 * container()'s own drop handlers, so a palette item can land on an empty canvas exactly the same
 * way it lands on an existing block — neither handler is "the" drop target, both just call this
 * with whatever anchor (if any) they were dropped on.
 *
 * @param {Object} component - The reactive `this` from whichever v-bind handler is dropping.
 * @param {HTMLElement} canvasEl - The canvas element blocks live in (.editrix-preview).
 * @param {HTMLElement} [anchor] - The existing block being dropped on, if any.
 * @param {boolean} [after] - Whether the dropped element lands after "anchor".
 */
function placeDroppedBlock(component, canvasEl, anchor, after) {
  const session = dragSession;
  dragSession = null;

  if (!session || session.element === anchor) {
    return;
  }

  let element = session.element;
  if (session.blockType) {
    element = createBlock(session.blockType);
    if (!element) {
      return;
    }
  }

  element.classList.remove(DRAG_CLASSES.start);
  element.remove();

  if (anchor) {
    anchor.insertAdjacentElement(after ? 'afterend' : 'beforebegin', element);
  } else {
    canvasEl.appendChild(element);
  }

  component.blocks = reorderBlocks(component.blocks, element, anchor, after);

  // A brand new element — wire up its own v-bind/@load the same way v-each wires up a freshly
  // cloned item (see directives/v-each.js), since nothing else will.
  if (session.blockType) {
    component.$root.__x.initialize(element);
  }
}

/**
 * Removes "el" from the canvas — dropping its own settings bucket along with it, and clearing
 * "activeBlock" first if it was the block being deleted (otherwise the Content tab would keep
 * showing/writing settings for a block that no longer exists). The "Delete Container" tool
 * (CONTAINER_TOOLS_HTML) is this function's one caller.
 *
 * @param {Object} component - The reactive `this` from whichever v-bind handler is deleting.
 * @param {HTMLElement} el - The block being removed.
 */
function deleteBlock(component, el) {
  const id = el.dataset.blockId;

  if (component.activeBlock === id) {
    component.activeBlock = null;
  }
  delete component.settings[id];

  component.blocks = component.blocks.filter((block) => block !== el);
  el.remove();
}

/**
 * Mounts a ProseMirror rich-text editor onto "el" — "h1" gets the title scheme (Enter inserts a
 * line break instead of splitting the block), anything else gets the base scheme.
 *
 * @param {HTMLElement} el - The element to mount the editor onto.
 * @param {string} scheme - "h1", or anything else for the base scheme.
 */
function mountEditor(el, scheme) {
  let schema = baseSchema;
  const plugins = [];

  if (scheme === 'h1') {
    schema = titleSchema;
    plugins.push(keymap({
      Enter: (state, dispatch) => {
        const { $from } = state.selection;
        if (!$from.parent.type.spec.code) {
          dispatch(state.tr.replaceSelectionWith(state.schema.nodes.hard_break.create()).scrollIntoView());
          return true;
        }
        return false;
      },
    }));
  }

  new EditorView(el, {
    state: EditorState.create({
      schema,
      plugins: [
        history(),
        keymap(baseKeymap),
        keymap({ 'Mod-z': undo, 'Mod-y': redo }),
        tooltip(),
        ...plugins,
      ],
    }),
  }).dom.classList.add('editor-content');
}

/**
 * Drag-to-adjust a numeric <input>: nudges its value by "step" per pixel moved horizontally,
 * clamped to its own min/max (read fresh at drag-start, so it keeps working if they change later).
 *
 * @param {HTMLInputElement} input - The field to adjust.
 * @param {number} startX - The pointer's starting X position.
 * @param {string} moveEvent - "mousemove" or "touchmove".
 * @param {string} endEvent - "mouseup" or "touchend".
 */
function startNumberDrag(input, startX, moveEvent, endEvent) {
  if (!input) {
    return;
  }

  const step = parseFloat(input.step) || 1;
  const min = input.min ? parseFloat(input.min) : Number.NEGATIVE_INFINITY;
  const max = input.max ? parseFloat(input.max) : Number.POSITIVE_INFINITY;
  const startValue = parseFloat(input.value) || 0;

  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'e-resize';

  const onMove = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const value = Math.min(Math.max(startValue + (clientX - startX) * step, min), max);

    input.value = +value.toFixed(6);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const onEnd = () => {
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    window.removeEventListener(moveEvent, onMove);
    window.removeEventListener(endEvent, onEnd);
  };

  window.addEventListener(moveEvent, onMove);
  window.addEventListener(endEvent, onEnd);
}

document.addEventListener('youla:init', () => {

  // Canvas zoom bounds/step, ctrl+wheel-ed in the "editrix-preview" v-bind set below
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 150;
  const ZOOM_STEP = 10;
  const ZOOM_DEFAULT = 100;

  /**
   * Reads the "Page" panel's option lists (Status/Visibility/Discussion/Authors) out of the
   * `#editrix-data` JSON block rendered into the page's footer (view/editrix.html) — stand-in for
   * wherever a real backend would inject them server-side, so they're never hardcoded here.
   *
   * @param {string} id - The `<script type="application/json">` element's id.
   * @returns {Object} The parsed payload, or `{}` if the element is missing/unparsable.
   */
  function readBackendData(id) {
    const script = document.getElementById(id);

    if (!script) {
      console.warn(`Youla.js: no backend data found for editrix ("#${id}" is missing).`);
      return {};
    }

    try {
      return JSON.parse(script.textContent);
    } catch (error) {
      console.warn(`Youla.js: could not parse backend data for editrix ("#${id}").`, error);
      return {};
    }
  }

  const {
    statuses: STATUSES = [],
    visibilities: VISIBILITIES = [],
    discussions: DISCUSSIONS = [],
    authors: AUTHORS = [],
  } = readBackendData('editrix-data');

  /**
   * Editrix: the page builder's root component, mounted on `<div class="editrix" v-data="editrix
   * as e">` (view/editrix.html). Holds the sidebar's navigation state, the canvas' blocks/zoom, the
   * "Page" panel's fields, and every `v-bind` set those views reference — including the canvas'
   * drag-and-drop/reordering and the toolbox's drag-to-adjust number inputs, both written as
   * generic, parameterized bindings (not directives) so they're reusable for whatever's added next.
   *
   * @since 1.0
   */
  Youla.data('editrix', () => ({
    // Elementor-style control system (label/tooltip/description/condition/responsive chrome +
    // text/switcher/select/color/url/media/slider/dimensions controls) — see
    // plugins/editrix/controls and sections/sidebar.html's "Content" tab. Spread first so its own
    // keys (settings, getValue, text, select, ...) are established before anything below can
    // shadow them.
    ...createControlsSystem(),

    // Sidebar navigation (sections/sidebar.html)
    tab: 'blocks',
    // Toolbox panel shown for whichever block/container was last clicked on the canvas
    section: 'content',
    // "Advanced" panel collapse, at the bottom of the toolbox
    advanced: false,

    // Sidebar nav (sections/sidebar.html) — v-bind="e.sidebarTab('blocks')" on the tab button,
    // v-bind="e.sidebarPanel('blocks')" on the panel it shows. Parameterized by tab name so both
    // reduce to one definition each, reused across however many tabs the sidebar ends up with.
    sidebarTab(name) {
      return {
        ':class': `{'active': tab === '${name}'}`,
        '@click': `tab = '${name}'`,
      };
    },
    sidebarPanel(name) {
      return {
        'v-show': `tab === '${name}'`,
      };
    },

    // Canvas (editrix-preview) — every block container currently on it, in DOM order
    blocks: [],
    zoom: ZOOM_DEFAULT,

    // v-bind="e.canvas" on .editrix-preview: ctrl+wheel/ctrl+0 zoom, plus the drop target of last
    // resort — a container's own drop handler (below) always wins when the pointer is over it
    // (".stop" keeps the event from reaching here), so this only ever fires for a drop onto empty
    // canvas or past the last block, appending there via the same placeDroppedBlock() a container
    // uses. Without this, dropping a palette item only ever worked once a container already
    // existed to catch it — nothing caught a drop onto an empty canvas at all.
    canvas: {
      '@wheel.prevent.ctrl'(e) {
        this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)));
      },
      '@keydown.window.ctrl.0'() {
        this.zoom = ZOOM_DEFAULT;
      },
      ':style'() {
        return `zoom: ${this.zoom}%`;
      },
      '@dragover.prevent'() {},
      '@drop.prevent'() {
        placeDroppedBlock(this, this.$el);
      },
      // A block's own "@click.stop" (container(), below) keeps this from firing when the click
      // actually landed on a block — so this only ever means "the canvas' empty background was
      // clicked", i.e. deselect.
      '@click'() {
        this.activeBlock = null;
      },
    },

    // Toolbar > zoom dropdown (sections/toolbar.html) — v-bind="e.zoomSummary" on the <summary>,
    // v-bind="e.zoomOption(75)" on each preset so the click/active-state logic reduces to one
    // definition, parameterized by the zoom level it sets.
    zoomSummary: {
      'v-text'() {
        return `${this.zoom}%`;
      },
    },
    zoomOption(value) {
      return {
        '@click': `zoom = ${value}, $el.closest('details').open = false`,
        ':class': `zoom === ${value} && 'active'`,
      };
    },

    // Sidebar > block palette (sections/sidebar.html) — v-bind="e.paletteItem('editrix-text')" on
    // each palette entry. Dragging one onto the canvas — an existing container, or empty canvas
    // itself, both handled by placeDroppedBlock() (see container()/canvas() above) — spawns a new
    // block from BLOCK_TEMPLATES[blockType]; reusable for however many block types get added.
    paletteItem(blockType) {
      return {
        ':draggable': 'true',
        '@dragstart'(e) {
          dragSession = { element: null, blockType };
          e.dataTransfer.effectAllowed = 'copy';
          e.dataTransfer.setData('text/plain', blockType);
        },
      };
    },

    // Canvas > block container (editor.html, and every block spawned via paletteItem() above) —
    // v-bind="e.container()", or v-bind="e.container('h1')" to also mount a rich-text editor on
    // it. Its own drop handler is just "the pointer is over this particular block" — placing
    // whatever was dropped (placeDroppedBlock()) is shared with canvas()'s fallback handler, so a
    // palette item lands the same way whether it's dropped on a block or on empty canvas. Also
    // handles the hover tools popup and switching the toolbox to the right panel on click/right-click.
    container(scheme) {
      return {
        ':draggable': 'true',
        // Only "align"/"accent_color" apply here — "width"/"padding" (also CONTENT_FIELDS
        // settings, so still stored and editable) have no safe target yet: this element's own
        // "padding" is what centers it into an 800px column (see editor.scss's $max-width), so
        // writing either as a literal CSS value here would fight that rather than complement it.
        ':style'() {
          const settings = readBlockSettings(this, this.$el.dataset.blockId);

          return {
            textAlign: settings.align,
            '--editrix-accent': settings.accent_color,
          };
        },
        '@load'() {
          if (!this.blocks.includes(this.$el)) {
            this.blocks = [...this.blocks, this.$el];
          }
          if (!this.$el.dataset.blockId) {
            this.$el.dataset.blockId = nextBlockId();
          }
          if (!this.$el.querySelector(':scope > .editrix-block-title')) {
            this.$el.insertAdjacentHTML('afterbegin', BLOCK_TITLE_HTML);

            const title = this.$el.querySelector(':scope > .editrix-block-title');
            title.setAttribute('v-bind', 'e.blockTitle');
            this.$root.__x.initialize(title);
          }
          if (scheme !== undefined) {
            mountEditor(this.$el, scheme);
          }
        },
        '@dragstart'() {
          dragSession = { element: this.$el, blockType: null };
          this.$el.classList.add(DRAG_CLASSES.start);
        },
        '@dragleave'() {
          this.$el.classList.remove(DRAG_CLASSES.over, DRAG_CLASSES.top, DRAG_CLASSES.bottom);
        },
        '@dragover.prevent.stop'(e) {
          if (!dragSession) {
            return;
          }

          const { top, height } = this.$el.getBoundingClientRect();
          const after = e.clientY > top + height / 2;

          this.$el.classList.add(DRAG_CLASSES.over);
          this.$el.classList.toggle(DRAG_CLASSES.top, !after);
          this.$el.classList.toggle(DRAG_CLASSES.bottom, after);
        },
        '@drop.prevent.stop'(e) {
          this.$el.classList.remove(DRAG_CLASSES.over, DRAG_CLASSES.top, DRAG_CLASSES.bottom);

          const { top, height } = this.$el.getBoundingClientRect();
          const after = e.clientY > top + height / 2;

          placeDroppedBlock(this, this.$el.parentElement, this.$el, after);
        },
        '@dragend'() {
          this.$el.classList.remove(DRAG_CLASSES.start, DRAG_CLASSES.over, DRAG_CLASSES.top, DRAG_CLASSES.bottom);
          dragSession = null;
        },
        '@mouseenter'() {
          if (this.$el.querySelector(':scope > .editrix-container-tools')) {
            return;
          }
          this.$el.insertAdjacentHTML('afterbegin', CONTAINER_TOOLS_HTML);

          const tools = this.$el.querySelector(':scope > .editrix-container-tools');
          tools.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
            e.stopPropagation();
            this.activeBlock = this.$el.dataset.blockId;
            this.tab = 'content';
          });
          tools.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
            e.stopPropagation();
            deleteBlock(this, this.$el);
          });
        },
        '@mouseleave'() {
          this.$el.querySelector(':scope > .editrix-container-tools')?.remove();
        },
        // ".stop" keeps this from also reaching canvas()'s own "@click" above, which would
        // otherwise immediately undo the selection this just made (deselecting on any click is
        // exactly what that handler is for — see its own comment).
        '@click.stop'() {
          this.activeBlock = this.$el.dataset.blockId;
          this.tab = 'content';
        },
        '@contextmenu.prevent'() {
          this.tab = 'blocks';
        },
      };
    },

    // The ".editrix-block-title" every container() @load prepends to its own block (see
    // BLOCK_TITLE_HTML) — reads straight off that block's own "dataset.blockId" (found via
    // closest(), since this element itself carries no id) rather than "activeBlock"/getValue(), so
    // every block shows its own title regardless of which one (if any) is currently selected.
    blockTitle: {
      'v-show'() {
        return readBlockSettings(this, this.$el.closest('.editrix-container')?.dataset.blockId).show_title;
      },
      'v-text'() {
        return readBlockSettings(this, this.$el.closest('.editrix-container')?.dataset.blockId).title;
      },
    },

    // Sidebar > Content tab (sections/sidebar.html) — v-bind="e.contentFields" on the panel's
    // mount div. Runs once, on load: builds every CONTENT_FIELDS group as a ".editrix-section",
    // rendering each field from the <template> library that sits right next to this div (see
    // plugins/editrix/controls/render.js). Inserted synchronously so domWalk's own traversal (it
    // snapshots an element's children only *after* resolving that element's own attributes — see
    // dom.js) picks up and initializes this new markup as part of the very same pass, the same way
    // a v-each clone's children get walked without a separate initialize() call.
    contentFields: {
      '@load'() {
        CONTENT_FIELDS.forEach(({ heading, fields }) => {
          const section = document.createElement('div');
          section.className = 'editrix-section';
          section.innerHTML = `<div class="editrix-section-head">${heading}</div><div class="editrix-section-body"></div>`;
          section.querySelector('.editrix-section-body').append(...fields.map(renderField));

          this.$el.append(section);
        });
      },
    },

    // Generic reusable "drag to reorder" for any list — v-bind="e.sortable('thumbnails')" on each
    // item, paired with a `:data-index="index"` attribute (e.g. `v-each="(item, index) in
    // thumbnails"` — see toolbox.html's gallery) to keep the underlying array in sync; without
    // one, it's a purely visual reorder.
    sortable(field) {
      return {
        ':draggable': 'true',
        '@dragstart'() {
          this.$el.classList.add('is-dragging');
        },
        '@dragover'(e) {
          e.preventDefault();

          const dragging = this.$el.parentElement.querySelector('.is-dragging');
          if (!dragging || dragging === this.$el) {
            return;
          }

          const { top, height } = this.$el.getBoundingClientRect();
          const after = e.clientY > top + height / 2;
          const before = after ? this.$el.nextElementSibling : this.$el;

          // "dragover" fires continuously while the pointer sits still, not just on real
          // movement — skip the (would-be no-op) reorder and its animation when nothing would
          // actually change, so a stationary drag doesn't keep re-triggering both.
          if (dragging.nextElementSibling === before) {
            return;
          }

          animateReorder(this.$el.parentElement, () => {
            this.$el.parentElement.insertBefore(dragging, before);
          });
        },
        // Without this, the browser's own default drop action fires (nothing here calls
        // preventDefault on "drop" itself — dragover's preventDefault only makes the element a
        // valid drop target) — for an <img> drag source that means inserting a second, broken
        // copy of the image wherever the pointer let go.
        '@drop.prevent'() {},
        '@dragend'() {
          this.$el.classList.remove('is-dragging');

          // v-each keeps its own template element (the one still carrying "v-each") in the DOM
          // forever as a hidden sibling — every real clone has it stripped — so it has to be
          // filtered out here, not just mapped over: its own ":data-index" binding resolves with
          // no loop variable in scope and ends up set to the literal string "undefined", which
          // passes the "!== undefined" guard below and produces a stray NaN index.
          const indexes = [...this.$el.parentElement.children]
            .filter((sibling) => !sibling.hasAttribute('v-each'))
            .map((sibling) => sibling.dataset.index);

          if (indexes.every((index) => index !== undefined)) {
            this[field] = indexes.map((index) => this[field][+index]);
          }
        },
      };
    },

    // Toolbox > drag-to-adjust number inputs (Position panel's Margin/Padding handles) —
    // v-bind="e.dragHandle" on the handle; always paired with the <input> right after it.
    dragHandle: {
      '@mousedown'(e) {
        startNumberDrag(this.$el.nextElementSibling, e.clientX, 'mousemove', 'mouseup');
      },
      '@touchstart'(e) {
        startNumberDrag(this.$el.nextElementSibling, e.touches[0].clientX, 'touchmove', 'touchend');
      },
    },

    // Shared by every auto-closing <details> dropdown in the toolbox (Status/Authors/Discussion,
    // and the Position panel's Borders unit picker) — v-bind="e.detailsAutoClose"
    detailsAutoClose: {
      '@click.outside'() {
        this.$el.open = false;
      },
    },

    // Page > Status / visibility / discussion
    status: 'published',
    statuses: STATUSES,
    // The Status dropdown (toolbox.html) never lists "scheduled" as something to pick directly —
    // matching WordPress, it's set automatically by publishedAtInput() below whenever "Published
    // At" is moved into the future. Kept out of the rendered list but still in "statuses" itself,
    // so statusSummary()'s lookup above still finds its label once that happens.
    selectableStatuses: STATUSES.filter((stat) => stat.value !== 'scheduled'),
    // Page > Published At — a single datetime-local input (toolbox.html) driving both when the
    // post goes out and, via publishedAtInput() below, whether "status" reads as published or
    // scheduled.
    publishedAt: '2025-03-15T11:44',
    // Independent of "status" above — matches WordPress's own Status/Visibility split: "public"
    // (default)/"protected"/"private" is its own mutually-exclusive choice, orthogonal to
    // published/draft/pending/scheduled. toolbox.html's password field (shown only while
    // visibility === 'protected') is the one place this and "status" still meet.
    visibility: 'public',
    visibilities: VISIBILITIES,
    password: '',
    // Named "discussionStatus", not "discussion" — toolbox.html's own discussion radios read
    // `v-each="discussion in discussions"`, and that loop variable would shadow a same-named
    // top-level field inside discussionOption()'s bare "discussion.value" reference below.
    discussionStatus: DISCUSSIONS[0]?.value || '',
    discussions: DISCUSSIONS,

    // Page > Authors
    author: 'John Doe',
    authors: AUTHORS,

    // Page > featured image gallery — each entry is an <img> src, a data: URL once uploaded via
    // galleryInput below. Starts empty; nothing is shown until the user adds one.
    thumbnails: [],

    // Page > Categories (two-level term tree)
    terms: {
      lvl1: '',
      lvl2: '',
    },

    // Position panel: border-anchored margin controls
    marginTop: 0,
    marginEnd: 0,
    marginBottom: 0,
    marginStart: 0,

    // Page > featured image gallery "add" control — the 2nd .editrix-control in toolbox.html.
    // v-bind="e.galleryInput" on the hidden `<input type="file" multiple>` inside the dashed "ADD
    // IMAGE" label; reads every selected image with FileReader (same convention as
    // youla-expansa.js's avatar uploader) and appends each as a data URL onto "thumbnails" — by
    // assignment, never .push(), so v-each (toolbox.html) picks up the change and renders it.
    galleryInput: {
      '@change'(e) {
        const files = [...e.target.files].filter((file) => file.type.startsWith('image/'));
        e.target.value = '';

        files.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            this.thumbnails = [...this.thumbnails, event.target.result];
          };
          reader.readAsDataURL(file);
        });
      },
    },
    // v-bind="e.galleryRemove" on each gallery item's trash icon — removes that item's own index
    // out of "thumbnails" (set by the `:data-index="index"` its v-each carries), rather than the
    // DOM node directly, so the reactive array stays the source of truth for what v-each renders.
    galleryRemove: {
      '@click'() {
        const index = +this.$el.closest('.editrix-gallery-item').dataset.index;
        this.thumbnails = this.thumbnails.filter((_, i) => i !== index);
      },
    },

    // Page > Status/Authors/Discussion — the 3rd .editrix-control in toolbox.html
    statusSummary: {
      'v-text'() {
        return this.statuses.find((stat) => stat.value === this.status)?.label || this.status;
      },
    },
    // v-bind="e.publishedAtInput" on the "Published At" datetime-local input (toolbox.html) — a
    // plain two-way binding like v-prop's own, plus the one side effect v-prop can't express:
    // flipping "status" to/from "scheduled" depending on whether the chosen moment is still in the
    // future — matching WordPress, where "Scheduled" is never picked directly, only implied by a
    // future publish date.
    publishedAtInput: {
      ':value'() {
        return this.publishedAt;
      },
      '@input'(e) {
        this.publishedAt = e.target.value;

        if (this.publishedAt && new Date(this.publishedAt) > new Date()) {
          this.status = 'scheduled';
        } else if (this.status === 'scheduled') {
          this.status = 'published';
        }
      },
    },
    // One entry per iteration of `v-each="stat in statuses"`, so :class needs "stat" in scope —
    // a plain object (not a method) still sees it, same as the badge example in /v-bind
    statusOption: {
      '@click': "$el.closest('details').open = false",
      ':class': "status === stat.value && 'active'",
    },
    // Its own <details> now (toolbox.html), separate from Status — same shape as statusSummary()
    // above.
    visibilitySummary: {
      'v-text'() {
        return this.visibilities.find((vision) => vision.value === this.visibility)?.label || this.visibility;
      },
    },
    // One entry per iteration of `v-each="vision in visibilities"` — same shape as statusOption()
    // above, now that visibility is its own mutually-exclusive radio choice rather than a single
    // "protected" checkbox.
    visibilityOption: {
      '@click': "$el.closest('details').open = false",
      ':class': "visibility === vision.value && 'active'",
    },
    authorSummary: {
      'v-text'() {
        return this.author;
      },
    },
    // Authors aren't looped (v-each) in the markup — each radio is written out by hand — so the
    // per-author click/active-state logic is parameterized by name instead: v-bind="e.authorOption('John Doe')"
    authorOption(name) {
      return {
        '@click': `$el.closest('details').open = false`,
        ':class': `author === '${name}' && 'active'`,
      };
    },
    discussionSummary: {
      'v-text'() {
        return this.discussionStatus;
      },
    },
    discussionOption: {
      '@click': "$el.closest('details').open = false",
      ':class': "discussionStatus === discussion.value && 'active'",
    },

    // Page > Categories — the .editrix-control in toolbox.html's "Categories" section. Checking a
    // root term always clears the whole tree; checking a child term keeps its parent and clears
    // any sibling branch — v-bind="e.categoryRootOption" / v-bind="e.categoryChildOption('electronic')"
    categoryRootOption: {
      '@click': "$el.checked && (terms = {lvl1: '', lvl2: ''})",
    },
    categoryChildOption(parent) {
      return {
        '@click': `$el.checked && (terms = {lvl1: '${parent}', lvl2: ''})`,
      };
    },
  }));
});
