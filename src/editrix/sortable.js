/**
 * Generic HTML5 drag-to-reorder for a list of sibling elements, shared by youla-editrix.js's
 * sortable() and controls/repeater.js's repeaterItemRoot() — supply read/write accessors for your
 * own array rather than hand-rolling this again.
 */

import { animateReorder } from './animate-reorder';

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
    '@dragover.prevent'(e) {
      e.dataTransfer.dropEffect = 'move';

      const row = this.$el;
      const dragging = row.parentElement.querySelector('.is-dragging');

      if (!dragging || dragging === row) {
        return;
      }

      const after = e.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
      const before = after ? row.nextElementSibling : row;

      // "dragover" fires continuously while the pointer sits still — skip the no-op reorder when nothing would actually change.
      if (dragging.nextElementSibling === before) {
        return;
      }

      animateReorder(row.parentElement, () => {
        row.parentElement.insertBefore(dragging, before);
      }, dragging);
    },
    // Without this the browser's own default drop action fires — for an <img> drag source that means inserting a second, broken copy of the image.
    '@drop.prevent'() {},
    '@dragend'() {
      const list = this.$el.parentElement;
      this.$el.classList.remove('is-dragging');

      // Filter out v-each's own hidden template element — it has no loop variable in scope, so its ":data-index" would resolve to a stray "undefined".
      const rows = [...list.children].filter((row) => !row.hasAttribute('v-each'));
      const items = read(this);

      write(this, rows.map((row) => items[+row.dataset.index]));
      rows.forEach((row, index) => {
        row.dataset.index = index;
      });
    },
  };
}
