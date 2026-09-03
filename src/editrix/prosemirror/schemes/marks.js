// The complete inline-formatting mark set — shared by both schemes (rich.js, plain.js), since
// formatting applies the same way regardless of whether the field also allows paragraphs. Kept in
// one place so the two schemes' toolbars (see toolbar.js's buildTools()) never drift apart.
export const marks = {
  link: {
    attrs: {
      href: { validate: 'string' },
      title: { default: null, validate: 'string|null' },
      // "target" is "_blank" or null (same tab); "rel" is a space-separated token string (e.g.
      // "noopener noreferrer nofollow") or null — see toolbar.js's link editor for how these are set.
      target: { default: null, validate: 'string|null' },
      rel: { default: null, validate: 'string|null' }
    },
    inclusive: false,
    parseDOM: [
      {
        tag: 'a[href]',
        getAttrs(dom) {
          return {
            href: dom.getAttribute('href'),
            title: dom.getAttribute('title'),
            target: dom.getAttribute('target'),
            rel: dom.getAttribute('rel')
          };
        }
      }
    ],
    toDOM(node) {
      let { href, title, target, rel } = node.attrs;
      const attrs = { href, title };
      if (target) attrs.target = target;
      if (rel) attrs.rel = rel;
      return ['a', attrs, 0];
    }
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
  },
  // Text color and highlight — CSS-based like underline/strike above, rather than baking a fixed
  // palette into the schema, so any hex the toolbar's color picker (toolbar.js) produces round-trips.
  color: {
    attrs: { color: { validate: 'string' } },
    parseDOM: [{ style: 'color', getAttrs: (value) => ({ color: value }) }],
    toDOM(node) { return ['span', { style: `color: ${node.attrs.color}` }, 0]; }
  },
  highlight: {
    attrs: { color: { validate: 'string' } },
    parseDOM: [{ style: 'background-color', getAttrs: (value) => ({ color: value }) }],
    toDOM(node) { return ['span', { style: `background-color: ${node.attrs.color}` }, 0]; }
  }
};
