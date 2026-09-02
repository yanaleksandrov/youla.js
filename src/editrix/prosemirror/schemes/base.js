import { Schema } from 'prosemirror-model';

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

// MarkSpecs for this schema — see https://prosemirror.net/docs/ref/#model.MarkSpec
const marks = {
  link: {
    attrs: {
      href: { validate: 'string' },
      title: { default: null, validate: 'string|null' }
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs(dom) {
          return { href: dom.getAttribute('href'), title: dom.getAttribute('title') };
        }
      }
    ],
    toDOM(node) { let { href, title } = node.attrs; return ['a', { href, title }, 0]; }
  },
  em: {
    parseDOM: [
      { tag: 'i' }, { tag: 'em' },
      { style: 'font-style=italic' },
      { style: 'font-style=normal', clearMark: m => m.type.name === 'em' }
    ],
    toDOM() { return ['em', 0]; }
  },
  strong: {
    parseDOM: [
      { tag: 'strong' },
      // Google Docs wraps pasted content in `<b>` with font-weight normal; don't treat that as strong.
      { tag: 'b', getAttrs: (node) => node.style.fontWeight !== 'normal' && null },
      { style: 'font-weight=400', clearMark: m => m.type.name === 'strong' },
      { style: 'font-weight', getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null },
    ],
    toDOM() { return ['strong', 0]; }
  },
  code: {
    parseDOM: [{ tag: 'code' }],
    toDOM() { return ['code', 0]; }
  }
};

// Roughly matches CommonMark's document schema, minus lists (see prosemirror-schema-list).
// Extend or read `spec.nodes`/`spec.marks` to reuse pieces elsewhere.
export const baseSchema = new Schema({ nodes, marks });
