import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-each';
import '../scripts/directives/u-text';
import '../scripts/directives/u-prop';

function initAll() {
  Youla.componentDiscover(el => Youla.componentInitialize(el));
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

describe('u-each on <template>', () => {
  it('renders every root node per item, in order, after the template', async () => {
    document.body.innerHTML = `
      <div id="root" u-data="{ items: ['a', 'b'] }">
        <template u-each="(item, i) in items"><dt u-text="item"></dt><dd u-text="i"></dd></template>
        <p id="after">after</p>
      </div>
    `;
    initAll();
    await tick();

    const tags = [...document.getElementById('root').children].map(el => `${el.tagName}:${el.textContent}`);
    expect(tags).toEqual(['TEMPLATE:', 'DT:a', 'DD:0', 'DT:b', 'DD:1', 'P:after']);
  });

  it('re-renders only its own nodes and keeps later siblings', async () => {
    document.body.innerHTML = `
      <div id="root" u-data="{ items: ['a', 'b'] }">
        <template u-each="item in items"><span u-text="item"></span></template>
        <p id="after">after</p>
        <button id="add" @click="items.push('c')"></button>
        <button id="clear" @click="items = []"></button>
      </div>
    `;
    initAll();
    await tick();

    document.getElementById('add').click();
    await tick();
    expect([...document.querySelectorAll('#root > span')].map(el => el.textContent)).toEqual(['a', 'b', 'c']);
    expect(document.getElementById('after')).not.toBeNull();

    document.getElementById('clear').click();
    await tick();
    expect(document.querySelectorAll('#root > span').length).toBe(0);
    expect(document.getElementById('after')).not.toBeNull();
  });

  it('keeps the prototype out of form validation and FormData', async () => {
    document.body.innerHTML = `
      <form id="form" u-data="{ rows: [{ name: 'Ann' }] }">
        <template u-each="row in rows"><input name="name[]" required u-prop="row.name"></template>
      </form>
    `;
    initAll();
    await tick();

    const form = document.getElementById('form');
    expect(form.checkValidity()).toBe(true);
    expect(new FormData(form).getAll('name[]')).toEqual(['Ann']);
  });

  it('applies join between items', async () => {
    document.body.innerHTML = `
      <p id="root" u-data="{ items: ['a', 'b', 'c'] }"><template u-each="item in items join ', '"><i u-text="item"></i></template></p>
    `;
    initAll();
    await tick();

    expect(document.getElementById('root').textContent).toBe('a, b, c');
  });
});
