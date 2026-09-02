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
import { renderSectionRepeaterItems, renderSectionRepeaterAdd } from './editrix/controls/section-repeater';
import { createSortableItem, createDragSource, createDropTarget } from './editrix/sortable';

// Block type registry keyed by type: { label, icon, html, scheme, sections }. Populated once from backend data in the 'youla:init' listener below.
let BLOCKS = {};

// Array form of BLOCKS for `v-each="block in blockList"` (view/editrix/sidebar.html). Populated alongside BLOCKS below.
let BLOCK_LIST = [];

// Toolbox's own section list — same shape as BLOCKS[type].sections (heading/tooltip/repeatable/
// name/min/max/default/fields), rendered by the same renderSections() as contentFields() below.
// Unlike BLOCKS's sections, these never depend on which block is selected, so there's no
// rebuild-on-change to wire up — toolboxSections() builds it once. Populated once from backend data
// in the 'youla:init' listener below.
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

// Flattened `{ blockType: { fieldName: initialValue } }` map, read by readBlockSettings() so a block shows its actual starting content — an explicit "value" (the backend's real content for this field) if declared, else "default" — even before its own Content panel (and so registerControl()'s own identical fallback, controls/base.js) has ever run for it. Computed once BLOCKS is populated — see 'youla:init' below.
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
 * Reads block element "el"'s settings, merged over its type's DEFAULT_BLOCK_SETTINGS entry so an untouched field still reads its declared default.
 *
 * @param {Object} component - The reactive `this` from whichever binding is reading.
 * @param {HTMLElement} [el] - A block's own `.editrix-container` element.
 * @returns {Object}
 */
function readBlockSettings(component, el) {
  return { ...DEFAULT_BLOCK_SETTINGS[el?.dataset.blockType], ...(el?.dataset.blockId ? component.settings[el.dataset.blockId] : null) };
}

/**
 * Builds the DOM element a palette item's blockType drops in as — createDropTarget()'s own
 * createItem() (canvas, below) wraps this to also supply the { element, value } shape it expects.
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
  element.setAttribute('v-bind', block.scheme !== null ? `e.container('${block.scheme}')` : 'e.container()');
  return element;
}

/**
 * Builds one ".editrix-section" per entry in "sections" and appends each to "container" — shared by
 * contentFields() (BLOCKS[blockType].sections, rebuilt whenever the selected block changes) and
 * toolboxSections() (TOOLBOX, #editrix-data's own top-level "toolbox", built once) below, since both
 * are the exact same shape: heading/tooltip/repeatable/name/min/max/default/fields.
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

    const body = document.createElement('div');
    body.className = 'editrix-section-body';

    const headButtons = [];

    // "repeatable: true" (controls/section-repeater.js) makes the whole section repeat its own `fields` as one item's template, instead of rendering them once — "name"/"min"/"max"/"default" sit alongside "heading"/"tooltip" on the section itself. Its own "+" belongs in the section head from the start, there's no relocating to do.
    if (repeatable) {
      const limits = { min, max, default: defaultValue };
      body.append(renderSectionRepeaterItems(name, limits, fields));
      headButtons.push(renderSectionRepeaterAdd(name, limits, fields));
    } else {
      body.append(...fields.map(renderField));

      // Move a repeater control's own expand-all button out of the control body and into the section heading row, matching every other section's .editrix-section-buttons.
      headButtons.push(...body.querySelectorAll('[data-part="toggle-all"]'));
    }

    // Skip the head entirely for a heading-less, tooltip-less section with nothing to put in it (e.g. the toolbox's own "Page" section) — rather than rendering an empty bar for CSS to hide.
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
 * Removes "el" from the canvas along with its settings, clearing "activeBlock" if it pointed at "el".
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
 * Mounts a ProseMirror rich-text editor onto "el" — "h1" gets the title scheme (Enter inserts a line break instead of splitting the block), anything else gets the base scheme.
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
 * Drag-to-adjust a numeric <input>: nudges its value by "step" per pixel moved horizontally, clamped to min/max. Uses pointer capture (not window mousemove/mouseup) so releasing outside the viewport still fires an end event, instead of leaking a listener that nudges the input forever.
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
   * Reads the "Page" panel's option lists and the block registry out of the `#editrix-data` JSON block (view/editrix.html) — a stand-in for backend-injected data.
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
  } = readBackendData('editrix-data');

  TOOLBOX = TOOLBOX_DATA;

  // Populate the module-scope registries now that backend data has been read.
  BLOCKS = BLOCKS_DATA;
  BLOCK_LIST = Object.entries(BLOCKS).map(([type, { label, icon }]) => ({ type, label, icon }));
  DEFAULT_BLOCK_SETTINGS = computeDefaultBlockSettings(BLOCKS);

  /**
   * Editrix: the page builder's root component, mounted on `<div class="editrix" v-data="editrix as e">` (view/editrix.html). Holds the sidebar/canvas/"Page" panel state and every `v-bind` set those views reference.
   *
   * @since 1.0
   */
  Youla.data('editrix', () => ({
    // Control system (label/tooltip/description/condition/responsive + field controls) — see editrix/controls. Spread first so its keys aren't shadowed below.
    ...createControlsSystem(),

    // Sidebar navigation (sections/sidebar.html)
    tab: 'blocks',
    // Toolbox panel shown for whichever block/container was last clicked on the canvas
    section: 'content',

    // Sidebar nav tab buttons/panels (sections/sidebar.html), parameterized by tab name.
    sidebarTab(name) {
      return {
        ':class': `{'active': tab === '${name}'}`,
        '@click': `tab = '${name}'`,
        'v-tooltip.hover.2000ms': JSON.stringify(SIDEBAR_TAB_DESCRIPTIONS[name] || ''),
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

    // v-bind="e.canvas" on .editrix-preview — ctrl+wheel/ctrl+0 zoom, plus createDropTarget() (sortable.js) so a palette item (paletteItem(), below) dragged in materializes as a real block and rides the same reordering every block already has via container()'s own createSortableItem().
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
      ...createDropTarget({
        read: (component) => component.blocks,
        write: (component, blocks) => {
          component.blocks = blocks;
        },
        createItem(component, blockType) {
          const element = createBlock(blockType);
          return element && { element, value: element };
        },
      }),
      // A block's own "@click.stop" (container(), below) keeps this from firing on a block click — so this only means the canvas background was clicked, i.e. deselect.
      '@click'() {
        this.activeBlock = null;
      },
    },

    // Toolbar > zoom dropdown (sections/toolbar.html) — v-bind="e.zoomSummary" on the <summary>, v-bind="e.zoomOption(75)" on each preset.
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

    // v-bind="e.paletteItem(block.type)" on each palette entry — createDragSource() (sortable.js) starts a drag session canvas()'s own createDropTarget() picks up, materializing a new block from BLOCKS[blockType] (createBlock()) the moment it's dragged over the canvas.
    paletteItem(blockType) {
      return createDragSource(blockType);
    },

    // Canvas > block container — v-bind="e.container()", or v-bind="e.container('h1')" to also mount a rich-text editor. createSortableItem() (sortable.js) handles drag-to-reorder among sibling blocks; this only adds hover tools and toolbox panel switching on top.
    container(scheme) {
      return {
        // Only fields a block type actually declares apply here — readBlockSettings() returns undefined for the rest, a safe no-op for setProperty().
        ':style'() {
          const settings = readBlockSettings(this, this.$el);

          return {
            textAlign: settings.align,
            '--editrix-accent': settings.accent_color,
          };
        },
        // Reactive, not maintained by hand — always the block's current position in `blocks`, kept correct across add/remove/reorder for free, the same "data-index" createSortableItem()'s own commit reads back on drop.
        ':data-index'() {
          return this.blocks.indexOf(this.$el);
        },
        '@load'() {
          if (!this.blocks.includes(this.$el)) {
            this.blocks = [...this.blocks, this.$el];
          }
          if (!this.$el.dataset.blockId) {
            this.$el.dataset.blockId = nextBlockId();
          }
          if (scheme !== undefined) {
            mountEditor(this.$el, scheme);
          }
          // <img>/<a> are natively draggable in every browser, regardless of the container's own "draggable" — left alone, a block's own image (editrix-image, say) competes with createSortableItem()'s drag on the container around it, so which one actually wins the gesture is inconsistent. Only the container itself should ever start a drag.
          this.$el.querySelectorAll('img, a').forEach((el) => el.setAttribute('draggable', 'false'));
        },
        ...createSortableItem({
          read: (component) => component.blocks,
          write: (component, blocks) => {
            component.blocks = blocks;
          },
        }),
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
        // ".stop" keeps this from also reaching canvas()'s own "@click" above, which would immediately deselect.
        '@click.stop'() {
          this.activeBlock = this.$el.dataset.blockId;
          this.tab = 'content';
        },
        '@contextmenu.prevent'() {
          this.tab = 'blocks';
        },
      };
    },

    // Sidebar > Content tab — v-bind="e.contentFields" on the panel's mount div. Rebuilds one ".editrix-section" per BLOCKS[blockType]'s `sections` entry (renderSections() above) whenever the active block's type changes; ":data-owner" doubles as that guard and a record of the current owner type.
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

    // Generic drag-to-reorder for any list — v-bind="e.sortable('thumbnails')", paired with `:data-index="index"` (e.g. `v-each="(item, index) in thumbnails"`) to keep the array in sync.
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

    // Toolbox — v-bind="e.toolboxSections" on its own mount div (view/editrix/toolbox.html). Builds
    // TOOLBOX's own sections (#editrix-data, same shape as BLOCKS[type].sections) once, via the same
    // renderSections() as contentFields() above — unlike contentFields()'s BLOCKS-driven rebuild,
    // this never needs to rebuild: which sections/fields the toolbox shows never changes at runtime.
    toolboxSections: {
      '@load'() {
        // "@load" fires synchronously while the root's own `new Component(el)` construction is still
        // in progress, so `this.$root.__x` isn't assigned yet (index.js's `componentInitialize` only
        // sets `el.__x` after that constructor returns) — defer a tick so it's there by the time
        // these freshly-appended sections need their own directives wired up.
        setTimeout(() => {
          renderSections(this.$el, TOOLBOX);
          this.$root.__x.initialize(this.$el);
        }, 0);
      },
    },

    // Page > Status / visibility / discussion
    status: 'published',
    statuses: STATUSES,
    // "scheduled" is set automatically by publishedAtInput() below rather than picked directly, but stays in "statuses" so statusSummary() still finds its label.
    selectableStatuses: STATUSES.filter((stat) => stat.value !== 'scheduled'),
    // Drives both the publish time and, via publishedAtInput() below, whether "status" is published or scheduled.
    publishedAt: '2025-03-15T11:44',
    // Independent of "status" above — public (default)/protected/private, matching WordPress's Status/Visibility split.
    visibility: 'public',
    visibilities: VISIBILITIES,
    password: '',
    // Named "discussionStatus" (not "discussion") to avoid shadowing the `v-each="discussion in discussions"` loop variable used in discussionOption() below.
    discussionStatus: DISCUSSIONS[0]?.value || '',
    discussions: DISCUSSIONS,

    // Page > title — v-prop="title" on the "Page" panel's own textarea control (bound dynamically by CONTROL_RENDERERS.textarea, controls/render.js).
    title: 'Some title for new post about Expansa and hekllo',

    // Page > Authors
    author: 'John Doe',
    authors: AUTHORS,

    // Page > featured image gallery — each entry is an <img> src (a data: URL once uploaded via galleryInput below).
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

    // Page > featured image gallery "add" control — reads selected images with FileReader and appends each as a data URL to "thumbnails" (by assignment, never .push(), so v-each picks up the change).
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
    // Removes an item by index (from `:data-index`) rather than the DOM node, keeping "thumbnails" the source of truth.
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
    // Two-way binding for the "Published At" input, plus flipping "status" to/from "scheduled" based on whether the date is in the future.
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
    // One entry per `v-each="stat in statuses"` — a plain object still sees "stat" in scope.
    statusOption: {
      '@click': "$el.closest('details').open = false",
      ':class': "status === stat.value && 'active'",
    },
    // Same shape as statusSummary() above.
    visibilitySummary: {
      'v-text'() {
        return this.visibilities.find((vision) => vision.value === this.visibility)?.label || this.visibility;
      },
    },
    // Same shape as statusOption() above.
    visibilityOption: {
      '@click': "$el.closest('details').open = false",
      ':class': "visibility === vision.value && 'active'",
    },
    authorSummary: {
      'v-text'() {
        return this.author;
      },
    },
    // Authors aren't looped (v-each) in the markup, so click/active-state is parameterized by name: v-bind="e.authorOption('John Doe')"
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

    // Page > Categories — checking a root term clears the whole tree; checking a child keeps its parent and clears any sibling branch.
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
