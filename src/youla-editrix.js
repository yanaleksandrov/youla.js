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
import { cloneTemplateFragment } from './editrix/controls/template';

import { createCollab } from './editrix/collab';
import { createWsTransport } from './editrix/collab/transport-ws';
import { colorForUser } from './editrix/collab/presence';
import { isLockedByOther } from './editrix/collab/lock';

// Dev-only relay (server/collab-dev-server.js) for the presence + soft-lock collaboration feature —
// a real host backend swaps this URL, and editrix/collab/transport-ws.js, for its own realtime
// transport; nothing else in this file depends on WebSocket directly.
const COLLAB_WS_URL = 'ws://localhost:4000';

// The current page's live collaboration session (editrix/collab), or null before connectCollab()
// runs / after it's torn down. Kept at module scope, like BLOCKS/blockIdSeq below, so its internal
// timers/socket are never wrapped by makeObservable's reactivity Proxy.
let collab = null;

// Block type registry keyed by type: { label, icon, sections }. Populated once from backend data in
// the 'youla:init' listener below. A block's own markup isn't in here — it's a "<template id=
// "editrix-block-<type>">" (src/editrix/blocks/<type>/index.html, required from view/editrix.html
// same as a control's own template — see webpack.config.js), cloned by createBlock() below. Opt
// individual elements into live rich-text editing with a "data-editable" attribute (see mountEditor()
// below) — pair it with "data-name" to persist that field's content into settings, and
// "data-placeholder" to show prompt text while it's empty.
let BLOCKS = {};

// Array form of BLOCKS for `v-each="block in blockList"` (view/editrix/sidebar.html). Populated alongside BLOCKS below.
let BLOCK_LIST = [];

// Patterns — a named, pre-composed set of block types (view/editrix.html's own "patterns" data),
// each just `{ key, label, icon, blocks: [blockType, ...] }`. Dragged in via patternItem() below,
// which materializes every listed block type, in order, in one drop — see canvasList's own createItem().
let PATTERN_LIST = [];

// Toolbox's own section list (same shape as BLOCKS[type].sections) — built once by toolboxSections(), unlike contentFields()'s per-block rebuild. Populated in the 'youla:init' listener below.
let TOOLBOX = [];

// Sidebar nav "Page" tab's own section list (same shape as TOOLBOX above) — built once by
// pageFields(), below. Populated in the 'youla:init' listener below.
let PAGE_FIELDS = [];

// Elementor-style Content/Layout/Advanced sub-tabs shown inside the sidebar's "Content" panel
// (v-bind="e.sidebarPanel('content')", view/editrix.html) for whichever block is active — see
// renderContentTabs() below. Fixed, unlike sidebarTabs/BLOCKS: every block sorts its own sections
// into these same three, via each section's own `tab` (BLOCKS[type].sections, config.json).
const CONTENT_TABS = [
  { key: 'content', label: 'Content' },
  { key: 'layout', label: 'Layout' },
  { key: 'advanced', label: 'Advanced' },
];

// Sidebar nav tab list (view/editrix.html's own "sidebarTabs" data) — `{ name, label, icon, tooltip }`
// per tab, rendered via `v-each="navTab in sidebarTabs"` (view/editrix.html). Populated in the
// 'youla:init' listener below, same as BLOCK_LIST/PATTERN_LIST/TOOLBOX above. The "content" tab
// (shown once a block is selected — see setActiveBlock()) has no nav button of its own, so it's
// never part of this list.
let SIDEBAR_TABS = [];

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
    setActiveBlock(component, el.dataset.blockId);
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
 * The canvas <iframe> element — a singleton, like BLOCKS/collab above.
 *
 * @returns {HTMLIFrameElement|null}
 */
function getCanvasFrame() {
  return document.querySelector('.editrix-canvas');
}

/**
 * Lazily builds the canvas iframe's own document — a real CSS/DOM isolation boundary between block
 * content (and, eventually, an arbitrary theme's own stylesheet) and the editor chrome's own styles,
 * neither of which shares a cascade with the other once block markup lives here instead of the
 * parent document. An "about:blank" iframe already has a minimal document synchronously, before its
 * own (never-fired-here) "load" event — so this never has to wait on anything.
 *
 * @param {HTMLIFrameElement} iframeEl
 * @returns {Document}
 */
function getCanvasDocument(iframeEl) {
  return iframeEl.contentDocument;
}

// The canvas iframe's own list root (an "editrix-canvas-list" div, its own document's <body>'s only
// child) — set up once per iframe by getCanvasList() below, keyed so a hot-reload re-running
// canvas()'s own "@load" doesn't rebuild it.
const canvasLists = new WeakMap();

/**
 * The canvas's own drop-target list root, building it (and the iframe's <head>/<body> around it)
 * the first time it's needed. "createDropTarget()"'s directives (canvasList, below) are wired onto
 * it manually via initialize() rather than left for auto-discovery, since the parent's own
 * MutationObserver (Youla's componentWatch) only ever watches the parent document's <body> — an
 * iframe's separate document is invisible to it. Mirrors the existing contentFields()/
 * toolboxSections() pattern of building markup imperatively, then calling initialize() once.
 *
 * @param {Object} component - The reactive `this` from canvas()'s own "@load".
 * @param {HTMLIFrameElement} iframeEl
 * @returns {HTMLElement}
 */
function getCanvasList(component, iframeEl) {
  const existing = canvasLists.get(iframeEl);
  if (existing) {
    return existing;
  }

  const doc = getCanvasDocument(iframeEl);

  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = '/css/editrix-canvas.css';
  doc.head.append(link);

  const list = doc.createElement('div');
  list.className = 'editrix-canvas-list';
  list.setAttribute('v-bind', 'e.canvasList');
  doc.body.append(list);

  canvasLists.set(iframeEl, list);
  component.$root.__x.initialize(list);
  return list;
}

/**
 * Builds the DOM element a palette item's blockType drops in as.
 *
 * @param {string} blockType - A BLOCKS key (see paletteItem()).
 * @param {Document} [targetDocument] - The block lands in the canvas iframe's own document, not
 *   this script's own — only the block's own <template> (required from view/editrix.html) stays
 *   looked up in the parent document, since that's where markup templates are still defined.
 * @returns {HTMLElement|null} The new element, or null if "blockType" isn't registered.
 */
function createBlock(blockType, targetDocument = document) {
  const block = BLOCKS[blockType];
  if (!block) {
    return null;
  }

  const element = targetDocument.createElement('div');
  element.className = 'editrix-container';

  // A migrated block type (src/editrix/blocks/<type>/) carries its markup as a "<template id=
  // "editrix-block-<type-without-its-'editrix-'-prefix>">" instead (e.g. "editrix-heading" ->
  // "editrix-block-heading", matching the folder name) — the rest still have it inline as
  // BLOCKS[type].html until they migrate too. cloneTemplateFragment() always reads the template from
  // the parent document; appendChild() below re-homes the cloned fragment into "targetDocument"
  // automatically (standard DOM node-insertion behavior across documents).
  const templateId = `editrix-block-${blockType.replace(/^editrix-/, '')}`;
  if (document.getElementById(templateId)) {
    element.appendChild(cloneTemplateFragment(templateId));
  } else {
    element.innerHTML = block.html;
  }

  element.dataset.blockType = blockType;
  element.setAttribute('v-bind', 'e.container()');
  return element;
}

/**
 * Builds one ".editrix-section" per entry in "sections", appended to "container" — shared by
 * contentFields() and toolboxSections() below, since both use the same section shape. A section's
 * own `condition` (same shape as a field's — see controls/base.js's isConditionMet()) hides the
 * whole section, letting one field toggle a group of others rather than just itself.
 *
 * @param {HTMLElement} container
 * @param {Array} sections
 * @param {boolean} [dark] - Every tooltip in the editor is style-dark except the toolbox's own
 *   (view/editrix.html's ".editrix-toolbox", built via toolboxSections() below) — pass true for
 *   every other caller (contentFields(), pageFields()).
 */
function renderSections(container, sections, dark = false) {
  (sections || []).forEach(({
    heading, tooltip, fields, repeatable, name, min, max, default: defaultValue, condition,
  }) => {
    const section = document.createElement('div');
    section.className = 'editrix-section';
    if (name) {
      section.classList.add(`editrix-section--${name}`);
    }

    // Elementor-style condition (controls/base.js's isConditionMet()), same shape as a field's own
    // `condition` — hides the whole section, e.g. `{ show_advanced: true }`, `{ 'layout!': 'boxed' }`.
    if (condition) {
      section.setAttribute('v-show', `e.isConditionMet(${JSON.stringify(condition)})`);
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
      body.append(...fields.map((field) => renderField({ ...field, dark })));

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
        tooltipIcon.setAttribute(`v-tooltip.click${dark ? '.style-dark' : ''}`, JSON.stringify(tooltip));
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
 * Builds the sidebar's "Content" panel (v-bind="e.sidebarPanel('content')", view/editrix.html) with
 * Elementor-style Content/Layout/Advanced sub-tabs, grouping "sections" by each section's own `tab`
 * (BLOCKS[type].sections, config.json — same idea as Elementor's per-control "tab" key) and falling
 * back to "content" for a section that doesn't declare one. Reuses renderSections() per tab so a
 * section's own heading/condition/repeatable handling stays identical to every other caller.
 *
 * @param {HTMLElement} container
 * @param {Array} sections
 */
function renderContentTabs(container, sections) {
  const nav = document.createElement('div');
  nav.className = 'editrix-content-tabs';

  CONTENT_TABS.forEach(({ key, label }) => {
    const button = document.createElement('div');
    button.className = 'editrix-content-tab';
    button.textContent = label;
    button.setAttribute(':class', `{'active': e.contentTab === '${key}'}`);
    button.setAttribute('@click', `e.contentTab = '${key}'`);
    nav.append(button);
  });

  container.append(nav);

  CONTENT_TABS.forEach(({ key }) => {
    const panel = document.createElement('div');
    panel.className = 'editrix-content-tab-panel';
    panel.setAttribute('v-show', `e.contentTab === '${key}'`);

    renderSections(panel, (sections || []).filter((section) => (section.tab || 'content') === key), true);
    container.append(panel);
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
 * Centralizes every place that changes which block is selected, so a lock is released on the block
 * being left and acquired on the one being entered (see editrix/collab — createCollab()'s
 * acquireLock/releaseLock). "collab" is null (a no-op) until connectCollab() has run.
 *
 * @param {Object} component - The reactive `this` from whichever v-bind handler is selecting.
 * @param {string|null} blockId - The block being selected, or null to deselect.
 */
function setActiveBlock(component, blockId) {
  if (component.activeBlock && component.activeBlock !== blockId) {
    collab?.releaseLock(component.activeBlock);
  }
  component.activeBlock = blockId;
  component.tab = blockId ? 'content' : 'blocks';
  component.contentTab = 'content';
  if (blockId) {
    collab?.acquireLock(blockId);
  }
}

/**
 * Removes "el" from the canvas along with its settings, clearing "activeBlock" if it pointed at "el".
 *
 * @param {Object} component - The reactive `this` from whichever v-bind handler is deleting.
 * @param {HTMLElement} el - The block being removed.
 */
function deleteBlock(component, el) {
  const id = el.dataset.blockId;

  // Unconditional: harmless even if this client never held a lock on "id" (a block can be deleted
  // from a hover-only state, never selected — see mountContainerTools()'s own delete button).
  collab?.releaseLock(id);
  if (component.activeBlock === id) {
    setActiveBlock(component, null);
  }
  delete component.settings[id];
  syncCustomCss(id, null);

  el.querySelectorAll('[data-editable]').forEach((field) => field._prosemirrorView?.destroy());

  component.blocks = component.blocks.filter((block) => block !== el);
  el.remove();
}

/**
 * Publishes a block's own Custom CSS (control/custom-css) as a scoped <style> tag in <head>, one
 * per block id so multiple blocks' own CSS never collides — removed once the block has none left
 * (including on delete, see deleteBlock() above). Every "selector" in the author's own CSS is
 * replaced with one that targets this block's own root element, matching Elementor's own
 * Custom CSS convention.
 *
 * @param {string} blockId
 * @param {string} [css] - Raw CSS using "selector" as a placeholder; a style tag is removed if this is falsy.
 */
function syncCustomCss(blockId, css) {
  // The block itself now renders inside the canvas iframe's own document — the scoped <style> tag
  // has to live there too, or its selector never matches anything in this (parent) document.
  const canvasDocument = getCanvasFrame()?.contentDocument;
  if (!canvasDocument) {
    return;
  }

  const tagId = `editrix-custom-css-${blockId}`;
  let tag = canvasDocument.getElementById(tagId);

  if (!css) {
    tag?.remove();
    return;
  }

  if (!tag) {
    tag = canvasDocument.createElement('style');
    tag.id = tagId;
    canvasDocument.head.append(tag);
  }

  const scopedCss = css.replace(/\bselector\b/g, `.editrix-container[data-block-id="${blockId}"]`);
  if (tag.textContent !== scopedCss) {
    tag.textContent = scopedCss;
  }
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
 * @param {() => void} [options.onFocus] - Called when the field gains focus — container()'s "@load"
 *   uses this to acquire a collab lock on the field's own block.
 * @param {() => void} [options.onBlur] - The onFocus's counterpart, releasing that lock.
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

  const {
    placeholder: placeholderText, onUpdate, onFocus, onBlur,
  } = options;

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
    handleDOMEvents: {
      focus: () => {
        onFocus?.();
        return false;
      },
      blur: () => {
        onBlur?.();
        return false;
      },
    },
    dispatchTransaction(tr) {
      this.updateState(this.state.apply(tr));
      if (tr.docChanged) {
        onUpdate?.(el.innerHTML);
      }
    },
  });
}

/**
 * Merges an incoming "change:block" patch (editrix/collab) into a block's local settings. Every
 * sidebar-driven field picks this up on its own — getValue()/readBlockSettings()/etc. (controls/
 * base.js) are plain reactive getters over "settings" — so this only has extra work for rich-text
 * fields: ProseMirror owns its own doc state rather than being re-rendered by a reactive binding,
 * so a patched field is destroyed and remounted with the new HTML instead.
 *
 * @param {Object} component
 * @param {string} blockId
 * @param {Object} patch
 */
function applyRemoteChange(component, blockId, patch) {
  component.settings[blockId] = { ...component.settings[blockId], ...patch };

  const el = component.blocks.find((block) => block.dataset.blockId === blockId);
  el?.querySelectorAll('[data-editable]').forEach((field) => {
    const name = field.dataset.name;
    if (!name || !Object.prototype.hasOwnProperty.call(patch, name)) {
      return;
    }

    field._prosemirrorView?.destroy();
    delete field._prosemirrorView;
    field.innerHTML = patch[name];
    mountEditor(field, field.dataset.editable, {
      placeholder: field.dataset.placeholder,
      onUpdate: (html) => {
        (component.settings[blockId] ??= {})[name] = html;
        component.broadcastChange(blockId);
      },
      onFocus: () => collab?.acquireLock(blockId),
      onBlur: () => collab?.releaseLock(blockId),
    });
  });
}

/**
 * Reflects "component.locks[el.dataset.blockId]" onto "el": a bordered overlay naming the other
 * user while it's locked by someone else, and — for any rich-text field mounted inside it —
 * ProseMirror's own live "editable" prop, flipped via view.setProps() rather than a remount, since
 * the document itself doesn't change, only whether it currently accepts input.
 *
 * @param {Object} component
 * @param {HTMLElement} el - A block's own ".editrix-container" element.
 * @param {string} [currentUserId]
 */
function syncBlockLockState(component, el, currentUserId) {
  const lock = component.locks[el.dataset.blockId];
  const lockedByOther = !!lock && lock.userId !== currentUserId;

  let overlay = el.querySelector(':scope > .editrix-lock-overlay');
  if (lockedByOther) {
    if (!overlay) {
      // "el" now typically lives in the canvas iframe's own document, not this script's — build the
      // overlay there too.
      overlay = el.ownerDocument.createElement('div');
      overlay.className = 'editrix-lock-overlay';
      el.prepend(overlay);
    }
    overlay.style.setProperty('--editrix-lock-color', colorForUser(lock.userId));
    overlay.textContent = `${lock.userName} is editing`;
  } else {
    overlay?.remove();
  }

  el.querySelectorAll('[data-editable]').forEach((field) => {
    field._prosemirrorView?.setProps({ editable: () => !lockedByOther });
  });
}

/**
 * Opens (once) the current page's collaboration session and wires its callbacks into the reactive
 * component. Guarded against double-connect (e.g. a hot-reload re-running the presence bar's
 * "@load") since "collab" lives at module scope — see its own declaration above.
 *
 * @param {Object} component
 * @param {string} pageId
 * @param {Object} [user] - {id, name, avatarUrl}; connecting is skipped entirely without one, since
 *   there's no identity to present or lock blocks under.
 */
function connectCollab(component, pageId, user) {
  if (collab || !user) {
    return;
  }

  collab = createCollab({
    pageId,
    user,
    transport: createWsTransport(COLLAB_WS_URL),
    onPresenceChange: (users) => {
      component.presentUsers = users;
    },
    onLockChange: (locks) => {
      component.locks = locks;
    },
    onRemoteChange: (blockId, settings) => applyRemoteChange(component, blockId, settings),
  });

  window.addEventListener('beforeunload', () => collab?.destroy());
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

  // Canvas zoom bounds/step, ctrl+wheel-ed in the "canvasList" v-bind below
  const ZOOM_MIN = 50;
  const ZOOM_MAX = 150;
  const ZOOM_STEP = 10;
  const ZOOM_DEFAULT = 100;

  /**
   * The "Delete"/"ctrl+0" keyboard shortcuts — shared between canvas() (fires while focus sits in
   * the parent chrome, e.g. a sidebar field) and canvasList() (fires while focus sits inside the
   * canvas iframe's own window instead, e.g. a selected block) — a keydown never crosses that
   * boundary on its own, so both need their own copy of the same directives rather than one shared
   * DOM listener.
   */
  function canvasKeyboardShortcuts() {
    return {
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
    };
  }

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
    sidebarTabs: SIDEBAR_TABS_DATA = [],
    pageFields: PAGE_FIELDS_DATA = [],
    positionSection: POSITION_SECTION_DATA = null,
    pageId: PAGE_ID = 'default',
    currentUser: CURRENT_USER_DATA = null,
  } = readBackendData('editrix-data');

  // "?user=<id>" overrides the seed's identity — a manual-testing convenience so two browser tabs
  // can present as two different collaborators (see server/collab-dev-server.js's own doc comment)
  // without editing #editrix-data between them. Never meant for production use.
  const testUserId = new URLSearchParams(location.search).get('user');
  const CURRENT_USER = testUserId && CURRENT_USER_DATA ? { ...CURRENT_USER_DATA, id: testUserId, name: testUserId } : CURRENT_USER_DATA;

  TOOLBOX = TOOLBOX_DATA;
  PAGE_FIELDS = PAGE_FIELDS_DATA;

  // Every block type gets the same "Position" section (view/editrix.html's own "positionSection"
  // data) tacked onto its own — so margin/padding/borders show up in every block's Content tab
  // without each block type's own config having to declare it itself.
  BLOCKS = POSITION_SECTION_DATA
    ? Object.fromEntries(Object.entries(BLOCKS_DATA).map(([type, block]) => [type, { ...block, sections: [...(block.sections || []), POSITION_SECTION_DATA] }]))
    : BLOCKS_DATA;
  BLOCK_LIST = Object.entries(BLOCKS).map(([type, { label, icon }]) => ({ type, label, icon }));
  PATTERN_LIST = PATTERNS_DATA;
  DEFAULT_BLOCK_SETTINGS = computeDefaultBlockSettings(BLOCKS);
  SIDEBAR_TABS = SIDEBAR_TABS_DATA;

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
    // Sidebar > Content panel (renderContentTabs() above) — which of the Content/Layout/Advanced
    // sub-tabs is active for the current block; reset to "content" whenever the active block
    // changes (setActiveBlock() above).
    contentTab: 'content',

    // Sidebar > nav tabs (view/editrix.html) — `v-each="navTab in sidebarTabs"` renders one
    // ".editrix-sidebar-tab" per SIDEBAR_TABS entry.
    sidebarTabs: SIDEBAR_TABS,

    /**
     * Sidebar nav tab buttons/panels (sections/sidebar.html), parameterized by tab name — "tooltip"
     * comes straight from that tab's own sidebarTabs entry (view/editrix.html), empty for a tab (like
     * "content") that isn't in that list.
     */
    sidebarTab(name, tooltip) {
      return {
        ':class': `{'active': tab === '${name}'}`,
        '@click': `tab = '${name}'`,
        // Plain "hover" (v-tooltip's own 250ms default) — unlike describeButton()'s deliberate 2s
        // delay for the ProseMirror toolbar's own per-button hints (a fast-moving toolbar the user
        // is scanning), these are a handful of always-visible, static nav icons; a 2s wait read as
        // "the tooltip doesn't work" rather than a considered delay.
        'v-tooltip.style-dark.hover': JSON.stringify(tooltip || ''),
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

    // Collaboration (editrix/collab) — other users currently on this page, and the current per-block lock map ({blockId: {userId, userName, acquiredAt}}). Populated by connectCollab()'s callbacks (see presenceBar below); colorForUser() lets templates render a lock/avatar's swatch without any color ever crossing the wire.
    presentUsers: [],
    locks: {},
    colorForUser,

    // Toolbar > presence avatars — v-bind="e.presenceBar"; connects this page's collab session once on load.
    presenceBar: {
      '@load'() {
        connectCollab(this, PAGE_ID, CURRENT_USER);
      },
    },

    /**
     * Relays "blockId"'s current settings to every other connected client — the shared funnel both
     * controls/base.js's setValue() (sidebar fields) and container()'s own rich-text onUpdate call.
     *
     * @param {string} blockId
     */
    broadcastChange(blockId) {
      collab?.broadcastChange(blockId, this.settings[blockId]);
    },

    // v-bind="e.canvas" — on the canvas <iframe> itself, in the parent document. Just builds the
    // iframe's own document/list root (getCanvasList()) once on load — every other interactive
    // directive (zoom, deselect-on-background-click, the drop target itself) lives on that list root
    // instead (canvasList, below): a wheel/click/keydown over the iframe's own rendered content fires
    // inside *its* document, never on this outer <iframe> element, and you can't appendChild() into
    // an <iframe> element itself anyway, only into its contentDocument.
    canvas: {
      '@load'() {
        // Deferred a tick, like toolboxSections()'s own "@load" below: it fires while the root's own
        // Component construction is still in progress, before "$root.__x" is assigned — and
        // getCanvasList() needs it to initialize() the list root it builds.
        setTimeout(() => {
          getCanvasList(this, this.$el);
        }, 0);
      },
      // Still needs to work while focus sits in the parent chrome (a sidebar field, say) —
      // canvasList's own copy (below) covers focus inside the canvas itself.
      ...canvasKeyboardShortcuts(),
    },

    // v-bind="e.canvasList" — on the canvas iframe's own list root (getCanvasList()), wired up
    // manually rather than auto-discovered, since it lives in a different document than the one
    // Youla's own MutationObserver watches. Owns zoom, deselect-on-background-click, and
    // createDropTarget() so a dragged palette item materializes as a real block inside the canvas's
    // own document.
    canvasList: {
      ...canvasKeyboardShortcuts(),
      '@wheel.prevent.ctrl'(e) {
        this.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, this.zoom + (e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP)));
      },
      ':style'() {
        return `zoom: ${this.zoom}%`;
      },
      // Drives ".is-empty" (editrix-canvas.scss) — a plain div, unlike the outer <iframe>, so its own
      // ":empty" would've worked too, but this stays consistent with everything else here being
      // driven off "blocks" rather than the DOM.
      ':class'() {
        return { 'is-empty': this.blocks.length === 0 };
      },
      /**
       * A block's own "@click.stop" (container(), below) keeps this from firing on a block
       * click — so this only means the canvas background was clicked, i.e. deselect.
       */
      '@click'() {
        setActiveBlock(this, null);
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
          const canvasDocument = getCanvasDocument(getCanvasFrame());
          const elements = (Array.isArray(payload) ? payload : [payload])
            .map((blockType) => createBlock(blockType, canvasDocument))
            .filter(Boolean);
          return elements.length ? elements.map((element) => ({ element, value: element })) : null;
        },
      }),
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
     * v-bind="e.paletteItem(block.type)" — starts a drag session canvasList's own
     * createDropTarget() picks up, materializing a new block once dragged onto the canvas.
     */
    paletteItem(blockType) {
      return createDragSource(blockType);
    },

    // Sidebar > patterns palette (view/editrix.html) — `v-each="pattern in patternList"` renders one ".editrix-blocks-item" per PATTERN_LIST entry.
    patternList: PATTERN_LIST,

    /**
     * v-bind="e.patternItem(pattern.blocks)" — same drag session as paletteItem(), just carrying
     * an array of block types instead of one; canvasList's own createItem() materializes all of them.
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

          syncCustomCss(this.$el.dataset.blockId, settings.customCss);

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
          // "is-reversed" is another safe no-op for a block type that doesn't declare a "reverse"
          // field (see heading/config.json's own "Layout" section for the one that does).
          const settings = readBlockSettings(this, this.$el);

          syncBlockLockState(this, this.$el, CURRENT_USER?.id);

          return {
            'is-active': isActive,
            'is-reversed': !!settings.reverse,
            'is-locked': isLockedByOther(this.locks, this.$el.dataset.blockId, CURRENT_USER?.id),
          };
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
                this.broadcastChange(blockId);
              } : undefined,
              onFocus: () => collab?.acquireLock(blockId),
              onBlur: () => collab?.releaseLock(blockId),
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
        ...(() => {
          const sortable = createSortableItem({
            read: (component) => component.blocks,
            write: (component, blocks) => {
              component.blocks = blocks;
            },
            placeholder: true,
            // Otherwise the browser's own native drag detection can win a mousedown that starts
            // inside a live text field (even directly on its own text) over ordinary text selection.
            exclude: '[data-editable]',
          });

          return {
            ...sortable,
            /**
             * Selects the block being dragged, in addition to sortable's own reorder setup — a
             * completed native drag never fires the "click" that "@click.stop" below relies on (the
             * browser suppresses it once a real drag has happened), so without this, reordering a
             * block that wasn't already selected leaves the sidebar's Content tab showing nothing
             * (or a stale previous block) until a separate, ordinary click.
             */
            '@dragstart'(e) {
              setActiveBlock(this, this.$el.dataset.blockId);
              sortable['@dragstart'].call(this, e);
            },
          };
        })(),
        // Overrides createSortableItem()'s own ':draggable': 'true' above — a later object-literal
        // key wins — so a block someone else is editing can't be dragged out from under them.
        ':draggable'() {
          return !isLockedByOther(this.locks, this.$el.dataset.blockId, CURRENT_USER?.id);
        },
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
          setActiveBlock(this, this.$el.dataset.blockId);
        },
        '@contextmenu.prevent'() {
          this.tab = 'blocks';
        },
      };
    },

    /**
     * v-bind="e.blockImage()" on an <img data-name="..."> inside a block's own markup (see
     * editrix/blocks/<type>/index.html) — reactively mirrors that field's own setting (an
     * editrix/control/image value: `{ dataUrl, fit, rotation, ...filters }`) onto "src", falling
     * back to the element's own "data-default-src" while nothing's been picked yet.
     */
    blockImage() {
      return {
        ':src'() {
          const name = this.$el.dataset.name;
          const settings = readBlockSettings(this, this.$el.closest('.editrix-container'));

          return settings[name]?.dataUrl || this.$el.dataset.defaultSrc;
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

        renderContentTabs(this.$el, BLOCKS[blockType]?.sections);
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

    // Sidebar > "Page" tab (view/editrix.html) — v-bind="e.pageFields"; builds PAGE_FIELDS's own
    // sections once via renderSections(), mirroring toolboxSections() above.
    pageFields: {
      '@load'() {
        setTimeout(() => {
          renderSections(this.$el, PAGE_FIELDS, true);
          this.$root.__x.initialize(this.$el);
        }, 0);
      },
    },

    // Page > title — read/written directly by the "Page" panel's textarea control (control/textarea's createTextareaControl()).
    title: 'Some title for new post about Expansa and hello',
  }));
});
