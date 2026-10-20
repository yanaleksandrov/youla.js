import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-each';
import '../scripts/directives/u-text';

function initAll() {
  Youla.componentDiscover(el => Youla.componentInitialize(el));
}

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clones(selector) {
  return [...document.querySelectorAll(selector)].filter(el => el.__x_each_clone);
}

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

// Regression: a "u-each" clone inherits its template's "u-bind", which handed "u-each" back to the clone and cloned it again, endlessly.
describe('u-each supplied through u-bind', () => {
  const markup = `
    <div u-data="{ items: ['a', 'b'], row: { 'u-each': '(x, i) in items', ':class': 'x', 'u-text': 'x' } }">
      <button id="add" type="button" @click="items.push('c')"></button>
      <ul><li u-bind="row"></li></ul>
    </div>
  `;

  it('renders exactly one row per item and applies the other bindings', async () => {
    document.body.innerHTML = markup;
    initAll();
    await tick();

    const rows = clones('li');
    expect(rows).toHaveLength(2);
    expect(rows.map(li => li.className)).toEqual(['a', 'b']);
    expect(rows.map(li => li.textContent)).toEqual(['a', 'b']);
  });

  it('re-renders when items change without recursing', async () => {
    document.body.innerHTML = markup;
    initAll();
    await tick();

    click(document.getElementById('add'));
    await tick();

    expect(clones('li').map(li => li.textContent)).toEqual(['a', 'b', 'c']);
  });

  it('does not restart the loop for <template> content roots bound to u-each', async () => {
    document.body.innerHTML = `
      <div u-data="{ items: ['a', 'b'], row: { 'u-each': 'x in items' }, cell: { 'u-each': 'x in items', 'u-text': 'x' } }">
        <button id="add" type="button" @click="items.push('c')"></button>
        <ul><template u-bind="row"><li u-bind="cell"></li></template></ul>
      </div>
    `;
    initAll();
    await tick();

    expect(clones('li').map(li => li.textContent)).toEqual(['a', 'b']);

    click(document.getElementById('add'));
    await tick();

    expect(clones('li').map(li => li.textContent)).toEqual(['a', 'b', 'c']);
  });

  it('keeps a literal u-each working as before', async () => {
    document.body.innerHTML = `
      <div u-data="{ items: ['a', 'b'] }">
        <button id="add" type="button" @click="items.push('c')"></button>
        <ul><li u-each="x in items" u-text="x"></li></ul>
      </div>
    `;
    initAll();
    await tick();

    expect(document.querySelectorAll('li:not([u-each])')).toHaveLength(2);

    click(document.getElementById('add'));
    await tick();

    expect([...document.querySelectorAll('li:not([u-each])')].map(li => li.textContent)).toEqual(['a', 'b', 'c']);
  });
});
