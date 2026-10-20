import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  it('hides the source element and evaluates its descendants only inside clones', async () => {
    const errors = [];
    const onError = event => errors.push(event.error ?? event.message);
    window.addEventListener('error', onError);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    document.body.innerHTML = `
      <div u-data="{ links: [{ url: '/a' }, { url: '/b' }], row: { 'u-each': '(link, i) in links' }, anchor: { ':href': 'link.url' } }">
        <button id="add" type="button" @click="links.push({ url: '/c' })"></button>
        <ul><li u-bind="row"><a u-bind="anchor"></a></li></ul>
      </div>
    `;
    initAll();
    await tick();

    const source = [...document.querySelectorAll('li')].find(li => !li.__x_each_clone);
    expect(source.getAttribute('u-each')).toBe('(link, i) in links');
    expect(source.querySelector('a').hasAttribute('href')).toBe(false);
    expect(clones('li').map(li => li.hasAttribute('u-each'))).toEqual([false, false]);
    expect(clones('li').map(li => li.querySelector('a').getAttribute('href'))).toEqual(['/a', '/b']);

    click(document.getElementById('add'));
    await tick();

    expect(clones('li').map(li => li.querySelector('a').getAttribute('href'))).toEqual(['/a', '/b', '/c']);
    expect(errors).toEqual([]);
    expect(consoleError).not.toHaveBeenCalled();

    window.removeEventListener('error', onError);
    consoleError.mockRestore();
  });

  it('does not evaluate a literal template\'s own bindings without loop variables', async () => {
    document.body.innerHTML = `
      <div u-data="{ items: [{ x: 'a' }] }">
        <ul><li u-each="item in items" :class="item.x"></li></ul>
      </div>
    `;
    initAll();
    await tick();

    expect(document.querySelector('li[u-each]').hasAttribute('class')).toBe(false);
    expect(document.querySelector('li:not([u-each])').className).toBe('a');
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
