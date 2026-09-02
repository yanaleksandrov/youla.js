/**
 * @param {Object} component
 * @param {string} name
 * @returns {Object[]}
 */
export function readItems(component, name) {
  return component.getValue(name) || [];
}

export function writeItems(component, name, items) {
  component.setValue(name, items);
}

/**
 * Merges "patch" into one item by index.
 */
export function patchItemAt(component, name, index, patch) {
  const items = readItems(component, name);
  writeItems(component, name, items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
}

/**
 * One fresh item, seeded from each declared field's own default.
 */
export function createDefaultItem(fields) {
  return Object.fromEntries(fields.map((field) => [field.name, field.default]));
}

/**
 * Reads an item's index off its root's "data-index" — works from any element nested inside it.
 */
export function itemIndexOf(el) {
  return +el.closest('[data-index]').dataset.index;
}

export function renumberItems(list) {
  [...list.children].forEach((row, index) => {
    row.dataset.index = index;
  });
}

/**
 * v-filler hangs document-level listeners on any <input> it mounts, with nothing watching for
 * that input leaving the DOM — sweep every <input> and destroy() before wiping innerHTML.
 */
export function destroyItemFillers(scope) {
  scope.querySelectorAll('input').forEach((input) => input._x_filler?.destroy());
}

/**
 * "min"/"max" bound how many items a repeatable control may hold; leaving "max" off means
 * unlimited, not "same as min". "min" floors at 0 and "max" floors at 1.
 */
export function minItems(component, name) {
  const declared = component._controls[name]?.min;
  return Math.max(0, declared ?? 0);
}

export function maxItems(component, name) {
  const declared = component._controls[name]?.max;
  // "?? Infinity" so an explicit "max: null" (e.g. a config that spells out every property, even unused ones) reads the same as leaving "max" out entirely.
  return declared == null ? Infinity : Math.max(1, declared);
}

/**
 * Item-scoped counterpart of base.js's isConditionMet() — same Elementor-style rules, but checked
 * against one item's own field values instead of top-level settings.
 *
 * @param {Object} item - The item whose own fields the condition is checked against.
 * @param {Object} [condition] - e.g. `{ highlighted: true }`, `{ 'type!': 'video' }`.
 * @returns {boolean}
 */
export function isItemConditionMet(item, condition) {
  if (!condition) {
    return true;
  }

  return Object.entries(condition).every(([key, expected]) => {
    const negate = key.endsWith('!');
    const actual = item?.[negate ? key.slice(0, -1) : key];
    const matches = Array.isArray(expected)
      ? expected.includes(actual)
      : expected === undefined ? !!actual : actual === expected;

    return negate ? !matches : matches;
  });
}
