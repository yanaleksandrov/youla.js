/**
 * Shared "array of item objects" engine behind every repeatable control on the Content panel — the
 * classic collapsible repeater (controls/repeater.js) and the repeatable section (controls/
 * section-repeater.js) both store their value as object[] and need the same read/write/patch/
 * min-max plumbing. Only how a row/item is *drawn* differs between the two, so that part stays in
 * each control's own file.
 */

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

// Merges "patch" into one item by index.
export function patchItemAt(component, name, index, patch) {
  const items = readItems(component, name);
  writeItems(component, name, items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
}

// One fresh item, seeded from each declared field's own default.
export function createDefaultItem(fields) {
  return Object.fromEntries(fields.map((field) => [field.name, field.default]));
}

// An item's own index is read off its root's "data-index" rather than baked into any binding, so
// add/remove/reorder only ever need to touch that attribute. Works from any element nested inside an
// item regardless of markup, since only an item's own root — never its nested fields — carries
// "data-index".
export function itemIndexOf(el) {
  return +el.closest('[data-index]').dataset.index;
}

export function renumberItems(list) {
  [...list.children].forEach((row, index) => {
    row.dataset.index = index;
  });
}

// v-filler hangs document-level listeners on any <input> it mounts, with nothing watching for that input leaving the DOM — sweep every <input> and destroy() before wiping innerHTML.
export function destroyItemFillers(scope) {
  scope.querySelectorAll('input').forEach((input) => input._x_filler?.destroy());
}

// "min"/"max" bound how many items a repeatable control may hold; leaving "max" off means unlimited, not "same as min". "min" floors at 0 (the list can be emptied) and "max" floors at 1.
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
 * Item-scoped counterpart of base.js's isConditionMet() — same Elementor-style rules (every key
 * must match; an array means "one of these"; a trailing "!" on the key negates it) — but checked
 * against one item's own field values instead of top-level settings. A repeater/repeatable-section
 * item's own `condition` refers to a sibling field within that same item ("only show accent_color
 * when this item's own highlighted is true"), not a block-level setting.
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
