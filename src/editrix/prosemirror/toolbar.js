import { Plugin } from 'prosemirror-state';
import { toggleMark, setBlockType, wrapIn, lift } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { wrapInList, liftListItem, sinkListItem, splitListItem } from 'prosemirror-schema-list';

import {
  MARK_TOOLS, LINK_TOOL, HEADING_LEVELS, LIST_TYPES, BLOCKQUOTE_TYPE,
  COLOR_TOOL, HIGHLIGHT_TOOL,
} from './tools';
import { TOOLTIP_CLASS, EXIT_FALLBACK, computePosition, TooltipInstance } from '../../youla-tooltip';
import { Filler } from '../../youla-filler';

// Added to TOOLTIP_CLASS alongside the usual placement/animation classes, so the toolbar picks up
// every v-tooltip style (colors, border, bounce animation) plus its own layout on top.
const TOOLBAR_CLASS = `${TOOLTIP_CLASS}--toolbar`;

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

const isMac = typeof navigator !== 'undefined' && /Mac|iP(hone|[oa]d)/.test(navigator.platform);

// Mirrors prosemirror-keymap's own normalizeKeyName() modifier names, so a displayed shortcut
// always matches whatever key combo actually triggers it.
const MODIFIER_LABELS = {
  mod: isMac ? '⌘' : 'Ctrl',
  cmd: '⌘', meta: '⌘', m: '⌘',
  alt: isMac ? '⌥' : 'Alt', a: isMac ? '⌥' : 'Alt',
  ctrl: 'Ctrl', control: 'Ctrl', c: 'Ctrl',
  shift: isMac ? '⇧' : 'Shift', s: isMac ? '⇧' : 'Shift',
};

/**
 * A human-readable version of a prosemirror-keymap shortcut string (e.g. "Mod-Shift-x") — the
 * trailing "-(?!$)" mirrors prosemirror-keymap's own parsing, so a literal "-" key (as in
 * "Mod-Shift--", the horizontal rule shortcut) isn't swallowed as a delimiter.
 *
 * @param {string} shortcut
 * @returns {string}
 */
function formatShortcut(shortcut) {
  const parts = shortcut.split(/-(?!$)/);
  const key = parts[parts.length - 1];
  const modifiers = parts.slice(0, -1).map((mod) => MODIFIER_LABELS[mod.toLowerCase()] || mod);
  const keyLabel = key.length === 1 ? key.toUpperCase() : key;
  return [...modifiers, keyLabel].join(isMac ? '' : '+');
}

// A toolbar button's own description shouldn't compete with the button's icon for attention on
// every passing hover — only shown after a deliberate, sustained hover (v-tooltip's own default is
// 250ms, tuned for regular hint text, not a toolbar the user is scanning quickly).
const DESCRIPTION_DELAY = 2000;

/**
 * Attaches a real v-tooltip (youla-tooltip.js) to a hand-built button, describing what it does —
 * shown above the selection toolbar itself, since both are just independent "v-tooltip" elements
 * appended to <body>, not actually nested in the DOM.
 *
 * @param {HTMLElement} el
 * @param {string} description
 * @param {string} [shortcut]
 */
function describeButton(el, description, shortcut) {
  const content = shortcut ? `${description}<br><span class="v-tooltip-toolbar__hotkey">${formatShortcut(shortcut)}</span>` : description;
  // "auto" (not "top") — the toolbar itself can sit right at the top of the viewport (selecting
  // text near the top of the page), leaving no room above a button for its own hint; computePosition
  // (youla-tooltip.js) then picks whichever side actually has space, instead of clamping "top" down
  // over the button it's describing.
  el._x_tooltip = new TooltipInstance(el, content, 'auto', 'hover', DESCRIPTION_DELAY);
}

function markActive(state, type) {
  const { from, to, empty, $from } = state.selection;
  return empty ? !!type.isInSet(state.storedMarks || $from.marks()) : state.doc.rangeHasMark(from, to, type);
}

/**
 * True if the selection's parent block is "type" (blockquote's own ancestor chain, since a
 * blockquote wraps its selection rather than being the immediate parent).
 */
function blockActive(state, type) {
  const { $from } = state.selection;

  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type === type) {
      return true;
    }
  }
  return false;
}

/**
 * This schema's own MARK_TOOLS (tools.js), trimmed to whichever marks the schema actually defines.
 * Block-structure choices (heading, list, blockquote) aren't tool buttons at all — see the
 * block-type <select> built by renderToolbar()/applyBlockType() below.
 *
 * @param {import('prosemirror-model').Schema} schema
 * @returns {Array<{title: string, description: string, icon: string, shortcut: string, isActive: Function, run: Function}>}
 */
export function buildTools(schema) {
  const tools = [];

  MARK_TOOLS.forEach(({ name, title, description, icon, shortcut, primary }) => {
    const markType = schema.marks[name];
    if (!markType) {
      return;
    }

    tools.push({
      title,
      description,
      icon,
      shortcut,
      // Everything but "primary" tools (tools.js) collapses into the toolbar's own overflow menu
      // (SelectionToolbar's "More formatting" button) instead of getting its own always-on button.
      overflow: !primary,
      isActive: (state) => markActive(state, markType),
      run: (view) => {
        toggleMark(markType)(view.state, view.dispatch);
        view.focus();
      },
    });
  });

  return tools;
}

// Undo/Redo shortcut, not a toolbar button — browsers already give users Ctrl+Z, and ProseMirror
// needs its own history keymap for that to hit its history plugin instead of the contenteditable's
// native (and state-desyncing) undo. Kept out of buildTools()'s own list, same reason "link" is.
export const UNDO_REDO_KEYMAP = {
  'Mod-z': (state, dispatch) => undo(state, dispatch),
  'Mod-y': (state, dispatch) => redo(state, dispatch),
  'Mod-Shift-z': (state, dispatch) => redo(state, dispatch),
};

/**
 * Real keyboard shortcuts for a schema's own tools, plus Mod-k for the link editor (routed through
 * whichever SelectionToolbar is currently mounted on the view — see selectionToolbar() below).
 *
 * @param {import('prosemirror-model').Schema} schema
 * @returns {Object} A prosemirror-keymap bindings object.
 */
export function textToolKeymap(schema) {
  const bindings = { ...UNDO_REDO_KEYMAP };

  buildTools(schema).forEach((tool) => {
    if (tool.shortcut) {
      bindings[tool.shortcut] = (state, dispatch, view) => {
        tool.run(view);
        return true;
      };
    }
  });

  if (schema.marks.link) {
    bindings[LINK_TOOL.shortcut] = (state, dispatch, view) => {
      view._selectionToolbar?.openLinkEditor();
      return true;
    };
  }

  // Inside a list_item: Enter splits into a new item (or, on an empty item, lifts out of the list —
  // built into splitListItem itself); Tab/Shift-Tab nest/un-nest it. Each falls through to the next
  // keymap (baseKeymap's own Enter, etc.) when the selection isn't in a list_item, since these
  // commands return false there — see mountEditor()'s plugin order (youla-editrix.js).
  if (schema.nodes.list_item) {
    const { list_item: listItem } = schema.nodes;
    Object.assign(bindings, {
      Enter: splitListItem(listItem),
      'Mod-[': liftListItem(listItem),
      'Mod-]': sinkListItem(listItem),
      Tab: sinkListItem(listItem),
      'Shift-Tab': liftListItem(listItem),
    });
  }

  // Blockquote lives in the block-type <select> now (SelectionToolbar's applyBlockType()), not a
  // toggle button — Mod-Shift-b still works, routed through that same method so it stays consistent
  // with a click, toggling based on whether the selection is already in one.
  if (schema.nodes.blockquote) {
    bindings['Mod-Shift-b'] = (state, dispatch, view) => {
      const toolbar = view._selectionToolbar;
      if (!toolbar) {
        return false;
      }
      toolbar.applyBlockType(view, blockActive(state, schema.nodes.blockquote) ? '0' : 'blockquote');
      return true;
    };
  }

  return bindings;
}

// The floating toolbar itself — styled and positioned exactly like a v-tooltip (youla-tooltip.js's
// own TOOLTIP_CLASS/computePosition/EXIT_FALLBACK), just driven by the current selection instead of
// a hover/click/focus trigger. Three render modes share the one box: "toolbar" (formatting
// buttons), "link" (a small URL editor) and "color" (a Filler-backed swatch, for Text Color and
// Highlight), swapped in place rather than as separate popovers.
class SelectionToolbar {
  constructor(view) {
    const { schema } = view.state;

    this.tools = buildTools(schema);
    this.headingType = schema.nodes.heading;
    this.paragraphType = schema.nodes.paragraph;
    this.codeBlockType = schema.nodes.code_block;
    this.bulletListType = schema.nodes.bullet_list;
    this.orderedListType = schema.nodes.ordered_list;
    this.listItemType = schema.nodes.list_item;
    this.blockquoteType = schema.nodes.blockquote;
    this.linkType = schema.marks.link;
    this.colorType = schema.marks.color;
    this.highlightType = schema.marks.highlight;

    this.mode = 'toolbar';
    this.visible = false;
    this.animationState = null;
    this.placement = null;
    // The Filler instance backing the color/highlight editor's swatch input, while mode is 'color'.
    this.filler = null;
    // Whether the "More formatting" overflow menu (mode 'toolbar' only) is open.
    this.moreOpen = false;

    this.el = document.createElement('div');
    this.el.setAttribute('role', 'toolbar');
    this.el.setAttribute('aria-label', 'Text formatting');
    // Applied up front, not just from reposition()'s own trailing call — otherwise the very first
    // reposition() (right after this element is created, with no className yet) would measure an
    // unstyled box for its offsetWidth/offsetHeight and mis-position itself.
    this.syncClasses();
    // Keeps the editor's own selection (and focus) alive while a button is pressed — except a real
    // text/checkbox <input> (the link/color editors' own fields) or the heading-level <select>,
    // which need a real mousedown to focus/open (a <select>'s option list is a default action of
    // this same mousedown — preventDefault()'ing it here, even from this ancestor listener, silently
    // stopped the dropdown from ever opening for mouse users).
    this.el.addEventListener('mousedown', (e) => {
      if (!e.target.closest('input, label, select')) {
        e.preventDefault();
      }
    });
    this.el.addEventListener('click', (e) => this.onClick(e, view));
    this.el.addEventListener('change', (e) => this.onChange(e, view));
    this.el.addEventListener('input', (e) => this.onInput(e, view));
    this.el.addEventListener('keydown', (e) => this.onKeydown(e, view));

    // ProseMirror only calls update() from an actual transaction on this view — clicking outside
    // it entirely (the canvas, another block, a sidebar field) never dispatches one, so losing
    // focus is the only signal that the selection is no longer "in" this field. Skipped when focus
    // is moving into the toolbar itself (e.g. into the link editor's own <input>).
    this.onBlur = (e) => {
      if (!this.el.contains(e.relatedTarget)) {
        this.hide();
      }
    };
    view.dom.addEventListener('blur', this.onBlur);

    view._selectionToolbar = this;

    this.update(view, null);
  }

  onClick(e, view) {
    const tool = e.target.closest('[data-tool]');
    if (tool) {
      this.tools[+tool.dataset.tool].run(view);
      return;
    }

    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'link') {
      this.openLinkEditor();
    } else if (action === 'remove-link') {
      this.removeLink(view);
    } else if (action === 'cancel-link') {
      this.cancelLink(view);
    } else if (action === 'color') {
      this.openColorEditor('color');
    } else if (action === 'highlight') {
      this.openColorEditor('highlight');
    } else if (action === 'remove-color') {
      this.removeColorEditor(view);
    } else if (action === 'cancel-color') {
      this.cancelColorEditor(view);
    } else if (action === 'toggle-more') {
      this.moreOpen = !this.moreOpen;
      this.renderToolbar(view.state);
    }
  }

  onChange(e, view) {
    if (e.target.matches('[data-block-type]')) {
      this.applyBlockType(view, e.target.value);
      return;
    }
    // The URL field applies live via onInput() below; its own two checkboxes only fire "change"
    // (there's nothing to apply keystroke-by-keystroke), so they're handled here instead.
    if (e.target.matches('[data-link-newtab], [data-link-nofollow]')) {
      this.applyLink(view);
    }
  }

  onInput(e, view) {
    if (e.target.matches('[data-link-input]')) {
      this.applyLink(view);
    }
  }

  /**
   * Lifts the selection out of whichever wrap (a list, of either type, or a blockquote) it's
   * currently in — list_item and blockquote need different lift commands, so this picks the right
   * one instead of making every applyBlockType() branch below sort that out itself.
   *
   * @param {import('prosemirror-view').EditorView} view
   * @param {boolean} inList
   * @param {boolean} inBlockquote
   */
  liftOutOfWrap(view, inList, inBlockquote) {
    if (inList) {
      liftListItem(this.listItemType)(view.state, view.dispatch);
    } else if (inBlockquote) {
      lift(view.state, view.dispatch);
    }
  }

  /**
   * Applies the block-type <select>'s value — a heading level ("0" for Text/paragraph), a list type
   * ("bullet_list"/"ordered_list") or "blockquote". Lists and blockquote are a wrap around the
   * block, not just a node-type swap, so switching in or out of one, or between two wrap types,
   * takes an explicit lift/wrap step around the same setBlockType used for Text/Heading.
   *
   * @param {import('prosemirror-view').EditorView} view
   * @param {string} value
   */
  applyBlockType(view, value) {
    const inBulletList = this.bulletListType && blockActive(view.state, this.bulletListType);
    const inOrderedList = this.orderedListType && blockActive(view.state, this.orderedListType);
    const inList = !!(inBulletList || inOrderedList);
    const inBlockquote = !!(this.blockquoteType && blockActive(view.state, this.blockquoteType));

    if (value === 'bullet_list' || value === 'ordered_list') {
      const alreadyThisType = (value === 'bullet_list' && inBulletList) || (value === 'ordered_list' && inOrderedList);
      if (alreadyThisType) {
        view.focus();
        return;
      }

      // Changing wrap type (list ↔ list, or blockquote → list): lift out first, then wrap in the
      // new one — two steps (and two undo entries), since wrapInList doesn't itself convert an
      // existing wrap's type.
      if (inList || inBlockquote) {
        this.liftOutOfWrap(view, inList, inBlockquote);
      }
      const targetType = value === 'bullet_list' ? this.bulletListType : this.orderedListType;
      wrapInList(targetType)(view.state, view.dispatch);
    } else if (value === 'blockquote') {
      if (inBlockquote) {
        view.focus();
        return;
      }
      if (inList) {
        this.liftOutOfWrap(view, inList, inBlockquote);
      }
      wrapIn(this.blockquoteType)(view.state, view.dispatch);
    } else {
      if (inList || inBlockquote) {
        this.liftOutOfWrap(view, inList, inBlockquote);
      }

      const level = +value;
      if (level) {
        setBlockType(this.headingType, { level })(view.state, view.dispatch);
      } else {
        setBlockType(this.paragraphType)(view.state, view.dispatch);
      }
    }
    view.focus();
  }

  onKeydown(e, view) {
    // Both editors already apply live (onInput/onChange, or Filler's own onChange below) — Enter
    // just confirms and closes; Escape reverts to whatever was there before this editor opened.
    if (this.mode === 'link') {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.closeEditor(view);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelLink(view);
      }
    } else if (this.mode === 'color') {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.closeEditor(view);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.cancelColorEditor(view);
      }
    }
  }

  // Snaps back to the plain toolbar without touching the mark — used to confirm-and-close a
  // link/color editor whose value is already live-applied (Enter, or the Remove button).
  closeEditor(view) {
    this.mode = 'toolbar';
    this.renderToolbar(view.state);
    this.show(view);
    view.focus();
  }

  /**
   * Opens the link editor for the current selection — Mod-k's own target (textToolKeymap above)
   * as well as the toolbar's own link button.
   */
  openLinkEditor() {
    const view = this.view;
    if (!this.linkType || !view || view.state.selection.empty) {
      return;
    }

    const { from, to, $from } = view.state.selection;
    const linkMark = view.state.doc.rangeHasMark(from, to, this.linkType) ? this.linkType.isInSet($from.marks()) : null;

    this.mode = 'link';
    this.moreOpen = false;
    this.linkHref = linkMark?.attrs.href || '';
    this.linkNewTab = linkMark?.attrs.target === '_blank';
    this.linkNofollow = (linkMark?.attrs.rel || '').split(' ').includes('nofollow');
    this.linkHadMark = !!linkMark;
    // What to restore if the user hits Escape/Cancel after live-applying some edits.
    this.linkOriginal = linkMark ? { ...linkMark.attrs } : null;
    this.renderLink();
    this.show(view);
  }

  // Applies the URL field/checkboxes live — called from onInput() on every keystroke and onChange()
  // on every checkbox toggle, so it must NOT steal focus back to the document (no view.focus()) or
  // typing/toggling would be interrupted after a single character/click.
  applyLink(view) {
    const href = this.el.querySelector('[data-link-input]').value.trim();
    const newTab = this.el.querySelector('[data-link-newtab]').checked;
    const nofollow = this.el.querySelector('[data-link-nofollow]').checked;
    const { state, dispatch } = view;
    const { from, to } = state.selection;
    const { tr } = state;

    tr.removeMark(from, to, this.linkType);
    if (href) {
      // A new-tab link without "noopener" lets the opened page reach back via window.opener
      // (reverse tabnabbing) — always paired with the checkbox, not left to the user to remember.
      const rel = [newTab && 'noopener noreferrer', nofollow && 'nofollow'].filter(Boolean).join(' ');
      tr.addMark(from, to, this.linkType.create({ href, target: newTab ? '_blank' : null, rel: rel || null }));
    }
    dispatch(tr);
  }

  removeLink(view) {
    toggleMark(this.linkType)(view.state, view.dispatch);
    this.closeEditor(view);
  }

  // Escape/Cancel — undoes whatever the live-apply calls above already committed, back to the mark
  // (or lack of one) this editor opened with.
  cancelLink(view) {
    const { state, dispatch } = view;
    const { from, to } = state.selection;
    const { tr } = state;

    tr.removeMark(from, to, this.linkType);
    if (this.linkOriginal) {
      tr.addMark(from, to, this.linkType.create(this.linkOriginal));
    }
    dispatch(tr);
    this.closeEditor(view);
  }

  /**
   * Opens the color/highlight editor for the current selection — mirrors openLinkEditor(), just
   * parameterized over which mark is being edited.
   *
   * @param {'color'|'highlight'} target
   */
  openColorEditor(target) {
    const view = this.view;
    const markType = target === 'highlight' ? this.highlightType : this.colorType;
    if (!markType || !view || view.state.selection.empty) {
      return;
    }

    const { from, to, $from } = view.state.selection;
    const mark = view.state.doc.rangeHasMark(from, to, markType) ? markType.isInSet($from.marks()) : null;

    this.mode = 'color';
    this.moreOpen = false;
    this.colorTarget = target;
    this.colorValue = mark?.attrs.color || '#000000';
    this.colorHadMark = !!mark;
    // What to restore if the user hits Escape/Cancel after live-applying some edits.
    this.colorOriginal = mark ? { ...mark.attrs } : null;
    this.renderColorEditor();
    this.show(view);
  }

  // Applies the swatch's current value live — called from Filler's own onChange (renderColorEditor()
  // below), which fires continuously while dragging, so it must NOT steal focus back to the document
  // (no view.focus()) or the picker would lose interaction after the first pixel of movement.
  applyColorEditor(view) {
    const markType = this.colorTarget === 'highlight' ? this.highlightType : this.colorType;
    const { state, dispatch } = view;
    const { from, to } = state.selection;
    const { tr } = state;

    tr.removeMark(from, to, markType);
    tr.addMark(from, to, markType.create({ color: this.colorValue }));
    dispatch(tr);
  }

  removeColorEditor(view) {
    const markType = this.colorTarget === 'highlight' ? this.highlightType : this.colorType;
    toggleMark(markType)(view.state, view.dispatch);
    this.closeEditor(view);
  }

  // Escape/Cancel — undoes whatever the live-apply calls above already committed, back to the mark
  // (or lack of one) this editor opened with.
  cancelColorEditor(view) {
    const markType = this.colorTarget === 'highlight' ? this.highlightType : this.colorType;
    const { state, dispatch } = view;
    const { from, to } = state.selection;
    const { tr } = state;

    tr.removeMark(from, to, markType);
    if (this.colorOriginal) {
      tr.addMark(from, to, markType.create(this.colorOriginal));
    }
    dispatch(tr);
    this.closeEditor(view);
  }

  // Releases the color editor's Filler instance (dropdown/dialog panels live outside this.el, in
  // document.body, so leaving them mounted after this.el's own markup is replaced would leak).
  destroyFiller() {
    this.filler?.destroy();
    this.filler = null;
  }

  update(view, prevState) {
    this.view = view;
    const { state } = view;

    if (prevState && prevState.doc.eq(state.doc) && prevState.selection.eq(state.selection)) {
      return;
    }

    // The link/color editors apply live (as you type, toggle a checkbox, or drag the swatch) —
    // each of those dispatches changes the doc but keeps the selection exactly where it was. Don't
    // let that snap the toolbar back to its plain mode (and tear down the open editor / its Filler)
    // out from under the user; a real change elsewhere (a different selection) still does.
    if (this.mode !== 'toolbar' && prevState && prevState.selection.eq(state.selection)) {
      return;
    }

    if (state.selection.empty) {
      this.hide();
      return;
    }

    // A code_block's content forbids marks entirely (schemes/rich.js's "marks: ''"), so none of
    // this toolbar's buttons apply inside one — show nothing rather than a row of dead controls.
    if (this.codeBlockType && blockActive(state, this.codeBlockType)) {
      this.hide();
      return;
    }

    // Any real state change (not just the link/color input gaining DOM focus, which never touches
    // ProseMirror's own state) snaps back to the plain toolbar and closes the overflow menu — e.g.
    // after using one of its own tools, or after the selection changed elsewhere.
    this.mode = 'toolbar';
    this.moreOpen = false;
    this.renderToolbar(state);
    this.show(view);
  }

  renderToolbar(state) {
    this.destroyFiller();

    const listOptions = LIST_TYPES
      .filter(({ name }) => (name === 'bullet_list' ? this.bulletListType : this.orderedListType))
      .map(({ name, title }) => `<option value="${name}">${title}</option>`)
      .join('');
    const blockquoteOption = this.blockquoteType ? `<option value="blockquote">${BLOCKQUOTE_TYPE.title}</option>` : '';

    const blockTypeSelect = (this.headingType || listOptions || blockquoteOption) ? `
      <select class="v-tooltip-toolbar__select" data-block-type aria-label="Block type">
        <option value="0">Text</option>
        ${this.headingType ? HEADING_LEVELS.map((level) => `<option value="${level}">Heading ${level}</option>`).join('') : ''}
        ${listOptions}
        ${blockquoteOption}
      </select>
    ` : '';

    // Only Bold/Underline (tools.js's "primary" mark tools) get their own always-on button; the rest
    // of MARK_TOOLS, plus Text Color/Highlight, live in the "More formatting" overflow menu below.
    // Heading, list and blockquote are the block-type <select> above, not tool buttons at all.
    const primaryTools = [];
    const overflowTools = [];
    this.tools.forEach((tool, index) => (tool.overflow ? overflowTools : primaryTools).push({ ...tool, index }));

    const toolButton = ({ title, icon, index }) => (
      `<button type="button" class="v-tooltip-toolbar__btn" data-tool="${index}" aria-label="${title}"><i class="${icon}"></i></button>`
    );

    const menuItem = (title, icon, attrs) => (
      `<button type="button" class="v-tooltip-toolbar__menu-item" ${attrs}><i class="${icon}"></i><span>${title}</span></button>`
    );

    const moreItemsHtml = [
      ...overflowTools.map(({ title, icon, index }) => menuItem(title, icon, `data-tool="${index}"`)),
      this.colorType ? menuItem(COLOR_TOOL.title, COLOR_TOOL.icon, 'data-action="color"') : '',
      this.highlightType ? menuItem(HIGHLIGHT_TOOL.title, HIGHLIGHT_TOOL.icon, 'data-action="highlight"') : '',
    ].join('');

    const hasMore = overflowTools.length > 0 || this.colorType || this.highlightType;
    const moreButton = hasMore ? `
      <div class="v-tooltip-toolbar__more">
        <button type="button" class="v-tooltip-toolbar__btn" data-action="toggle-more" aria-label="More formatting" aria-expanded="${this.moreOpen}"><i class="ph ph-dots-three-vertical"></i></button>
        ${this.moreOpen ? `<div class="v-tooltip-toolbar__menu" role="menu">${moreItemsHtml}</div>` : ''}
      </div>
    ` : '';

    const linkButton = this.linkType ? (
      `<button type="button" class="v-tooltip-toolbar__btn" data-action="link" aria-label="${LINK_TOOL.title}"><i class="${LINK_TOOL.icon}"></i></button>`
    ) : '';

    this.el.innerHTML = blockTypeSelect + primaryTools.map(toolButton).join('') + linkButton + moreButton;

    // Same "data-tool" index whether a tool ended up as its own button or as a menu item — this
    // loop (and the null guard) covers both, and finds nothing for an overflow tool while the menu
    // is closed.
    this.tools.forEach((tool, index) => {
      const button = this.el.querySelector(`[data-tool="${index}"]`);
      if (!button) {
        return;
      }
      button.classList.toggle('is-active', !!tool.isActive?.(state));
      describeButton(button, tool.description, tool.shortcut);
    });

    if (this.headingType || listOptions || blockquoteOption) {
      const select = this.el.querySelector('[data-block-type]');
      if (this.bulletListType && blockActive(state, this.bulletListType)) {
        select.value = 'bullet_list';
      } else if (this.orderedListType && blockActive(state, this.orderedListType)) {
        select.value = 'ordered_list';
      } else if (this.blockquoteType && blockActive(state, this.blockquoteType)) {
        select.value = 'blockquote';
      } else {
        const { $from, to } = state.selection;
        select.value = this.headingType && to <= $from.end() && $from.parent.type === this.headingType ? $from.parent.attrs.level : 0;
      }
      // No hover hint here (unlike every other control) — it's a plain <select>, its own options
      // already say what each one does.
    }

    if (hasMore) {
      const moreButtonEl = this.el.querySelector('[data-action="toggle-more"]');
      const moreActive = overflowTools.some((tool) => tool.isActive?.(state))
        || (this.colorType && markActive(state, this.colorType))
        || (this.highlightType && markActive(state, this.highlightType));
      moreButtonEl.classList.toggle('is-active', !!moreActive);
      describeButton(moreButtonEl, 'More formatting');

      const colorItemEl = this.el.querySelector('[data-action="color"]');
      if (colorItemEl) {
        colorItemEl.classList.toggle('is-active', markActive(state, this.colorType));
        describeButton(colorItemEl, COLOR_TOOL.description);
      }
      const highlightItemEl = this.el.querySelector('[data-action="highlight"]');
      if (highlightItemEl) {
        highlightItemEl.classList.toggle('is-active', markActive(state, this.highlightType));
        describeButton(highlightItemEl, HIGHLIGHT_TOOL.description);
      }
    }

    if (this.linkType) {
      const linkButtonEl = this.el.querySelector('[data-action="link"]');
      linkButtonEl.classList.toggle('is-active', markActive(state, this.linkType));
      describeButton(linkButtonEl, LINK_TOOL.description, LINK_TOOL.shortcut);
    }
  }

  renderLink() {
    this.destroyFiller();

    this.el.innerHTML = `
      <input type="text" class="v-tooltip-toolbar__input" data-link-input placeholder="https://example.com" value="${escapeHtml(this.linkHref)}">
      <label class="v-tooltip-toolbar__checkbox"><input type="checkbox" data-link-newtab ${this.linkNewTab ? 'checked' : ''}> New tab</label>
      <label class="v-tooltip-toolbar__checkbox"><input type="checkbox" data-link-nofollow ${this.linkNofollow ? 'checked' : ''}> Nofollow</label>
      ${this.linkHadMark ? '<button type="button" class="v-tooltip-toolbar__btn" data-action="remove-link" aria-label="Remove link"><i class="ph ph-link-break"></i></button>' : ''}
      <button type="button" class="v-tooltip-toolbar__btn" data-action="cancel-link" aria-label="Cancel"><i class="ph ph-x"></i></button>
    `;

    if (this.linkHadMark) {
      describeButton(this.el.querySelector('[data-action="remove-link"]'), 'Remove this link');
    }
    describeButton(this.el.querySelector('[data-action="cancel-link"]'), 'Discard these changes');
    describeButton(this.el.querySelector('[data-link-newtab]').closest('label'), 'Open this link in a new browser tab (adds rel="noopener noreferrer")');
    describeButton(this.el.querySelector('[data-link-nofollow]').closest('label'), 'Add rel="nofollow", telling search engines not to follow this link');

    const input = this.el.querySelector('[data-link-input]');
    input.focus();
    input.select();
  }

  renderColorEditor() {
    this.destroyFiller();

    const title = this.colorTarget === 'highlight' ? HIGHLIGHT_TOOL.title : COLOR_TOOL.title;

    // No "v-tooltip-toolbar__input" class here — Filler (youla-filler.js) fully re-styles this
    // input itself (wraps it with a swatch + alpha field), so a competing class would just fight it.
    this.el.innerHTML = `
      <input type="text" data-color-input value="${escapeHtml(this.colorValue)}" aria-label="${title}">
      ${this.colorHadMark ? `<button type="button" class="v-tooltip-toolbar__btn" data-action="remove-color" aria-label="Remove ${title.toLowerCase()}"><i class="ph ph-x-circle"></i></button>` : ''}
      <button type="button" class="v-tooltip-toolbar__btn" data-action="cancel-color" aria-label="Cancel"><i class="ph ph-x"></i></button>
    `;

    if (this.colorHadMark) {
      describeButton(this.el.querySelector('[data-action="remove-color"]'), `Remove ${title.toLowerCase()}`);
    }
    describeButton(this.el.querySelector('[data-action="cancel-color"]'), 'Discard these changes');

    const input = this.el.querySelector('[data-color-input]');
    // v-filler's own backing class (youla-filler.js), reused directly since this input lives
    // outside Youla's v-data/directive tree — see the "reuse v-filler" convention this mirrors.
    this.filler = new Filler(input, {
      sources: ['solid'],
      // Applies on every pick/drag, not just a final "Apply" click — the update() guard above keeps
      // this editor (and this Filler instance) alive across each of those self-caused dispatches.
      onChange: (hex) => {
        this.colorValue = hex;
        this.applyColorEditor(this.view);
      },
    });
    input.focus();
    input.select();
  }

  show(view) {
    const wasVisible = this.visible;
    this.visible = true;
    clearTimeout(this.exitTimer);

    if (!wasVisible) {
      this.animationState = 'in';
      document.body.appendChild(this.el);
    }
    this.reposition(view);
  }

  reposition(view) {
    const { from, to } = view.state.selection;
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);

    // Bounding box of the selection's own coords — coordsAtPos() returns screen coordinates, and a
    // backwards or multi-line selection can put "end" above/left of "start".
    const anchorRect = {
      top: Math.min(start.top, end.top),
      bottom: Math.max(start.bottom, end.bottom),
      left: Math.min(start.left, end.left),
      right: Math.max(start.right, end.right),
    };
    anchorRect.width = anchorRect.right - anchorRect.left;
    anchorRect.height = anchorRect.bottom - anchorRect.top;

    const size = { width: this.el.offsetWidth, height: this.el.offsetHeight };
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const { top, left, placement } = computePosition(anchorRect, size, 'top', viewport);

    this.el.style.top = `${top}px`;
    this.el.style.left = `${left}px`;
    this.placement = placement;
    this.syncClasses();
  }

  syncClasses() {
    const classes = [TOOLTIP_CLASS, TOOLBAR_CLASS];
    if (this.animationState) {
      classes.push(`${TOOLTIP_CLASS}--${this.animationState}`);
    }
    if (this.placement) {
      classes.push(`${TOOLTIP_CLASS}--${this.placement}`);
    }
    this.el.className = classes.join(' ');
  }

  hide() {
    if (!this.visible) {
      return;
    }
    this.visible = false;
    this.mode = 'toolbar';
    this.moreOpen = false;
    this.destroyFiller();
    this.animationState = 'out';
    this.syncClasses();

    const done = () => {
      this.el.removeEventListener('animationend', done);
      clearTimeout(this.exitTimer);
      this.el.remove();
    };
    this.el.addEventListener('animationend', done, { once: true });
    this.exitTimer = setTimeout(done, EXIT_FALLBACK);
  }

  destroy() {
    clearTimeout(this.exitTimer);
    this.destroyFiller();
    this.view?.dom.removeEventListener('blur', this.onBlur);
    this.el.remove();
    delete this.view?._selectionToolbar;
  }
}

/**
 * A floating formatting toolbar for the current text selection — v-tooltip-styled, shown only
 * while the selection is non-empty. One of mountEditor()'s own plugins (youla-editrix.js).
 */
export function selectionToolbar() {
  return new Plugin({
    view: (editorView) => new SelectionToolbar(editorView),
  });
}
