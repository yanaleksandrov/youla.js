import { Plugin } from 'prosemirror-state';
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';

import { MARK_TOOLS, NODE_TOOLS, LINK_TOOL, HEADING_LEVELS } from './tools';
import { TOOLTIP_CLASS, EXIT_FALLBACK, computePosition, TooltipInstance } from '../../youla-tooltip';

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
  el._x_tooltip = new TooltipInstance(el, content, 'top', 'hover');
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
 * This schema's own MARK_TOOLS/NODE_TOOLS (tools.js), trimmed to whichever marks and nodes the
 * schema actually defines — a "plain" scheme naturally loses every block tool.
 *
 * @param {import('prosemirror-model').Schema} schema
 * @returns {Array<{title: string, description: string, icon: string, shortcut: string, isActive: Function, run: Function}>}
 */
export function buildTools(schema) {
  const tools = [];

  MARK_TOOLS.forEach(({ name, title, description, icon, shortcut }) => {
    const markType = schema.marks[name];
    if (!markType) {
      return;
    }

    tools.push({
      title,
      description,
      icon,
      shortcut,
      isActive: (state) => markActive(state, markType),
      run: (view) => {
        toggleMark(markType)(view.state, view.dispatch);
        view.focus();
      },
    });
  });

  NODE_TOOLS.forEach(({ name, title, description, icon, wrap, insert, shortcut }) => {
    const nodeType = schema.nodes[name];
    if (!nodeType) {
      return;
    }

    tools.push({
      title,
      description,
      icon,
      shortcut,
      isActive: (state) => !insert && blockActive(state, nodeType),
      run: (view) => {
        const { state, dispatch } = view;

        if (insert) {
          dispatch(state.tr.replaceSelectionWith(nodeType.create()).scrollIntoView());
        } else if (wrap) {
          wrapIn(nodeType)(state, dispatch);
        }
        view.focus();
      },
    });
  });

  tools.push(
    { title: 'Undo', description: 'Undo the last change', icon: 'ph ph-arrow-counter-clockwise', shortcut: 'Mod-z', run: (view) => undo(view.state, view.dispatch) },
    { title: 'Redo', description: 'Redo the last undone change', icon: 'ph ph-arrow-clockwise', shortcut: 'Mod-y', run: (view) => redo(view.state, view.dispatch) },
  );

  return tools;
}

/**
 * Real keyboard shortcuts for a schema's own tools, plus Mod-k for the link editor (routed through
 * whichever SelectionToolbar is currently mounted on the view — see selectionToolbar() below).
 *
 * @param {import('prosemirror-model').Schema} schema
 * @returns {Object} A prosemirror-keymap bindings object.
 */
export function textToolKeymap(schema) {
  const bindings = {};

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

  return bindings;
}

// The floating toolbar itself — styled and positioned exactly like a v-tooltip (youla-tooltip.js's
// own TOOLTIP_CLASS/computePosition/EXIT_FALLBACK), just driven by the current selection instead of
// a hover/click/focus trigger. Two render modes share the one box: "toolbar" (formatting buttons)
// and "link" (a small URL editor), swapped in place rather than as separate popovers.
class SelectionToolbar {
  constructor(view) {
    const { schema } = view.state;

    this.tools = buildTools(schema);
    this.headingType = schema.nodes.heading;
    this.paragraphType = schema.nodes.paragraph;
    this.linkType = schema.marks.link;

    this.mode = 'toolbar';
    this.visible = false;
    this.animationState = null;
    this.placement = null;

    this.el = document.createElement('div');
    this.el.setAttribute('role', 'toolbar');
    this.el.setAttribute('aria-label', 'Text formatting');
    // Applied up front, not just from reposition()'s own trailing call — otherwise the very first
    // reposition() (right after this element is created, with no className yet) would measure an
    // unstyled box for its offsetWidth/offsetHeight and mis-position itself.
    this.syncClasses();
    // Keeps the editor's own selection (and focus) alive while a button is pressed — except the
    // link editor's own <input>, which needs real focus to be typed into.
    this.el.addEventListener('mousedown', (e) => {
      if (e.target.tagName !== 'INPUT') {
        e.preventDefault();
      }
    });
    this.el.addEventListener('click', (e) => this.onClick(e, view));
    this.el.addEventListener('change', (e) => this.onChange(e, view));
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
    } else if (action === 'apply-link') {
      this.applyLink(view);
    } else if (action === 'remove-link') {
      this.removeLink(view);
    } else if (action === 'cancel-link') {
      this.cancelLink(view);
    }
  }

  onChange(e, view) {
    if (!e.target.matches('[data-heading-level]')) {
      return;
    }

    const level = +e.target.value;
    const { state, dispatch } = view;

    if (level) {
      setBlockType(this.headingType, { level })(state, dispatch);
    } else {
      setBlockType(this.paragraphType)(state, dispatch);
    }
    view.focus();
  }

  onKeydown(e, view) {
    if (this.mode !== 'link') {
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      this.applyLink(view);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.cancelLink(view);
    }
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
    this.linkHref = linkMark?.attrs.href || '';
    this.linkHadMark = !!linkMark;
    this.renderLink();
    this.show(view);
  }

  applyLink(view) {
    const href = this.el.querySelector('[data-link-input]').value.trim();
    const { state, dispatch } = view;
    const { from, to } = state.selection;
    const { tr } = state;

    tr.removeMark(from, to, this.linkType);
    if (href) {
      tr.addMark(from, to, this.linkType.create({ href }));
    }
    dispatch(tr);
    view.focus();
  }

  removeLink(view) {
    toggleMark(this.linkType)(view.state, view.dispatch);
    view.focus();
  }

  cancelLink(view) {
    this.mode = 'toolbar';
    this.renderToolbar(view.state);
    this.show(view);
    view.focus();
  }

  update(view, prevState) {
    this.view = view;
    const { state } = view;

    if (prevState && prevState.doc.eq(state.doc) && prevState.selection.eq(state.selection)) {
      return;
    }

    if (state.selection.empty) {
      this.hide();
      return;
    }

    // Any real state change (not just the link input gaining DOM focus, which never touches
    // ProseMirror's own state) snaps back to the plain toolbar.
    this.mode = 'toolbar';
    this.renderToolbar(state);
    this.show(view);
  }

  renderToolbar(state) {
    const headingSelect = this.headingType ? `
      <select class="v-tooltip-toolbar__select" data-heading-level aria-label="Paragraph style">
        <option value="0">Paragraph</option>
        ${HEADING_LEVELS.map((level) => `<option value="${level}">Heading ${level}</option>`).join('')}
      </select>
    ` : '';

    const linkButton = this.linkType ? (
      `<button type="button" class="v-tooltip-toolbar__btn" data-action="link" aria-label="${LINK_TOOL.title}"><i class="${LINK_TOOL.icon}"></i></button>`
    ) : '';

    this.el.innerHTML = headingSelect + this.tools.map(({ title, icon }, index) => (
      `<button type="button" class="v-tooltip-toolbar__btn" data-tool="${index}" aria-label="${title}"><i class="${icon}"></i></button>`
    )).join('') + linkButton;

    this.tools.forEach((tool, index) => {
      const button = this.el.querySelector(`[data-tool="${index}"]`);
      button.classList.toggle('is-active', !!tool.isActive?.(state));
      describeButton(button, tool.description, tool.shortcut);
    });

    if (this.headingType) {
      const { $from, to } = state.selection;
      const level = to <= $from.end() && $from.parent.type === this.headingType ? $from.parent.attrs.level : 0;
      const select = this.el.querySelector('[data-heading-level]');
      select.value = level;
      describeButton(select, 'Choose a heading level, or Paragraph for body text');
    }

    if (this.linkType) {
      const linkButtonEl = this.el.querySelector('[data-action="link"]');
      linkButtonEl.classList.toggle('is-active', markActive(state, this.linkType));
      describeButton(linkButtonEl, LINK_TOOL.description, LINK_TOOL.shortcut);
    }
  }

  renderLink() {
    this.el.innerHTML = `
      <input type="text" class="v-tooltip-toolbar__input" data-link-input placeholder="https://example.com" value="${escapeHtml(this.linkHref)}">
      <button type="button" class="v-tooltip-toolbar__btn" data-action="apply-link" aria-label="Apply"><i class="ph ph-check"></i></button>
      ${this.linkHadMark ? '<button type="button" class="v-tooltip-toolbar__btn" data-action="remove-link" aria-label="Remove link"><i class="ph ph-link-break"></i></button>' : ''}
      <button type="button" class="v-tooltip-toolbar__btn" data-action="cancel-link" aria-label="Cancel"><i class="ph ph-x"></i></button>
    `;

    describeButton(this.el.querySelector('[data-action="apply-link"]'), 'Apply this link');
    if (this.linkHadMark) {
      describeButton(this.el.querySelector('[data-action="remove-link"]'), 'Remove this link');
    }
    describeButton(this.el.querySelector('[data-action="cancel-link"]'), 'Cancel');

    const input = this.el.querySelector('[data-link-input]');
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
