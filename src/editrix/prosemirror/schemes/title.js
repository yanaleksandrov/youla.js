import { Schema } from 'prosemirror-model';

const nodes = {
  // Renders as <h1>: this schema is a single-line title field, not a full document.
  doc: {
    content: 'inline*',
    toDOM: () => ["h1", 0],
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
  code_block: {
    content: 'text*',
    marks: '',
    group: 'block',
    code: true,
    defining: true,
    parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
    toDOM: () => ['pre'],
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
};

const marks = {
  em: {
    parseDOM: [
      { tag: 'i' }, { tag: 'em' },
      { style: 'font-style=italic' },
      { style: 'font-style=normal', clearMark: m => m.type.name === 'em' }
    ],
    toDOM: () => ['em', 0]
  },
  strong: {
    parseDOM: [
      { tag: 'strong' },
      // Google Docs wraps pasted content in `<b>` with font-weight normal; don't treat that as strong.
      { tag: 'b', getAttrs: (node) => node.style.fontWeight !== 'normal' && null },
      { style: 'font-weight=400', clearMark: m => m.type.name === 'strong' },
      { style: 'font-weight', getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null },
    ],
    toDOM: () => ['strong', 0]
  },
  code: {
    parseDOM: [{ tag: 'code' }],
    toDOM: () => ['code', 0]
  }
};

export const titleSchema = new Schema({ nodes, marks });
