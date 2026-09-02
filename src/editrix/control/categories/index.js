/**
 * Toolbox > Categories section's own control (a two-level term tree) — a fixed, single-instance
 * control (not a name-keyed setting), so its own state ("terms") and bindings live here rather than
 * going through getValue()/setValue() (controls/base.js). Cloned from "editrix-control-categories"
 * by convention (controls/render.js's renderField(), no renderer registered for "categories").
 */

export function createCategoriesControl() {
  return {
    terms: {
      lvl1: '',
      lvl2: '',
    },

    // Checking a root term clears the whole tree; checking a child keeps its parent and clears any sibling branch.
    categoryRootOption: {
      '@click': "$el.checked && (terms = {lvl1: '', lvl2: ''})",
    },
    categoryChildOption(parent) {
      return {
        '@click': `$el.checked && (terms = {lvl1: '${parent}', lvl2: ''})`,
      };
    },
  };
}
