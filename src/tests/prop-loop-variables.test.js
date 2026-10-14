import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';
import '../scripts/directives/u-each';
import '../scripts/directives/u-text';

function initAll() {
  Youla.componentDiscover(el => Youla.componentInitialize(el));
}

function type(el, value) {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

// Regression: u-prop inside u-each read and wrote a shared "scope.row" (seeded as {} by hydrateProps()) instead of the current loop item.
describe('u-prop rooted at a u-each loop variable', () => {
  function mount() {
    document.body.innerHTML = `
      <div u-data="{ rows: [{ value: 'a' }, { value: 'b' }] }">
        <div u-each="(row, i) in rows"><input u-prop="row.value"></div>
      </div>`;
    initAll();
    return document.querySelector('[u-data]').__x;
  }

  it('does not seed the loop variable in a nested u-data inside the loop', async () => {
    document.body.innerHTML = `
      <div u-data="{ rows: [{ value: 'a' }] }">
        <div u-each="row in rows"><div u-data><input u-prop="row.value"></div></div>
      </div>`;
    Youla.componentWatch(el => Youla.componentInitialize(el));
    initAll();
    await tick();

    const children = [...document.querySelectorAll('[u-data] [u-data]')].filter(el => el.__x);
    expect(children.some(el => 'row' in el.__x.rawData)).toBe(false);

    const input = children.find(el => !el.closest('[u-each]')).querySelector('input');
    expect(input.value).toBe('a');

    type(input, 'changed');
    await tick();
    expect(document.querySelector('[u-data]').__x.rawData.rows[0].value).toBe('changed');
  });

  it('reads each field from its own loop item', async () => {
    mount();
    await tick();

    const inputs = [...document.querySelectorAll('input')].filter(input => input.__x_initialized && !input.closest('[u-each]'));
    expect(inputs.map(input => input.value)).toEqual(['a', 'b']);
  });

  it('writes each field back to its own loop item', async () => {
    const component = mount();
    await tick();

    const inputs = [...document.querySelectorAll('input')].filter(input => !input.closest('[u-each]'));
    type(inputs[1], 'changed');
    await tick();

    expect(component.rawData.rows.map(row => row.value)).toEqual(['a', 'changed']);
    expect('row' in component.rawData).toBe(false);
  });
});
