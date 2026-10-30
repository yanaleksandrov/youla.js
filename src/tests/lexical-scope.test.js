import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-each';
import '../scripts/directives/u-text';

function initAll() {
  Youla.componentDiscover(el => Youla.componentInitialize(el));
}

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const texts = selector => [...document.querySelectorAll(selector)].map(el => el.textContent);

let warn;

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  document.body.innerHTML = '';
  warn.mockRestore();
});

describe('loop variables shadow component data', () => {
  it('resolves a loop variable before a same-named data key', async () => {
    Youla.data('shadowList', () => ({ items: [{ name: 'a' }, { name: 'b' }], item: { ':class': 'x' } }));
    document.body.innerHTML = `
      <div u-data="shadowList"><template u-each="(item, i) in items"><span u-text="item.name"></span></template></div>
    `;
    initAll();
    await tick();

    expect(texts('span')).toEqual(['a', 'b']);
    expect(warn).toHaveBeenCalledWith('Youla.js: loop variable "item" in u-each="(item, i) in items" shadows "item" of the component data.');
  });

  it('warns about a shadowed parent key only once per loop', async () => {
    document.body.innerHTML = `
      <div u-data="{ i: 0 }"><div u-data="{ items: [1, 2] }"><template u-each="(item, i) in items"><b u-text="i"></b></template></div></div>
    `;
    initAll();
    await tick();
    document.querySelector('[u-data="{ items: [1, 2] }"]').__x.data.items.push(3);
    await tick();

    expect(texts('b')).toEqual(['0', '1', '2']);
    expect(warn.mock.calls.filter(([message]) => message.includes('"i"'))).toHaveLength(1);
  });

  it('lets an inner loop variable win over an outer one of the same name', async () => {
    document.body.innerHTML = `
      <div u-data="{ rows: [[1, 2], [3]] }">
        <template u-each="item in rows"><div><template u-each="item in item"><i u-text="item"></i></template></div></template>
      </div>
    `;
    initAll();
    await tick();

    expect(texts('i')).toEqual(['1', '2', '3']);
  });

  it('keeps an assignment to a loop variable out of the component data', async () => {
    document.body.innerHTML = `
      <div u-data="{ items: ['a'], item: 'data', count: 0 }">
        <template u-each="item in items"><button @click="item = 'changed'; count++" u-text="item"></button></template>
      </div>
    `;
    initAll();
    await tick();

    const root = document.querySelector('[u-data]');
    document.querySelector('button').click();
    await tick();

    expect(root.__x.data.item).toBe('data');
    expect(root.__x.data.count).toBe(1);
  });

  it('keeps magic variables reachable next to loop variables', async () => {
    document.body.innerHTML = `
      <div u-data="{ items: ['a'] }" id="root">
        <p u-ref="title">T</p>
        <template u-each="item in items"><span u-text="item + $el.tagName + $refs.title.textContent"></span></template>
      </div>
    `;
    initAll();
    await tick();

    expect(texts('span')).toEqual(['aSPANT']);
  });
});

describe('an alias shadows parent component data', () => {
  it('resolves the alias before a same-named parent key, and warns', async () => {
    Youla.data('notice', () => ({ text: 'own' }));
    document.body.innerHTML = `
      <section u-data="{ notice: { text: 'parent' } }">
        <div u-data="notice as notice"><span u-text="notice.text"></span></div>
      </section>
    `;
    initAll();
    await tick();

    expect(texts('span')).toEqual(['own']);
    expect(warn).toHaveBeenCalledWith('Youla.js: alias "notice" in u-data="notice as notice" shadows "notice" of a parent component.');
  });

  it('lets an inner alias win over an outer alias of the same name', async () => {
    document.body.innerHTML = `
      <section u-data="{ v: 'outer' } as box">
        <b u-text="box.v"></b>
        <div u-data="{ v: 'inner' } as box"><i u-text="box.v"></i></div>
      </section>
    `;
    initAll();
    await tick();

    expect(texts('b')).toEqual(['outer']);
    expect(texts('i')).toEqual(['inner']);
  });

  it('lets a loop variable inside the component win over its alias', async () => {
    document.body.innerHTML = `
      <div u-data="{ items: ['x'] } as item"><template u-each="item in items"><span u-text="item"></span></template></div>
    `;
    initAll();
    await tick();

    expect(texts('span')).toEqual(['x']);
  });

});
