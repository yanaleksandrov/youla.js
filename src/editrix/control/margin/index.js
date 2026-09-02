/**
 * Toolbox > Position section's own "Margin" control — no unique state; not yet wired to a real value
 * (see index.html), just dragHandle() (youla-editrix.js, shared with control/padding).
 */

import { cloneTemplateFragment } from '../../controls/template';

export function renderMargin() {
  return cloneTemplateFragment('editrix-control-margin');
}
