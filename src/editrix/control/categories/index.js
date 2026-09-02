// Toolbox > Categories section's own control (a two-level term tree) — fixed, single-instance, so
// its own state ("terms") lives here rather than through getValue()/setValue() (controls/base.js).

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
