import { describe, it, expect, beforeAll, afterEach } from 'vitest';

let selectDirective;

beforeAll(async () => {
  window.Youla = { directive: (name, fn) => { selectDirective = fn; } };
  await import('../youla-select');
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

function mount() {
  document.body.innerHTML = '<select><option value="a">A</option><option value="b" selected>B</option></select>';
  const el = document.querySelector('select');
  let changes = 0;
  document.body.addEventListener('change', () => changes++);
  return { el, changes: () => changes };
}

describe('u-select', () => {
  it('does not emit "change" on creation when the value is unchanged', () => {
    const { el, changes } = mount();
    selectDirective(el, undefined);

    expect(el._x_slimSelect).toBeTruthy();
    expect(el.value).toBe('b');
    expect(changes()).toBe(0);
    expect(Object.hasOwn(el, 'dispatchEvent')).toBe(false);
  });

  it('keeps the instance when re-applied with the same settings', () => {
    const { el, changes } = mount();
    selectDirective(el, { showSearch: true });
    const slim = el._x_slimSelect;

    selectDirective(el, { showSearch: true });

    expect(el._x_slimSelect).toBe(slim);
    expect(changes()).toBe(0);
  });

  it('rebuilds the instance when the settings change', () => {
    const { el } = mount();
    selectDirective(el, { showSearch: false });
    const slim = el._x_slimSelect;

    selectDirective(el, { showSearch: true });

    expect(el._x_slimSelect).not.toBe(slim);
  });
});
