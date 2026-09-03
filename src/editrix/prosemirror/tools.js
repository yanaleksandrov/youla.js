// Mark tools — toggled with toggleMark(schema.marks[name]). "primary: true" keeps a button directly
// on the toolbar (in this array's own order — Bold then Italic); the rest collapse into toolbar.js's
// own "More formatting" overflow menu.
export const MARK_TOOLS = [
  { name: 'strong', title: 'Bold', description: 'Bold Text', icon: 'ph ph-text-b', shortcut: 'Mod-b', primary: true },
  { name: 'em', title: 'Italic', description: 'Italic text', icon: 'ph ph-text-italic', shortcut: 'Mod-i', primary: true },
  { name: 'underline', title: 'Underline', description: 'Underline the selected text', icon: 'ph ph-text-underline', shortcut: 'Mod-u' },
  { name: 'strike', title: 'Strikethrough', description: 'Cross out the selected text', icon: 'ph ph-text-strikethrough', shortcut: 'Mod-Shift-x' },
  { name: 'subscript', title: 'Subscript', description: 'Lower the selected text below the baseline', icon: 'ph ph-text-subscript', shortcut: 'Mod-,' },
  { name: 'superscript', title: 'Superscript', description: 'Raise the selected text above the baseline', icon: 'ph ph-text-superscript', shortcut: 'Mod-.' },
  { name: 'code', title: 'Code', description: 'Format the selected text as inline code', icon: 'ph ph-code', shortcut: 'Mod-e' },
];

// The link mark — handled separately from MARK_TOOLS, since applying it needs a URL first.
export const LINK_TOOL = { name: 'link', title: 'Link', description: 'Add or edit a link', icon: 'ph ph-link', shortcut: 'Mod-k' };

// Levels offered by the toolbar's own block-type <select> — only shown when the schema defines a
// "heading" node (i.e. the "rich" scheme; a heading field is itself already a fixed level, so it
// has no use for this).
export const HEADING_LEVELS = [1, 2, 3, 4, 5, 6];

// The list and blockquote node types offered by that same <select>, each gated on the schema
// defining it — switching between "paragraph", "heading", "list" and "blockquote" is really one
// choice, not separate toggle buttons.
export const LIST_TYPES = [
  { name: 'bullet_list', title: 'Bulleted List' },
  { name: 'ordered_list', title: 'Ordered List' },
];
export const BLOCKQUOTE_TYPE = { name: 'blockquote', title: 'Blockquote' };

// Marks that need a value before they can be applied — handled by toolbar.js's own popover UI (a
// Filler-driven swatch, mirroring the link editor), not a plain toggle button, so they live outside
// MARK_TOOLS.
export const COLOR_TOOL = { name: 'color', title: 'Text Color', description: "Change the selected text's color", icon: 'ph ph-palette' };
export const HIGHLIGHT_TOOL = { name: 'highlight', title: 'Highlight', description: 'Highlight the selected text with a background color', icon: 'ph ph-highlighter-circle' };
