/**
 * Toolbox > generic multi-line text control — e.g. the "Page" panel's title field. Unlike a name-
 * parametrized control like control/text, it's bound straight to a top-level reactive property via
 * "v-prop", not through getValue()/setValue() (controls/base.js): the toolbox's own section stays
 * visible regardless of which block is selected, so routing through the block-content settings
 * system (keyed by "activeBlock") would silently write the value into whichever block is selected.
 */

import { cloneTemplateFragment } from '../../controls/template';

export function renderTextarea(name, title, rest) {
  const el = cloneTemplateFragment('editrix-control-textarea');
  const field = el.querySelector('textarea');

  field.setAttribute('v-prop', name);
  if (rest?.placeholder) {
    field.setAttribute('placeholder', rest.placeholder);
  }
  return el;
}
