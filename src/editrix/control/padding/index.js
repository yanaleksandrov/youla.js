/**
 * Toolbox > Position section's own "Padding" control — no unique state; not yet wired to a real
 * value (see index.html), just dragHandle() (youla-editrix.js, shared with control/margin).
 */

import { cloneTemplateFragment } from '../../controls/template';

export function renderPadding() {
  return cloneTemplateFragment('editrix-control-padding');
}
