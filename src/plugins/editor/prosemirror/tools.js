export const blockTools = {
  blockquote: {
    title: 'Blockquote',
    icon: 'ph ph-quotes',
    hotKey: '%%%+Shift+B',
    keymap: 'Mod-Shift-b',
  },
  heading: {
    title: 'Heading',
    icon: 'ph ph-text-h',
    hotKey: '%%%+Shift+H',
    keymap: 'Mod-Shift-h',
  },
  list: {
    bulletList: {
      title: 'Bullet List',
      icon: 'ph ph-list-bullets',
      hotKey: '%%%+Shift+8',
      keymap: 'Mod-Shift-8',
    },
    orderedList: {
      title: 'Ordered List',
      icon: 'ph ph-list-numbers',
      hotKey: '%%%+Shift+7',
      keymap: 'Mod-Shift-7',
    },
  },
  horizontalRule: {
    title: 'Horizontal Rule',
    icon: 'ph ph-line-horizontal',
    hotKey: '%%%+Shift+-',
    keymap: 'Mod-Shift--',
  },
};

export const inlineTools = {
  textFormat: {
    bold: {
      title: 'Bold',
      icon: 'ph ph-text-b',
      hotKey: '%%%+B',
      keymap: 'Mod-b',
    },
    italic: {
      title: 'Italic',
      icon: 'ph ph-text-italic',
      hotKey: '%%%+I',
      keymap: 'Mod-i',
    },
    underline: {
      title: 'Underline',
      icon: 'ph ph-text-underline',
      hotKey: '%%%+U',
      keymap: 'Mod-u',
    },
    strikethrough: {
      title: 'Strikethrough',
      icon: 'ph ph-text-strikethrough',
      hotKey: '%%%+Shift+X',
      keymap: 'Mod-Shift-x',
    },
  },
  subscriptSuperscript: {
    subscript: {
      title: 'Subscript',
      icon: 'ph ph-text-subscript',
      hotKey: '%%%+,',
      keymap: 'Mod-,',
    },
    superscript: {
      title: 'Superscript',
      icon: 'ph ph-text-superscript',
      hotKey: '%%%+.',
      keymap: 'Mod-.',
    },
  },
  codeAndLink: {
    code: {
      title: 'Code',
      icon: 'ph ph-code',
      hotKey: '%%%+E',
      keymap: 'Mod-e',
    },
    link: {
      title: 'Insert Link',
      icon: 'ph ph-link',
      hotKey: '%%%+K',
      keymap: 'Mod-k',
    },
  },
  undoRedo: {
    undo: {
      title: 'Undo',
      icon: 'ph ph-arrow-counter-clockwise',
      hotKey: '%%%+Z',
      keymap: 'Mod-z',
    },
    redo: {
      title: 'Redo',
      icon: 'ph ph-arrow-clockwise',
      hotKey: '%%%+Shift+Z',
      keymap: 'Mod-Shift-z',
    },
  },
  textAlign: {
    alignLeft: {
      title: 'Align Left',
      icon: 'ph ph-text-align-left',
      hotKey: '%%%+Shift+L',
      keymap: 'Mod-Shift-l',
    },
    alignCenter: {
      title: 'Align Center',
      icon: 'ph ph-text-align-center',
      hotKey: '%%%+Shift+E',
      keymap: 'Mod-Shift-e',
    },
    alignRight: {
      title: 'Align Right',
      icon: 'ph ph-text-align-right',
      hotKey: '%%%+Shift+R',
      keymap: 'Mod-Shift-r',
    },
  },
};

export const titleTools = {
  textFormat: Object.fromEntries(
    Object.entries(inlineTools.textFormat)
      .filter(([key]) => key !== 'bold')
  ),
  subscriptSuperscript: inlineTools.subscriptSuperscript,
  codeAndLink: inlineTools.codeAndLink,
}