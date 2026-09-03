// Toolbar tools for a ProseMirror-backed text field (see toolbar.js) — one declarative list per
// kind, trimmed at runtime to whatever marks/nodes the field's own scheme (schemes/rich.js,
// schemes/plain.js) actually defines. Both schemes share the same complete inline mark set
// (schemes/marks.js), so every mark tool below applies equally to a heading and to body text —
// NODE_TOOLS is what actually differs: a "plain" (single-line) field has no block nodes to switch
// between, e.g. a heading can never contain a paragraph, so it naturally loses every entry there.
//
// "heading" and "link" aren't listed here — toolbar.js gives each its own dedicated UI (a level
// <select>, and a small URL editor) instead of a plain toggle button.
//
// "description" is shown in a real v-tooltip (youla-tooltip.js) on hover, alongside the tool's own
// keyboard shortcut — see toolbar.js's describeButton().

// Mark tools — toggled with toggleMark(schema.marks[name]).
export const MARK_TOOLS = [
  { name: 'strong', title: 'Bold', description: 'Make the selected text bold', icon: 'ph ph-text-b', shortcut: 'Mod-b' },
  { name: 'em', title: 'Italic', description: 'Make the selected text italic', icon: 'ph ph-text-italic', shortcut: 'Mod-i' },
  { name: 'underline', title: 'Underline', description: 'Underline the selected text', icon: 'ph ph-text-underline', shortcut: 'Mod-u' },
  { name: 'strike', title: 'Strikethrough', description: 'Cross out the selected text', icon: 'ph ph-text-strikethrough', shortcut: 'Mod-Shift-x' },
  { name: 'subscript', title: 'Subscript', description: 'Lower the selected text below the baseline', icon: 'ph ph-text-subscript', shortcut: 'Mod-,' },
  { name: 'superscript', title: 'Superscript', description: 'Raise the selected text above the baseline', icon: 'ph ph-text-superscript', shortcut: 'Mod-.' },
  { name: 'code', title: 'Code', description: 'Format the selected text as inline code', icon: 'ph ph-code', shortcut: 'Mod-e' },
];

// Block-structure tools — "wrap: true" wraps the selection (blockquote); "insert: true" inserts a
// standalone node at the selection (horizontal_rule).
export const NODE_TOOLS = [
  { name: 'blockquote', title: 'Blockquote', description: 'Turn the selection into a blockquote', icon: 'ph ph-quotes', wrap: true, shortcut: 'Mod-Shift-b' },
  { name: 'horizontal_rule', title: 'Horizontal Rule', description: 'Insert a horizontal divider', icon: 'ph ph-line-horizontal', insert: true, shortcut: 'Mod-Shift--' },
];

// The link mark — handled separately from MARK_TOOLS, since applying it needs a URL first.
export const LINK_TOOL = { name: 'link', title: 'Link', description: 'Add or edit a link', icon: 'ph ph-link', shortcut: 'Mod-k' };

// Levels offered by the toolbar's own heading <select> — only shown when the schema defines a
// "heading" node (i.e. the "rich" scheme; a heading field is itself already a fixed level, so it
// has no use for this).
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6];
