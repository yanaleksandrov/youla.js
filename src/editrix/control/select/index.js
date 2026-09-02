/**
 * The "select" control — a single-select dropdown, dispatched by CONTROL_RENDERERS.select (controls/render.js).
 */

import { cloneTemplateFragment } from '../../controls/template';

// "options" (an { value: label } map) builds the actual <option>s here, once, at render time — the field's own static config, not reactive state, so no need for a v-each.
export function renderSelect(name, title, rest) {
  const el = cloneTemplateFragment('editrix-control-select');
  const select = el.querySelector('select');

  select.setAttribute('v-bind', `e.select(${JSON.stringify(name)})`);
  Object.entries(rest.options || {}).forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.append(option);
  });

  return el;
}

export function createSelectControl() {
  return {
    /**
     * A single-select dropdown. `<option>`s are built once, imperatively, from the field's own
     * declared `options` map (renderSelect() above) rather than `v-each`'d — v-each's dependency
     * check would re-render (and reset) the list on every selection change.
     */
    select(name) {
      return {
        ':value'() {
          return this.getValue(name) ?? '';
        },
        '@change'(e) {
          this.setValue(name, e.target.value);
        },
      };
    },
  };
}
