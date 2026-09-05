import { Schema } from 'prosemirror-model';
import { marks } from './marks';

// NodeSpecs for this schema — see https://prosemirror.net/docs/ref/#model.NodeSpec
const nodes = {
  doc: {
    content: 'block+'
  },
  paragraph: {
    content: 'inline*',
    group: 'block',
    parseDOM: [{ tag: 'p' }],
    toDOM: () => ['p', 0]
  },
  blockquote: {
    content: 'block+',
    group: 'block',
    defining: true,
    parseDOM: [{ tag: 'blockquote' }],
    toDOM: () => ['blockquote', 0]
  },
  horizontal_rule: {
    group: 'block',
    parseDOM: [{ tag: 'hr' }],
    toDOM: () => ['hr']
  },
  // Hand-written rather than pulled in via prosemirror-schema-list's addListNodes() — see
  // toolbar.js's block-type <select> (which offers both list types alongside Text/Heading) and its
  // wrapInList/liftListItem/sinkListItem/splitListItem keymap for how these are actually used.
  bullet_list: {
    content: 'list_item+',
    group: 'block',
    parseDOM: [{ tag: 'ul' }],
    toDOM: () => ['ul', 0]
  },
  ordered_list: {
    content: 'list_item+',
    group: 'block',
    attrs: { order: { default: 1, validate: 'number' } },
    parseDOM: [{
      tag: 'ol',
      getAttrs(dom) { return { order: dom.hasAttribute('start') ? +dom.getAttribute('start') : 1 }; }
    }],
    toDOM(node) { return node.attrs.order === 1 ? ['ol', 0] : ['ol', { start: node.attrs.order }, 0]; }
  },
  list_item: {
    // "block*" (not "inline*") lets an item hold more than one paragraph, or nest another list/
    // blockquote inside it — matches prosemirror-schema-list's own default list_item content.
    content: 'paragraph block*',
    defining: true,
    parseDOM: [{ tag: 'li' }],
    toDOM: () => ['li', 0]
  },
  heading: {
    attrs: { level: { default: 1, validate: 'number' } },
    content: 'inline*',
    group: 'block',
    defining: true,
    parseDOM: [
      { tag: 'h1', attrs: { level: 1 } },
      { tag: 'h2', attrs: { level: 2 } },
      { tag: 'h3', attrs: { level: 3 } },
      { tag: 'h4', attrs: { level: 4 } },
      { tag: 'h5', attrs: { level: 5 } },
      { tag: 'h6', attrs: { level: 6 } },
    ],
    toDOM(node) {
      return ['h' + node.attrs.level, 0];
    }
  },
  code_block: {
    content: 'text*',
    marks: '',
    group: 'block',
    code: true,
    defining: true,
    parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
    toDOM() {
      return ['pre', ['code', 0]];
    }
  },
  text: {
    group: 'inline'
  },
  image: {
    inline: true,
    attrs: {
      src: { validate: 'string' },
      alt: { default: null, validate: 'string|null' },
      title: { default: null, validate: 'string|null' }
    },
    group: 'inline',
    draggable: true,
    parseDOM: [
      {
        tag: 'img[src]',
        getAttrs(dom) {
          return {
            src: dom.getAttribute('src'),
            title: dom.getAttribute('title'),
            alt: dom.getAttribute('alt')
          };
        }
      }
    ],
    toDOM(node) { let { src, alt, title } = node.attrs; return ['img', { src, alt, title }]; }
  },
  hard_break: {
    inline: true,
    group: 'inline',
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM: () => ['br'],
  }
};

// The "rich" text scheme — paragraphs, headings, blockquotes, bulleted/ordered lists, images and
// other block-level structure, plus every inline mark (marks.js). Roughly matches CommonMark's
// document schema.
export const richSchema = new Schema({ nodes, marks });
