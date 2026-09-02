/**
 * Generic HTML5 drag-and-drop engine for a list of sibling elements — shared app-wide by every
 * reorderable/droppable list (repeater rows, repeatable-section items, generic thumbnail lists,
 * the block canvas, and whatever comes next):
 *
 *   - createSortableItem() — v-bind for one item, reordering it live within its own list.
 *   - createDragSource() / createDropTarget() — a pair for dragging a *new* item in from outside
 *     the list entirely (a sidebar palette, say) into one that accepts them.
 *
 * Both pieces share one mechanism (handleDragover() below): a dragged element gets ".is-dragging";
 * every dragover within the list — whether it lands on the list itself or bubbles up from one of
 * its items — recomputes and applies its correct position live (animated via animateReorder()), so
 * dropping between two existing items works the same as dropping at the very end. The final DOM
 * order is read back into the backing array once the drag ends.
 *
 * A foreign item (createDropTarget()'s own) materializes into the DOM the moment its drag first
 * reaches a registered list, wherever within it — a list only gets registered (dropTargets, below)
 * once, up front (on "@load"), specifically so a dragover that bubbles up from one of the list's own
 * *items* (createSortableItem() — most of the list's own area, once it has any items in it) can
 * still trigger materialization; waiting for a dragover to land on the empty list itself would miss
 * most real drops.
 */

import { animateReorder } from './animate-reorder';

// Registered drop targets, keyed by list element — { createItem }. Populated by createDropTarget()'s
// own "@load" (fires synchronously as soon as its list mounts, well before any drag), so
// handleDragover() can materialize a foreign item into a list even when the triggering dragover
// bubbled up from one of that list's *items* rather than landing on the list itself.
const dropTargets = new WeakMap();

// The foreign drag currently in flight, if any — { payload, element }. Module-scoped (not per-list)
// so any createDragSource() pairs with any createDropTarget() elsewhere in the app, the same way a
// native OS drag works across unrelated windows. "element" is set once some list materializes the
// dragged payload; createDragSource()'s own "@dragend" uses it to clean up a materialized-but-
// never-dropped item (dragged back out, or released somewhere with no matching drop target).
let foreignDrag = null;

// A materialized item's own array value, keyed by its DOM element — read back on drop instead of
// index-mapping into the old array, since a freshly inserted item has no meaningful old index.
const foreignItemValues = new WeakMap();

/**
 * Finds the child a dragging/materializing item should land before, given a pointer position — the
 * list-level equivalent of "am I above or below this one row".
 *
 * @param {HTMLElement} list
 * @param {number} clientY
 * @param {HTMLElement} [exclude] - The dragging item itself, so it doesn't get measured against its own current slot.
 * @returns {HTMLElement|null} null means "at the end".
 */
function childBefore(list, clientY, exclude) {
  const rows = [...list.children].filter((row) => row !== exclude && !row.hasAttribute('v-each'));
  // "<=", not "<" — a pointer sitting exactly on a row's own midpoint goes before that row, not after it.
  return rows.find((row) => clientY <= row.getBoundingClientRect().top + row.offsetHeight / 2) || null;
}

// Repositions an already-dragging element within "list" to match "clientY", animated — a no-op if it's already there. Shared by every dragover, regardless of whether it landed on the list itself or one of its items.
function reposition(list, clientY, dragging) {
  const before = childBefore(list, clientY, dragging);

  if (dragging.nextElementSibling === before) {
    return;
  }

  animateReorder(list, () => {
    list.insertBefore(dragging, before);
  }, dragging);
}

/**
 * The one dragover handler behind both createSortableItem() and createDropTarget() — repositions
 * whatever's already dragging in "list", or, for a still-unmaterialized foreign drag over a
 * registered list, builds and inserts it there first.
 *
 * @param {Object} component
 * @param {HTMLElement} list
 * @param {number} clientY
 */
function handleDragover(component, list, clientY) {
  const dragging = list.querySelector('.is-dragging');

  if (dragging) {
    reposition(list, clientY, dragging);
    return;
  }

  // Nothing dragging in this list yet — either it's a native reorder whose own item will handle it directly, or a foreign drag not yet materialized anywhere (a previous list already claimed it otherwise).
  if (!foreignDrag || foreignDrag.element) {
    return;
  }

  const dropTarget = dropTargets.get(list);
  if (!dropTarget) {
    return;
  }

  const built = dropTarget.createItem(component, foreignDrag.payload);
  if (!built) {
    return;
  }

  const { element, value } = built;
  element.classList.add('is-dragging');
  foreignItemValues.set(element, value);
  foreignDrag.element = element;

  animateReorder(list, () => {
    list.insertBefore(element, childBefore(list, clientY, element));
  }, element);

  component.$root.__x.initialize(element);
}

// Shared by createSortableItem()'s "@dragend" and createDropTarget()'s "@drop" — strips ".is-dragging"
// and reads the list's final DOM order back into its backing array. A row materialized by
// createDropTarget() (no meaningful old index of its own) resolves through foreignItemValues instead
// of "items[index]" — found and cleared here, before the class that marks it is gone.
function commitOrder(component, list, read, write) {
  const dragging = list.querySelector('.is-dragging');
  dragging?.classList.remove('is-dragging');

  // Filter out v-each's own hidden template element — it has no loop variable in scope, so its ":data-index" would resolve to a stray "undefined".
  const rows = [...list.children].filter((row) => !row.hasAttribute('v-each'));
  const items = read(component);

  write(component, rows.map((row) => (foreignItemValues.has(row) ? foreignItemValues.get(row) : items[+row.dataset.index])));

  if (dragging) {
    foreignItemValues.delete(dragging);
  }
  rows.forEach((row, index) => {
    row.dataset.index = index;
  });
}

// The one "drop" handler behind both createSortableItem() and createDropTarget() — a real "drop"
// can land on *any* element currently under the pointer, which, once a dragging/materialized item
// has been repositioned there by handleDragover(), is very often that item itself (dropping between
// two existing items, say) rather than the list's own background. Committing only needs to happen
// once per list regardless of which element the event actually landed on, so both call this.
function handleDrop(component, list, read, write) {
  if (!list.querySelector('.is-dragging')) {
    return;
  }

  foreignDrag = null;
  commitOrder(component, list, read, write);
}

/**
 * Builds the v-bind directive object for one reorderable row — draggable, dragover-swap (animated
 * via animateReorder()), and dragend-commit, parameterized by how to read/write the row's array.
 *
 * @param {Object} options
 * @param {Function} options.read - (component) => current array.
 * @param {Function} options.write - (component, nextArray) => void.
 * @returns {Object} Directive object to spread into a row's own v-bind().
 */
export function createSortableItem({ read, write }) {
  return {
    ':draggable': 'true',
    '@dragstart'(e) {
      this.$el.classList.add('is-dragging');
      // Pin the cursor explicitly — left unset, the browser's own drag cursor can flicker between the drag icon and "not-allowed" on every dragover tick.
      e.dataTransfer.effectAllowed = 'move';
    },
    // ".stop" keeps this from also reaching an ancestor createDropTarget()'s own "@dragover" — handleDragover() above already does everything needed for this list from here, whether that means repositioning or (for a still-unmaterialized foreign drag) materializing.
    '@dragover.prevent.stop'(e) {
      e.dataTransfer.dropEffect = 'move';
      handleDragover(this, this.$el.parentElement, e.clientY);
    },
    // Real "drop" events land wherever the pointer actually is — very often this very item, once handleDragover() has repositioned it (or a materialized foreign item) to sit under the pointer. ".stop" for the same reason as "@dragover" above; commits here too (not just "@dragend" below) so a foreign item — whose "@dragend" never fires on it, only on its own createDragSource() origin — still gets committed when its drop lands on itself.
    '@drop.prevent.stop'() {
      handleDrop(this, this.$el.parentElement, read, write);
    },
    '@dragend'() {
      commitOrder(this, this.$el.parentElement, read, write);
    },
  };
}

/**
 * v-bind for a *source* of new items — a sidebar palette entry, say. Dragging it starts a "foreign"
 * session any createDropTarget() elsewhere in the app can pick up; pair the two by agreeing on what
 * "payload" means and what createDropTarget()'s own createItem() does with it.
 *
 * @param {*} payload - Whatever a matching createDropTarget()'s createItem() needs to build one — e.g. a block type string.
 * @returns {Object} Directive object to spread into the source element's own v-bind().
 */
export function createDragSource(payload) {
  return {
    ':draggable': 'true',
    '@dragstart'(e) {
      foreignDrag = { payload, element: null };
      e.dataTransfer.effectAllowed = 'copy';
      // Firefox refuses to start a drag at all without data set on it — the payload itself travels via "foreignDrag", not dataTransfer.
      e.dataTransfer.setData('text/plain', '');
    },
    '@dragend'() {
      // Materialized by some list but never actually dropped (dragged back out, or the gesture was cancelled) — a successful drop already cleared "foreignDrag" itself, so this only fires for the leftover case.
      if (foreignDrag?.element) {
        foreignItemValues.delete(foreignDrag.element);
        foreignDrag.element.remove();
      }
      foreignDrag = null;
    },
  };
}

/**
 * v-bind for a list that accepts new items dragged in from a createDragSource() elsewhere — the
 * item materializes into the DOM (and is initialized — v-bind attributes and all) the moment its
 * drag first reaches this list, then rides the exact same live positioning as any of the list's own
 * items (handleDragover() above) — dropping between two existing items works the same as at the end.
 *
 * @param {Object} options
 * @param {Function} options.read - (component) => current array.
 * @param {Function} options.write - (component, nextArray) => void.
 * @param {Function} options.createItem - (component, payload) => { element, value } to accept the drop, or a falsy value to reject it.
 * @returns {Object} Directive object to spread into the list's own v-bind().
 */
export function createDropTarget({ read, write, createItem }) {
  return {
    // Registers this list as a valid materialization target up front — a dragover that bubbles up from one of the list's own items (createSortableItem(), most of its area once it holds anything) needs to find this registration too, not just a dragover landing on empty list space.
    '@load'() {
      dropTargets.set(this.$el, { createItem });
    },
    '@dragover.prevent'(e) {
      handleDragover(this, this.$el, e.clientY);
    },
    // Only once the pointer truly leaves this list (not just moves onto one of its own children, which also fires "dragleave") — drop the materialized item so it doesn't linger if the drag heads elsewhere without landing here.
    '@dragleave'(e) {
      if (this.$el.contains(e.relatedTarget)) {
        return;
      }

      const dragging = this.$el.querySelector('.is-dragging');
      if (dragging) {
        foreignItemValues.delete(dragging);
        dragging.remove();
      }
      if (foreignDrag) {
        foreignDrag.element = null;
      }
    },
    '@drop.prevent'() {
      handleDrop(this, this.$el, read, write);
    },
  };
}
