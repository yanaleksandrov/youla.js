// Generic HTML5 drag-and-drop engine shared by every reorderable/droppable list.
// createSortableItem() reorders an item in its own list; createDragSource()/createDropTarget() drag a new item in from elsewhere; both drive handleDragover() below.
import { animateReorder } from './animate-reorder';

// List → { createItem, read, write }, registered by createDropTarget()'s "@load" so a dragover bubbling up from one of the list's own items can still materialize a foreign drag.
const dropTargets = new WeakMap();

// The foreign drag in flight, if any — { payload, placeholder }; module-scoped so any source/target pair works, like a native OS drag.
let foreignDrag = null;

// The native reorder in flight, if any — { source, list, placeholder }. "source" (the row that's
// actually being dragged) stays exactly where it started, dimmed via ".is-dragging", for the whole
// drag; only the placeholder moves. Module-scoped for the same reason as "foreignDrag".
let reorderDrag = null;

// A materialized foreign item's own array value, keyed by its element — it has no meaningful old index to map back to.
const foreignItemValues = new WeakMap();

/**
 * Lightweight, non-interactive stand-in for whatever isn't landing for real until the drop —
 * a still-uncommitted foreign item, or a reordered row staying put until then. Deliberately never
 * ".is-dragging", never "draggable", never framework-initialized: a *real*, repeatedly-repositioned
 * dragging element is what a native drag session would otherwise keep re-targeting itself once it's
 * under the cursor, breaking further dragover (or the eventual "drop") on some browsers.
 */
function createPlaceholder() {
  const el = document.createElement('div');
  el.className = 'editrix-drop-placeholder';
  return el;
}

/**
 * Finds the child a dragged item should land before, given a pointer position.
 *
 * @param {HTMLElement} list
 * @param {number} clientY
 * @param {HTMLElement[]} exclude - Children to leave out of consideration — the placeholder itself,
 *   plus, for a reorder, the source row it stands in for (still physically in "list").
 * @returns {HTMLElement|null} null means "at the end".
 */
function childBefore(list, clientY, exclude) {
  const rows = [...list.children].filter((row) => !exclude.includes(row) && !row.hasAttribute('v-each'));
  // "<=", not "<" — a pointer sitting exactly on a row's own midpoint goes before that row, not after it.
  return rows.find((row) => clientY <= row.getBoundingClientRect().top + row.offsetHeight / 2) || null;
}

/**
 * Moves "dragging" within "list" to track "clientY", animated; no-op if already there. This is the
 * legacy behavior (gallery/repeater/section-repeater's own reorder, and a still-unmaterialized
 * foreign item on its way to becoming real) — it *does* shift sibling rows out of the way, since
 * "dragging" is a genuine flow child. Canvas blocks use positionOverlay() instead — see its own
 * comment for why.
 *
 * @param {HTMLElement} list
 * @param {number} clientY
 * @param {HTMLElement} dragging
 */
function repositionInFlow(list, clientY, dragging) {
  const before = childBefore(list, clientY, [dragging]);

  if (dragging.isConnected && dragging.nextElementSibling === before) {
    return;
  }

  animateReorder(list, () => {
    list.insertBefore(dragging, before);
  }, dragging);
}

/**
 * Tracks the drop position with "placeholder" as a pure visual overlay — positioned via "top",
 * appended to "list" once and never moved through insertBefore() again — so sibling rows never
 * shift while the pointer merely hovers among them. The row (or item, once built) they're
 * previewing for only actually lands at "placeholder.__before"'s position once the drag commits
 * (commitForeignDrop()/commitReorderDrag()).
 *
 * @param {HTMLElement} list
 * @param {number} clientY
 * @param {HTMLElement} placeholder
 * @param {HTMLElement[]} [extraExclude] - Additional children childBefore() shouldn't consider — a
 *   reorder's own source row.
 */
function positionOverlay(list, clientY, placeholder, extraExclude = []) {
  const rows = [...list.children].filter((row) => row !== placeholder && !extraExclude.includes(row) && !row.hasAttribute('v-each'));
  const before = rows.find((row) => clientY <= row.getBoundingClientRect().top + row.offsetHeight / 2) || null;

  if (!placeholder.isConnected) {
    list.appendChild(placeholder);
  }
  placeholder.__before = before;

  const listRect = list.getBoundingClientRect();
  const boundaryTop = before ? before.getBoundingClientRect().top : (rows.at(-1)?.getBoundingClientRect().bottom ?? listRect.top);

  placeholder.style.top = `${boundaryTop - listRect.top}px`;
}

/**
 * The one dragover handler behind both createSortableItem() and createDropTarget() — tracks a
 * reorder's own placeholder within its source list, or, for a foreign drag, within whichever
 * registered list currently accepts it.
 *
 * @param {Object} component
 * @param {HTMLElement} list
 * @param {number} clientY
 * @returns {string|false} The "dropEffect" to show for this dragover once "list" actually did
 *   something with it — "move" for a reorder (it's relocating the SAME item), "copy" for a foreign
 *   drag (the palette item stays put; a new instance lands here) — or false when there's nothing
 *   here for it (e.g. a reorder hovering a list other than its own source, or a foreign payload this
 *   list's createItem() rejects). Callers use this both to decide whether to preventDefault() —
 *   skipping it for "false" is what lets the browser show its native "not allowed" cursor instead of
 *   falsely promising a drop — and to set "dataTransfer.dropEffect" so the cursor's own icon (move
 *   vs. copy) actually matches which of the two is happening, instead of always showing "move".
 */
function handleDragover(component, list, clientY) {
  if (reorderDrag) {
    // A reorder only ever targets the list its own source row lives in — no cross-list reordering.
    if (list !== reorderDrag.list) {
      return false;
    }

    if (reorderDrag.usePlaceholder) {
      reorderDrag.placeholder ??= createPlaceholder();
      positionOverlay(list, clientY, reorderDrag.placeholder, [reorderDrag.source]);
    } else {
      // Legacy behavior (gallery/repeater/section-repeater): the source row itself is what tracks
      // the pointer — see createSortableItem()'s own "placeholder" option.
      repositionInFlow(list, clientY, reorderDrag.source);
    }
    return 'move';
  }

  if (!foreignDrag) {
    return false;
  }

  const dropTarget = dropTargets.get(list);
  if (!dropTarget) {
    return false;
  }

  // Already tracking this exact list — just follow the pointer.
  if (foreignDrag.placeholder?.parentElement === list) {
    positionOverlay(list, clientY, foreignDrag.placeholder);
    return 'copy';
  }

  // Entering a list its placeholder isn't in yet (including the very first tick of the drag) —
  // only take it over if this list would actually accept the payload. The built candidate itself
  // is discarded; handleDrop() builds a fresh one for real once there's an actual drop to commit.
  if (!dropTarget.createItem(component, foreignDrag.payload)) {
    return false;
  }

  foreignDrag.placeholder?.remove();
  foreignDrag.placeholder = createPlaceholder();
  positionOverlay(list, clientY, foreignDrag.placeholder);
  return 'copy';
}

/**
 * Commits a foreign drag: writes the list's final DOM order back, resolving the newly-built item
 * via foreignItemValues instead of a stale index.
 *
 * "list" can already be gone by the time this runs: "@drop" firing first (the common case) may
 * write a reactive array whose list is v-each-rendered (e.g. the gallery's own "thumbnails"), and
 * v-each rebuilds its rows from scratch on every change — detaching the very row "@dragend" is
 * about to fire on next. Bailing out here is safe since "@drop" already committed the order.
 */
function commitOrder(component, list, read, write) {
  if (!list) {
    return;
  }

  // Filter out v-each's own hidden template element — it has no loop variable in scope, so its ":data-index" would resolve to a stray "undefined".
  const rows = [...list.children].filter((row) => !row.hasAttribute('v-each'));
  const items = read(component);

  write(component, rows.map((row) => (foreignItemValues.has(row) ? foreignItemValues.get(row) : items[+row.dataset.index])));

  rows.forEach((row, index) => {
    row.dataset.index = index;
  });
}

/**
 * Builds the real item in the foreign-drag placeholder's place and commits it — shared by
 * handleDrop() (the common path) and createDragSource()'s own "@dragend" (a fallback: Chromium can
 * skip "drop" and go straight to "dragleave"/"dragend" when the pointer's final position, right at
 * release, no longer matches whatever the *last* accepted "dragover" was — e.g. because the row the
 * placeholder just landed next to shifted out from under a stationary pointer).
 *
 * @param {Object} component
 * @param {HTMLElement} list - The list currently holding "foreignDrag"'s placeholder.
 * @returns {boolean} True once committed (or explicitly rejected and cleaned up) — false if there
 *   was nothing to do (e.g. this list was never actually registered).
 */
function commitForeignDrop(component, list) {
  const dropTarget = dropTargets.get(list);
  const placeholder = foreignDrag?.placeholder;

  if (!dropTarget || placeholder?.parentElement !== list) {
    return false;
  }

  const { createItem, read, write } = dropTarget;
  const before = placeholder.__before;
  const built = createItem(component, foreignDrag.payload);
  foreignDrag = null;
  placeholder.remove();

  if (!built) {
    return true;
  }

  // One or several, in order — a pattern (createItem() building more than one at once) lands as
  // that many consecutive real items, all before the same anchor: each insertBefore(x, before)
  // lands x immediately ahead of "before", so repeating it keeps every earlier one exactly where
  // it landed, ahead of this one.
  built.forEach(({ element, value }) => {
    list.insertBefore(element, before);
    foreignItemValues.set(element, value);
    component.$root.__x.initialize(element);
  });

  commitOrder(component, list, read, write);
  return true;
}

/**
 * Commits a native reorder: moves the source row from wherever it started into its placeholder's
 * spot (a no-op if the drag never actually left it there), then writes the list's final DOM order
 * back — shared by handleDrop() and createSortableItem()'s own "@dragend" fallback, for the same
 * reason commitForeignDrop() needs one (see its own comment).
 *
 * @param {Object} component
 * @param {Function} read - (component) => current array.
 * @param {Function} write - (component, nextArray) => void.
 */
function commitReorderDrag(component, read, write) {
  const { source, list, placeholder } = reorderDrag;
  reorderDrag = null;

  if (placeholder) {
    list.insertBefore(source, placeholder.__before);
    placeholder.remove();
  }
  source.classList.remove('is-dragging');

  const rows = [...list.children].filter((row) => !row.hasAttribute('v-each'));
  const items = read(component);

  write(component, rows.map((row) => items[+row.dataset.index]));

  rows.forEach((row, index) => {
    row.dataset.index = index;
  });
}

/**
 * Shared "drop" handler — the event can land on any element under the pointer (a sibling row, the
 * placeholder itself, or the list's own background), so both factories below call this to commit
 * once per list.
 */
function handleDrop(component, list, read, write) {
  if (commitForeignDrop(component, list)) {
    return;
  }

  if (reorderDrag?.list === list) {
    commitReorderDrag(component, read, write);
  }
}

/**
 * Builds the v-bind directive object for one reorderable row — draggable, dragover-tracking
 * (animated via animateReorder()), and dragend-commit, parameterized by how to read/write the row's array.
 *
 * @param {Object} options
 * @param {Function} options.read - (component) => current array.
 * @param {Function} options.write - (component, nextArray) => void.
 * @param {string} [options.handle] - A CSS selector scoping drag-initiation to one part of the row
 *   (e.g. a grip icon), so the rest — an <input>, a label's own text — keeps normal browser
 *   behavior (text selection, caret placement) instead of every mousedown starting a row drag.
 *   Toggles the "draggable" IDL property on "@mousedown", since — unlike the attribute set once by
 *   ":draggable" below — a *descendant*'s own "draggable=false" does NOT stop the browser from
 *   still finding this row (the nearest draggable=true ancestor) and dragging it instead; only
 *   flipping the row's own property before the gesture starts actually prevents that. Mutually
 *   exclusive with "exclude" below — a row only ever needs one or the other.
 * @param {string} [options.exclude] - The inverse of "handle": a CSS selector for descendants that
 *   should keep their own normal browser behavior, with everything else still starting a drag (a
 *   canvas block's own "[data-editable]" text, say) — same IDL-property toggle, just negated.
 * @param {boolean} [options.placeholder] - Track the drop position with a separate placeholder
 *   instead of live-moving the row itself (canvas blocks only, for now) — see handleDragover()'s
 *   own reorder branch. Off by default: gallery/repeater/section-repeater rows keep moving live.
 * @returns {Object} Directive object to spread into a row's own v-bind().
 */
export function createSortableItem({
  read, write, handle, exclude, placeholder: usePlaceholder = false,
}) {
  return {
    ':draggable': 'true',
    ...((handle || exclude) && {
      '@mousedown'(e) {
        this.$el.draggable = handle ? !!e.target.closest(handle) : !e.target.closest(exclude);
      },
    }),
    '@dragstart'(e) {
      this.$el.classList.add('is-dragging');
      reorderDrag = {
        source: this.$el, list: this.$el.parentElement, placeholder: null, usePlaceholder,
      };
      // Pin the cursor explicitly — left unset, the browser's own drag cursor can flicker between the drag icon and "not-allowed" on every dragover tick.
      e.dataTransfer.effectAllowed = 'move';
    },
    '@dragover.stop'(e) {
      const effect = handleDragover(this, this.$el.parentElement, e.clientY);
      if (effect) {
        e.preventDefault();
        e.dataTransfer.dropEffect = effect;
      }
    },
    '@drop.prevent.stop'() {
      handleDrop(this, this.$el.parentElement, read, write);
    },
    '@dragend'() {
      if (reorderDrag?.source === this.$el) {
        commitReorderDrag(this, read, write);
      }
    },
  };
}

/**
 * v-bind for a *source* of new items — a sidebar palette entry, say. Dragging it starts a "foreign"
 * session any createDropTarget() elsewhere in the app can pick up; pair the two by agreeing on what
 * "payload" means and what createDropTarget()'s own createItem() does with it.
 *
 * @param {*} payload - Whatever a matching createDropTarget()'s createItem() needs to build one or
 *   more items from — e.g. a block type string, or an array of them for a pattern.
 * @returns {Object} Directive object to spread into the source element's own v-bind().
 */
export function createDragSource(payload) {
  return {
    ':draggable': 'true',
    '@dragstart'(e) {
      foreignDrag = { payload, placeholder: null };
      e.dataTransfer.effectAllowed = 'copy';
      // Firefox refuses to start a drag without data set on it — the payload itself travels via "foreignDrag", not dataTransfer.
      e.dataTransfer.setData('text/plain', '');
    },
    '@dragend'() {
      if (foreignDrag?.placeholder && !commitForeignDrop(this, foreignDrag.placeholder.parentElement)) {
        foreignDrag.placeholder.remove();
      }
      foreignDrag = null;
    },
  };
}

/**
 * v-bind for a list that accepts new items dragged in from a createDragSource() elsewhere — a
 * placeholder tracks the drop position from the moment its drag first reaches this list (see
 * handleDragover()'s own createPlaceholder()), and the real item is only ever built, in its place,
 * once there's an actual drop to commit (handleDrop()).
 *
 * @param {Object} options
 * @param {Function} options.read - (component) => current array.
 * @param {Function} options.write - (component, nextArray) => void.
 * @param {Function} options.createItem - (component, payload) => [{ element, value }, ...] to accept
 *   the drop (one entry lands one item; several land that many, together, in order — a pattern), or
 *   a falsy value to reject it.
 * @returns {Object} Directive object to spread into the list's own v-bind().
 */
export function createDropTarget({ read, write, createItem }) {
  return {
    '@load'() {
      dropTargets.set(this.$el, { createItem, read, write });
    },
    '@dragover'(e) {
      const effect = handleDragover(this, this.$el, e.clientY);
      if (effect) {
        e.preventDefault();
        e.dataTransfer.dropEffect = effect;
      }
    },
    /**
     * "relatedTarget" is only trusted when it names a real element outside this list — genuinely
     * leaving to somewhere else (the sidebar, say) — and cleans up synchronously right then; there's
     * no race to protect against there. A null "relatedTarget" is deliberately IGNORED here instead
     * of deferring a cleanup for it (an earlier version did, via setTimeout): it fires ambiguously —
     * most confusingly, right as the drag itself ends (drop or cancel) — and racing that cleanup
     * against createDragSource()'s own "@dragend" fallback (which also runs "soon" after) meant
     * whichever happened to win nulled out "foreignDrag" first. When the deferred cleanup won, the
     * fallback found nothing left to commit and the drop silently did nothing. "@dragend" is the
     * sole, reliable authority for how a drag actually concluded — nothing needs to race it here.
     */
    '@dragleave'(e) {
      if (!e.relatedTarget || this.$el.contains(e.relatedTarget)) {
        return;
      }

      if (foreignDrag?.placeholder?.parentElement === this.$el) {
        foreignDrag.placeholder.remove();
        foreignDrag.placeholder = null;
      }
    },
    '@drop.prevent'() {
      handleDrop(this, this.$el, read, write);
    },
  };
}
