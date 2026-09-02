// Generic HTML5 drag-and-drop engine shared by every reorderable/droppable list.
// createSortableItem() reorders an item in its own list; createDragSource()/createDropTarget() drag a new item in from elsewhere; both drive handleDragover() below.
import { animateReorder } from './animate-reorder';

// List → { createItem }, registered by createDropTarget()'s "@load" so a dragover bubbling up from one of the list's own items can still materialize a foreign drag.
const dropTargets = new WeakMap();

// The foreign drag in flight, if any — { payload, element }; module-scoped so any source/target pair works, like a native OS drag.
let foreignDrag = null;

// A materialized item's own array value, keyed by its element — it has no meaningful old index to map back to.
const foreignItemValues = new WeakMap();

/**
 * Finds the child a dragging item should land before, given a pointer position.
 *
 * @param {HTMLElement} list
 * @param {number} clientY
 * @param {HTMLElement} [exclude] - The dragging item itself.
 * @returns {HTMLElement|null} null means "at the end".
 */
function childBefore(list, clientY, exclude) {
  const rows = [...list.children].filter((row) => row !== exclude && !row.hasAttribute('v-each'));
  // "<=", not "<" — a pointer sitting exactly on a row's own midpoint goes before that row, not after it.
  return rows.find((row) => clientY <= row.getBoundingClientRect().top + row.offsetHeight / 2) || null;
}

/**
 * Repositions the dragging element within "list" to match "clientY", animated; no-op if already there.
 */
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

  // Nothing dragging yet — either a native reorder (its own item handles it) or a foreign drag not yet materialized here.
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

/**
 * Shared by "@dragend"/"@drop" — strips ".is-dragging" and writes the list's final DOM order back;
 * a materialized row resolves via foreignItemValues instead of its old index.
 */
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

/**
 * Shared "drop" handler — the event can land on any element under the pointer (often the dragged
 * item itself once repositioned), so both factories below call this to commit once per list.
 */
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
    /**
     * ".stop" keeps this from also reaching an ancestor createDropTarget()'s own "@dragover" —
     * handleDragover() above already covers this list.
     */
    '@dragover.prevent.stop'(e) {
      e.dataTransfer.dropEffect = 'move';
      handleDragover(this, this.$el.parentElement, e.clientY);
    },
    /**
     * Commits here too (not just "@dragend") since a foreign item's "@dragend" only fires on its
     * createDragSource() origin, never on itself.
     */
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
      // Firefox refuses to start a drag without data set on it — the payload itself travels via "foreignDrag", not dataTransfer.
      e.dataTransfer.setData('text/plain', '');
    },
    '@dragend'() {
      // Only fires for a materialized-but-never-dropped item — a successful drop already cleared "foreignDrag".
      if (foreignDrag?.element) {
        foreignItemValues.delete(foreignDrag.element);
        foreignDrag.element.remove();
      }
      foreignDrag = null;
    },
  };
}

/**
 * v-bind for a list that accepts new items dragged in from a createDragSource() elsewhere — the item
 * materializes into the DOM the moment its drag first reaches this list, then rides the same live
 * positioning as any of the list's own items (handleDragover() above).
 *
 * @param {Object} options
 * @param {Function} options.read - (component) => current array.
 * @param {Function} options.write - (component, nextArray) => void.
 * @param {Function} options.createItem - (component, payload) => { element, value } to accept the drop, or a falsy value to reject it.
 * @returns {Object} Directive object to spread into the list's own v-bind().
 */
export function createDropTarget({ read, write, createItem }) {
  return {
    /**
     * Registers this list up front so a dragover bubbling up from one of its own items still finds it.
     */
    '@load'() {
      dropTargets.set(this.$el, { createItem });
    },
    '@dragover.prevent'(e) {
      handleDragover(this, this.$el, e.clientY);
    },
    /**
     * Only once the pointer truly leaves the list (not just onto a child, which also fires "dragleave").
     */
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
