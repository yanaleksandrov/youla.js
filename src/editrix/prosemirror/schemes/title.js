import { Schema } from 'prosemirror-model';

const nodes = {
  // Just inline-content
  doc: {
    content: 'inline*',
    toDOM: () => ["h1", 0],
  },
  // The text node.
  text: {
    group: 'inline'
  },
  // A hard line break, represented in the DOM as `<br>`.
  hard_break: {
    inline: true,
    group: 'inline',
    selectable: false,
    parseDOM: [{ tag: 'br' }],
    toDOM: () => ['br'],
  },
  // A code listing. Disallows marks or non-text inline nodes by default. Represented as a `<pre>` element with a `<code>` element inside of it.
  code_block: {
    content: 'text*',
    marks: '',
    group: 'block',
    code: true,
    defining: true,
    parseDOM: [{ tag: 'pre', preserveWhitespace: 'full' }],
    toDOM: () => ['pre'],
  },
  // An inline image (`<img>`) node. Supports `src`, `alt`, and `href` attributes. The latter two default to the empty string.
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
  // An emphasis mark. Rendered as an `<em>` element. Has parse rules that also match `<i>` and `font-style: italic`.
  em: {
    parseDOM: [
      { tag: 'i' }, { tag: 'em' },
      { style: 'font-style=italic' },
      { style: 'font-style=normal', clearMark: m => m.type.name === 'em' }
    ],
    toDOM: () => ['em', 0]
  },
  //  A strong mark. Rendered as `<strong>`, parse rules also match `<b>` and `font-weight: bold`.
  strong: {
    parseDOM: [
      { tag: 'strong' },
      // This works around a Google Docs misbehavior where
      // pasted content will be inexplicably wrapped in `<b>`
      // tags with a font-weight normal.
      { tag: 'b', getAttrs: (node) => node.style.fontWeight !== 'normal' && null },
      { style: 'font-weight=400', clearMark: m => m.type.name === 'strong' },
      { style: 'font-weight', getAttrs: (value) => /^(bold(er)?|[5-9]\d{2,})$/.test(value) && null },
    ],
    toDOM: () => ['strong', 0]
  },
  // Code font mark. Represented as a `<code>` element.
  code: {
    parseDOM: [{ tag: 'code' }],
    toDOM: () => ['code', 0]
  }
};

export const titleSchema = new Schema({ nodes, marks });
