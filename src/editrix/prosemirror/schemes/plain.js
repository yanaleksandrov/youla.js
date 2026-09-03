import { Schema } from 'prosemirror-model';
import { marks } from './marks';

const nodes = {
  // No block content — a single-line field, never split into paragraphs (a heading can't contain
  // one). mountEditor() (youla-editrix.js) turns Enter into a hard_break instead of the usual
  // splitBlock, since there's no second block for it to split into.
  doc: {
    content: 'inline*',
  },
  text: {
    group: 'inline'
  },
  hard_break: {
    inline: true,
    group: 'inline',
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM: () => ['br'],
  },
};

// The "plain" text scheme — a single line, with every inline mark (marks.js) but no paragraphs or
// other block structure. Used for headings and other fields that must stay on one line.
export const plainSchema = new Schema({ nodes, marks });
