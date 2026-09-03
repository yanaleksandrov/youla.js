// The complete inline-formatting mark set — shared by both schemes (rich.js, plain.js), since
// formatting applies the same way regardless of whether the field also allows paragraphs. Kept in
// one place so the two schemes' toolbars (see toolbar.js's buildTools()) never drift apart.
export const marks = {
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
  underline: {
    parseDOM: [
      { tag: 'u' },
      { style: 'text-decoration=underline' },
    ],
    toDOM: () => ['u', 0]
  },
  strike: {
    parseDOM: [
      { tag: 's' }, { tag: 'del' }, { tag: 'strike' },
      { style: 'text-decoration=line-through' },
    ],
    toDOM: () => ['s', 0]
  },
  // Mutually exclusive — applying one clears the other, matching how every other rich-text editor
  // treats sub/superscript.
  subscript: {
    excludes: 'superscript',
    parseDOM: [{ tag: 'sub' }, { style: 'vertical-align=sub' }],
    toDOM: () => ['sub', 0]
  },
  superscript: {
    excludes: 'subscript',
    parseDOM: [{ tag: 'sup' }, { style: 'vertical-align=super' }],
    toDOM: () => ['sup', 0]
  },
  code: {
    parseDOM: [{ tag: 'code' }],
    toDOM: () => ['code', 0]
  }
};
