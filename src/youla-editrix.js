import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { DOMParser as ProseMirrorDOMParser } from 'prosemirror-model';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';

import { selectionToolbar, textToolKeymap } from './editrix/prosemirror/toolbar';
import { textInputRules } from './editrix/prosemirror/input-rules';
import { placeholder } from './editrix/prosemirror/placeholder';
import { richSchema } from './editrix/prosemirror/schemes/rich';
import { plainSchema } from './editrix/prosemirror/schemes/plain';

import { createControlsSystem } from './editrix/controls';
import { renderField } from './editrix/controls/render';
import { renderSectionRepeaterItems, renderSectionRepeaterAdd } from './editrix/controls/section-repeater';
import { createSortableItem, createDragSource, createDropTarget } from './editrix/sortable';

// Block type registry keyed by type: { label, icon, html, sections }. Populated once from backend
// data in the 'youla:init' listener below. A block's own "html" opts individual elements into live
// rich-text editing by giving them a "data-editable" attribute (see mountEditor() below) — pair it
// with "data-name" to persist that field's content into settings, and "data-placeholder" to show
// prompt text while it's empty.
let BLOCKS = {};

// Array form of BLOCKS for `v-each="block in blockList"` (view/editrix/sidebar.html). Populated alongside BLOCKS below.
let BLOCK_LIST = [];

// Patterns — a named, pre-composed set of block types (view/editrix.html's own "patterns" data),
// each just `{ key, label, icon, blocks: [blockType, ...] }`. Dragged in via patternItem() below,
// which materializes every listed block type, in order, in one drop — see canvas's own createItem().
let PATTERN_LIST = [];

// Toolbox's own section list (same shape as BLOCKS[type].sections) — built once by toolboxSections(), unlike contentFields()'s per-block rebuild. Populated in the 'youla:init' listener below.
let TOOLBOX = [];

// Tooltip text for each sidebar tab (sidebarTab(), below).
const SIDEBAR_TAB_DESCRIPTIONS = {
  blocks: 'Drag blocks onto the canvas',
  patterns: 'Insert a ready-made block pattern',
  content: "Edit the selected block's settings",
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

/**
 * Inserts CONTAINER_TOOLS_HTML as "el"'s first child and wires its edit/delete buttons, unless it's
 * already there — shared by container()'s "@mouseenter" (hover) and ":data-active" (selection) below,
 * since a block can gain tools from either.
 *
 * @param {Object} component - The reactive `this` from whichever binding is mounting.
 * @param {HTMLElement} el - A block's own `.editrix-container` element.
 */
function mountContainerTools(component, el) {
  if (el.querySelector(':scope > .editrix-container-tools')) {
    return;
  }
  el.insertAdjacentHTML('afterbegin', CONTAINER_TOOLS_HTML);

  const tools = el.querySelector(':scope > .editrix-container-tools');
  tools.querySelector('[data-action="edit"]').addEventListener('click', (e) => {
    e.stopPropagation();
    component.activeBlock = el.dataset.blockId;
    component.tab = 'content';
  });
  tools.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
    e.stopPropagation();
    deleteBlock(component, el);
  });
}

// Flattened `{ blockType: { fieldName: initialValue } }` map, read by readBlockSettings() so a block shows real starting content before its Content panel has ever registered it. Computed once BLOCKS is populated (see 'youla:init' below).
let DEFAULT_BLOCK_SETTINGS = {};

/**
 * Builds DEFAULT_BLOCK_SETTINGS from a block registry.
 *
 * @param {Object} blocks - Block registry (see BLOCKS).
 * @returns {Object}
 */
function computeDefaultBlockSettings(blocks) {
  return Object.fromEntries(
    Object.entries(blocks).map(([blockType, { sections }]) => [
      blockType,
      Object.fromEntries(sections.flatMap((section) => section.fields).map(({ name, default: defaultValue, value }) => [name, value !== undefined ? value : defaultValue])),
    ]),
  );
}

// Stable id assigned to a block the first time its container() @load fires, used to key its settings.
let blockIdSeq = 0;
function nextBlockId() {
  return `block-${++blockIdSeq}`;
}

/**
 * Reads block "el"'s settings, merged over its type's default settings.
 *
 * @param {Object} component - The reactive `this` from whichever binding is reading.
 * @param {HTMLElement} [el] - A block's own `.editrix-container` element.
 * @returns {Object}
 */
function readBlockSettings(component, el) {
  return { ...DEFAULT_BLOCK_SETTINGS[el?.dataset.blockType], ...(el?.dataset.blockId ? component.settings[el.dataset.blockId] : null) };
}

/**
 * Builds the DOM element a palette item's blockType drops in as.
 *
 * @param {string} blockType - A BLOCKS key (see paletteItem()).
 * @returns {HTMLElement|null} The new element, or null if "blockType" isn't registered.
 */
function createBlock(blockType) {
  const block = BLOCKS[blockType];
  if (!block) {
    return null;
  }

  const element = document.createElement('div');
  element.className = 'editrix-container';
  element.innerHTML = block.html;
  element.dataset.blockType = blockType;
  element.setAttribute('v-bind', 'e.container()');
  return element;
}

/**
 * Builds one ".editrix-section" per entry in "sections", appended to "container" — shared by
 * contentFields() and toolboxSections() below, since both use the same section shape.
 *
 * @param {HTMLElement} container
 * @param {Array} sections
 */
function renderSections(container, sections) {
  (sections || []).forEach(({
    heading, tooltip, fields, repeatable, name, min, max, default: defaultValue,
  }) => {
    const section = document.createElement('div');
    section.className = 'editrix-section';
    if (name) {
      section.classList.add(`editrix-section--${name}`);
    }

    const body = document.createElement('div');
    body.className = 'editrix-section-body';

    const headButtons = [];

    // "repeatable: true" (section-repeater.js) repeats the whole section's `fields` as one item template instead of rendering them once; its own "+" already lives in the section head.
    if (repeatable) {
      const limits = { min, max, default: defaultValue };
      body.append(renderSectionRepeaterItems(name, limits, fields));
      headButtons.push(renderSectionRepeaterAdd(name, limits, fields));
    } else {
      body.append(...fields.map(renderField));

      // Relocate the repeater's own expand-all button into the section heading row, matching every other section's .editrix-section-buttons.
      headButtons.push(...body.querySelectorAll('[data-part="toggle-all"]'));
    }

    // Skip the head for a heading-less, tooltip-less section with nothing in it (e.g. the toolbox's "Page" section), rather than rendering an empty bar for CSS to hide.
    if (heading || tooltip || headButtons.length) {
      const head = document.createElement('div');
      head.className = 'editrix-section-head';

      const title = document.createElement('span');
      title.className = 'editrix-section-head__title';
      title.textContent = heading;
      head.append(title);

      // Section's optional "?" tooltip icon, placed inside the title wrapper so it stays glued to the heading text rather than floating to the row's far end.
      if (tooltip) {
        const tooltipIcon = document.createElement('i');
        tooltipIcon.className = 'ph ph-question editrix-section-head__tooltip';
        tooltipIcon.setAttribute('v-tooltip.click', JSON.stringify(tooltip));
        title.append(tooltipIcon);
      }

      if (headButtons.length) {
        const buttons = document.createElement('div');
        buttons.className = 'editrix-section-buttons';
        headButtons.forEach((button) => buttons.append(button));
        head.append(buttons);
      }

      section.append(head);
    }

    section.append(body);
    container.append(section);
  });
}

/**
 * True while "el" (typically the current keydown target) is a normal text-entry context — an
 * <input>/<textarea>, or anywhere inside a contenteditable region (ProseMirror's own rich-text
 * blocks included) — so canvas's own "Delete" handler below doesn't hijack the key from ordinary
 * text editing and only removes the active block when the user isn't actually typing.
 *
 * @param {HTMLElement} [el]
 * @returns {boolean}
 */
function isEditableTarget(el) {
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

/**
 * Removes "el" from the canvas along with its settings, clearing "activeBlock" if it pointed at "el".
 *
 * @param {Object} component - The reactive `this` from whichever v-bind handler is deleting.
 * @param {HTMLElement} el - The block being removed.
 */
function deleteBlock(component, el) {
  const id = el.dataset.blockId;

  if (component.activeBlock === id) {
    component.activeBlock = null;
    component.tab = 'blocks';
  }
  delete component.settings[id];

  el.querySelectorAll('[data-editable]').forEach((field) => field._prosemirrorView?.destroy());

  component.blocks = component.blocks.filter((block) => block !== el);
  el.remove();
}

// A block's own "data-editable" attribute (see BLOCKS[type].html) picks one of these schemes:
// "rich" allows paragraphs and other block structure, "plain" is a single line of inline-formatted
// text. Placement matters — "rich" goes on a wrapper whose children are block-level (e.g. a <div>
// around a <p>), "plain" goes directly on the leaf text element itself (e.g. an <h1>).
const EDITABLE_SCHEMES = { rich: richSchema, plain: plainSchema };

/**
 * Strips the clipboard cruft Word/Google Docs wrap pasted content in (conditional comments, and
 * <meta>/<style>/<script>/<xml> tags) before it reaches ProseMirror's own DOMParser — which already
 * discards any tag or attribute its schema doesn't recognize, so this only has to handle the noise
 * that would otherwise survive as stray whitespace or empty nodes.
 *
 * @param {string} html
 * @returns {string}
 */
function sanitizePastedHTML(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(meta|link|style|script|xml)[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<(meta|link)\b[^>]*>/gi, '');
}

/**
 * Mounts a ProseMirror rich-text editor directly onto "el", taking over its existing children as
 * the editor's own starting content — a no-op if "el" is already mounted, or its own
 * "data-editable" value doesn't match a known scheme.
 *
 * @param {HTMLElement} el - The element to mount the editor onto; keeps its own tag/attributes.
 * @param {string} schemeName - "rich" or "plain" — see EDITABLE_SCHEMES above.
 * @param {Object} [options]
 * @param {string} [options.placeholder] - Shown in place of "el" when it's empty.
 * @param {(html: string) => void} [options.onUpdate] - Called with "el"'s own innerHTML after
 *   every change, so a caller can persist it (see container()'s own "@load" below).
 */
function mountEditor(el, schemeName, options = {}) {
  if (el._prosemirrorView) {
    return;
  }

  const schema = EDITABLE_SCHEMES[schemeName];
  if (!schema) {
    console.warn(`Youla.js: unknown data-editable scheme "${schemeName}".`);
    return;
  }

  const { placeholder: placeholderText, onUpdate } = options;

  const plugins = [
    keymap(textToolKeymap(schema)),
    history(),
    keymap(baseKeymap),
    textInputRules(schema),
    selectionToolbar(),
  ];

  if (placeholderText) {
    plugins.push(placeholder(placeholderText));
  }

  // A "plain" field has no paragraph to split into — Enter inserts a line break instead. Takes
  // priority over baseKeymap's own Enter (splitBlock), which would otherwise try first and fail.
  if (schemeName === 'plain') {
    plugins.unshift(keymap({
      Enter: (state, dispatch) => {
        dispatch(state.tr.replaceSelectionWith(schema.nodes.hard_break.create()).scrollIntoView());
        return true;
      },
    }));
  }

  el._prosemirrorView = new EditorView({ mount: el }, {
    state: EditorState.create({
      doc: ProseMirrorDOMParser.fromSchema(schema).parse(el),
      schema,
      plugins,
    }),
    transformPastedHTML: sanitizePastedHTML,
    dispatchTransaction(tr) {
      this.updateState(this.state.apply(tr));
      if (tr.docChanged) {
        onUpdate?.(el.innerHTML);
      }
    },
  });
}

/**
 * Drag-to-adjust a numeric <input>: nudges its value by "step" per pixel moved horizontally,
 * clamped to min/max. Uses pointer capture so releasing outside the viewport still ends the drag.
 *
 * @param {HTMLElement} handle - The drag handle itself; captures the pointer for the gesture.
 * @param {HTMLInputElement} input - The field to adjust.
 * @param {PointerEvent} startEvent - The "pointerdown" that started the drag.
 */
function startNumberDrag(handle, input, startEvent) {
  if (!input) {
    return;
  }

  const step = parseFloat(input.step) || 1;
  const min = input.min ? parseFloat(input.min) : Number.NEGATIVE_INFINITY;
  const max = input.max ? parseFloat(input.max) : Number.POSITIVE_INFINITY;
  const startValue = parseFloat(input.value) || 0;
  const startX = startEvent.clientX;

  document.body.style.userSelect = 'none';
  document.body.style.cursor = 'e-resize';
  handle.setPointerCapture(startEvent.pointerId);

  const onMove = (e) => {
    const value = Math.min(Math.max(startValue + (e.clientX - startX) * step, min), max);

    input.value = +value.toFixed(6);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const onEnd = () => {
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    handle.removeEventListener('pointermove', onMove);
    handle.removeEventListener('pointerup', onEnd);
    handle.removeEventListener('pointercancel', onEnd);
  };

  handle.addEventListener('pointermove', onMove);
  handle.addEventListener('pointerup', onEnd);
  handle.addEventListener('pointercancel', onEnd);
}

document.addEventListener('youla:init', () => {

  // Canvas zoom bounds/step, ctrl+wheel-ed in the "canvas" v-bind below
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 150;
  const ZOOM_STEP = 10;
  const ZOOM_DEFAULT = 100;

  /**
   * Reads editrix's backend data out of a `#editrix-data` JSON block (view/editrix.html) — a
   * stand-in for backend-injected data.
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
    toolbox: TOOLBOX_DATA = [],
    blocks: BLOCKS_DATA = {},
    patterns: PATTERNS_DATA = [],
  } = readBackendData('editrix-data');

  TOOLBOX = TOOLBOX_DATA;

  BLOCKS = BLOCKS_DATA;
  BLOCK_LIST = Object.entries(BLOCKS).map(([type, { label, icon }]) => ({ type, label, icon }));
  PATTERN_LIST = PATTERNS_DATA;
  DEFAULT_BLOCK_SETTINGS = computeDefaultBlockSettings(BLOCKS);

  /**
   * Editrix: the page builder's root component, mounted on `v-data="editrix as e"` (view/editrix.html).
   *
   * @since 1.0
   */
  Youla.data('editrix', () => ({
    // Control system (editrix/controls, editrix/control/<type>) — spread first so its keys aren't shadowed below.
    ...createControlsSystem({ meta: { statuses: STATUSES, visibilities: VISIBILITIES, discussions: DISCUSSIONS, authors: AUTHORS } }),

    // Sidebar navigation (sections/sidebar.html)
    tab: 'blocks',
    // Toolbox panel shown for whichever block/container was last clicked on the canvas
    section: 'content',

    /**
     * Sidebar nav tab buttons/panels (sections/sidebar.html), parameterized by tab name.
     */
    sidebarTab(name) {
      return {
        ':class': `{'active': tab === '${name}'}`,
        '@click': `tab = '${name}'`,
        'v-tooltip.style-dark.hover.2000ms': JSON.stringify(SIDEBAR_TAB_DESCRIPTIONS[name] || ''),
      };
    },
    sidebarPanel(name) {
      return {
        'v-show': `tab === '${name}'`,
      };
    },

    // Canvas (editrix-canvas) — every block container currently on it, in DOM order
    blocks: [],
    zoom: ZOOM_DEFAULT,

    // v-bind="e.canvas" — ctrl+wheel/ctrl+0 zoom, plus createDropTarget() so a dragged palette item materializes as a real block.
    canvas: {
      '@wheel.prevent.ctrl'(e) {
        this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)));
      },
      '@keydown.window.ctrl.0'() {
        this.zoom = ZOOM_DEFAULT;
      },
      /**
       * Deletes the selected block — skipped while "$event.target" is itself a normal text-entry
       * context (isEditableTarget()), so pressing Delete to edit a heading's text, or a field
       * elsewhere in the sidebar, doesn't also remove the whole block out from under it.
       */
      '@keydown.window.delete'(e) {
        if (!this.activeBlock || isEditableTarget(e.target)) {
          return;
        }

        const block = this.blocks.find((b) => b.dataset.blockId === this.activeBlock);
        if (block) {
          deleteBlock(this, block);
        }
      },
      ':style'() {
        return `zoom: ${this.zoom}%`;
      },
      ...createDropTarget({
        read: (component) => component.blocks,
        write: (component, blocks) => {
          component.blocks = blocks;
        },
        // "payload" is a single block type (paletteItem()) or an array of them, in order (a
        // pattern — patternItem()) — normalized to a list either way, so a pattern materializes as
        // that many real blocks landing together, in one drop.
        createItem(component, payload) {
          const elements = (Array.isArray(payload) ? payload : [payload]).map(createBlock).filter(Boolean);
          return elements.length ? elements.map((element) => ({ element, value: element })) : null;
        },
      }),
      /**
       * A block's own "@click.stop" (container(), below) keeps this from firing on a block
       * click — so this only means the canvas background was clicked, i.e. deselect.
       */
      '@click'() {
        this.activeBlock = null;
        this.tab = 'blocks';
      },
    },

    // Toolbar > zoom dropdown — v-bind="e.zoomSummary" on the <summary>, v-bind="e.zoomOption(75)" on each preset.
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

    // Sidebar > block palette (view/editrix/sidebar.html) — `v-each="block in blockList"` renders one ".editrix-blocks-item" per BLOCKS entry.
    blockList: BLOCK_LIST,

    /**
     * v-bind="e.paletteItem(block.type)" — starts a drag session canvas()'s own
     * createDropTarget() picks up, materializing a new block once dragged onto the canvas.
     */
    paletteItem(blockType) {
      return createDragSource(blockType);
    },

    // Sidebar > patterns palette (view/editrix.html) — `v-each="pattern in patternList"` renders one ".editrix-blocks-item" per PATTERN_LIST entry.
    patternList: PATTERN_LIST,

    /**
     * v-bind="e.patternItem(pattern.blocks)" — same drag session as paletteItem(), just carrying
     * an array of block types instead of one; canvas's own createItem() materializes all of them.
     */
    patternItem(blockTypes) {
      return createDragSource(blockTypes);
    },

    /**
     * Canvas > block container — v-bind="e.container()". Any of the block's own elements carrying
     * a "data-editable" attribute (see BLOCKS[type].html) gets mounted as a live ProseMirror field.
     */
    container() {
      return {
        /**
         * A style set to undefined (a field the block type doesn't declare) is a safe no-op.
         */
        ':style'() {
          const settings = readBlockSettings(this, this.$el);

          return {
            textAlign: settings.align,
            '--editrix-accent': settings.accent_color,
          };
        },
        /**
         * The block's current position in `blocks`, also read back by createSortableItem()'s
         * own commit.
         */
        ':data-index'() {
          return this.blocks.indexOf(this.$el);
        },
        /**
         * Reactively mirrors "activeBlock" onto this block, so CSS can pin its tools bar while
         * selected — and, unlike "@mouseenter"/"@mouseleave" below, keeps the tools mounted for as
         * long as the block stays selected, even once the cursor leaves it.
         */
        ':class'() {
          const isActive = this.activeBlock === this.$el.dataset.blockId;

          if (isActive) {
            mountContainerTools(this, this.$el);
          } else if (!this.$el.matches(':hover')) {
            this.$el.querySelector(':scope > .editrix-container-tools')?.remove();
          }
          return { 'is-active': isActive };
        },
        '@load'() {
          if (!this.blocks.includes(this.$el)) {
            this.blocks = [...this.blocks, this.$el];
          }
          if (!this.$el.dataset.blockId) {
            this.$el.dataset.blockId = nextBlockId();
          }
          this.$el.querySelectorAll('[data-editable]').forEach((field) => {
            const blockId = this.$el.dataset.blockId;
            const name = field.dataset.name;

            mountEditor(field, field.dataset.editable, {
              placeholder: field.dataset.placeholder,
              onUpdate: name ? (html) => {
                (this.settings[blockId] ??= {})[name] = html;
              } : undefined,
            });
          });
          // Prevents a block's own <img>/<a> (natively draggable, with their own native drag/drop
          // cursor handling baked into the browser) from competing with the container's own drag —
          // "draggable=false" alone stops them from becoming their own drag source, but a *foreign*
          // drag hovering one can still show the browser's own "not allowed" cursor and refuse to
          // drop, even once our own dragover handler on the container has accepted it. Routing
          // pointer events around them entirely (they carry no interaction of their own) avoids that.
          this.$el.querySelectorAll('img, a').forEach((el) => {
            el.setAttribute('draggable', 'false');
            el.style.pointerEvents = 'none';
          });
        },
        ...createSortableItem({
          read: (component) => component.blocks,
          write: (component, blocks) => {
            component.blocks = blocks;
          },
          placeholder: true,
          // Otherwise the browser's own native drag detection can win a mousedown that starts
          // inside a live text field (even directly on its own text) over ordinary text selection.
          exclude: '[data-editable]',
        }),
        '@mouseenter'() {
          mountContainerTools(this, this.$el);
        },
        '@mouseleave'() {
          if (this.activeBlock !== this.$el.dataset.blockId) {
            this.$el.querySelector(':scope > .editrix-container-tools')?.remove();
          }
        },
        /**
         * ".stop" keeps this from also reaching canvas()'s own "@click" above, which would
         * immediately deselect.
         */
        '@click.stop'() {
          this.activeBlock = this.$el.dataset.blockId;
          this.tab = 'content';
        },
        '@contextmenu.prevent'() {
          this.tab = 'blocks';
        },
      };
    },

    // Sidebar > Content tab — v-bind="e.contentFields"; rebuilds via renderSections() whenever the active block's type changes. ":data-owner" doubles as that guard and a record of the current owner type.
    contentFields: {
      ':data-owner'() {
        const activeElement = this.activeBlock && this.blocks.find((block) => block.dataset.blockId === this.activeBlock);
        const blockType = activeElement?.dataset.blockType || '';

        if (this.$el.dataset.owner === blockType) {
          return blockType;
        }
        this.$el.dataset.owner = blockType;

        // v-filler (youla-filler.js) hangs listeners off any mounted <input>; each must be destroyed before its markup is thrown away.
        this.$el.querySelectorAll('input').forEach((input) => input._x_filler?.destroy());
        this.$el.innerHTML = '';

        renderSections(this.$el, BLOCKS[blockType]?.sections);
        this.$root.__x.initialize(this.$el);
        return blockType;
      },
    },

    /**
     * Generic drag-to-reorder for any list — v-bind="e.sortable('thumbnails')", paired with
     * `:data-index="index"` on each item.
     */
    sortable(field) {
      return createSortableItem({
        read: (component) => component[field],
        write: (component, items) => {
          component[field] = items;
        },
      });
    },

    // Toolbox > drag-to-adjust number inputs (Position panel's Margin/Padding handles) — v-bind="e.dragHandle" on the handle, paired with the <input> right after it.
    dragHandle: {
      '@pointerdown'(e) {
        startNumberDrag(this.$el, this.$el.nextElementSibling, e);
      },
    },

    // Shared by every auto-closing <details> dropdown in the toolbox.
    detailsAutoClose: {
      '@click.outside'() {
        this.$el.open = false;
      },
    },

    // Toolbox — v-bind="e.toolboxSections" (view/editrix/toolbox.html); builds TOOLBOX's own sections once via renderSections(), since they never change at runtime unlike contentFields()'s per-block rebuild.
    toolboxSections: {
      '@load'() {
        // Deferred a tick: "@load" fires while the root's own Component construction is still in progress, before "$root.__x" is assigned.
        setTimeout(() => {
          renderSections(this.$el, TOOLBOX);
          this.$root.__x.initialize(this.$el);
        }, 0);
      },
    },

    // Page > title — read/written directly by the "Page" panel's textarea control (control/textarea's createTextareaControl()).
    title: 'Some title for new post about Expansa and hello',
  }));
});
