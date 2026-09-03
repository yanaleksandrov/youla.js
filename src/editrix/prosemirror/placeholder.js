import { Plugin } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

/**
 * True for a doc that has no real content yet — either genuinely empty (a "plain" scheme with
 * nothing typed) or holding a single empty textblock (a "rich" scheme's starting empty paragraph).
 *
 * @param {import('prosemirror-model').Node} doc
 * @returns {boolean}
 */
function isEmptyDoc(doc) {
  if (doc.childCount === 0) {
    return true;
  }
  return doc.childCount === 1 && doc.firstChild.isTextblock && doc.firstChild.content.size === 0;
}

/**
 * Shows "text" in place of an empty field — a decoration, so it never becomes real doc content
 * (typing anywhere replaces it, nothing has to delete it first).
 *
 * @param {string} text
 * @returns {import('prosemirror-state').Plugin}
 */
export function placeholder(text) {
  return new Plugin({
    props: {
      decorations(state) {
        if (!isEmptyDoc(state.doc)) {
          return null;
        }

        const pos = state.doc.childCount === 0 ? 0 : 1;
        const widget = Decoration.widget(pos, () => {
          const span = document.createElement('span');
          span.className = 'editrix-placeholder';
          span.textContent = text;
          return span;
        }, { side: 0, ignoreSelection: true });

        return DecorationSet.create(state.doc, [widget]);
      },
    },
  });
}
