import { directive } from '../../../scripts/directives';

import { tooltip } from '../prosemirror/tooltip';

import { baseSchema } from '../prosemirror/schemes/base';
import { titleSchema } from '../prosemirror/schemes/title';

import { EditorState, Plugin } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Schema, DOMParser } from 'prosemirror-model';
import { history, undo, redo } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';

directive('editor', (el, expression, attribute, x, component) => {
  let schema = baseSchema;

  let plugins = [];
  if (expression === 'h1') {
    schema = titleSchema;

    plugins.push(
      keymap({
        Enter: (state, dispatch) => {
          const { $from } = state.selection;
          if (!$from.parent.type.spec.code) {
            dispatch(state.tr.replaceSelectionWith(state.schema.nodes.hard_break.create()).scrollIntoView());
            return true;
          }
          return false;
        },
      })
    );
  }

  new EditorView(el, {
    state: EditorState.create({
      schema,
      plugins: [
        history(),
        keymap(baseKeymap),
        keymap({
          'Mod-z': undo,
          'Mod-y': redo
        }),
        tooltip(),
        ...plugins,
      ]
    })
  }).dom.classList.add('editor-content');
});
