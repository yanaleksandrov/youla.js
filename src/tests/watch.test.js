import { describe, it, expect, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-text';
import '../scripts/methods/$watch';

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function mount(html) {
  window.Youla = Youla;
  document.body.innerHTML = html;
  Youla.componentDiscover(el => Youla.componentInitialize(el));
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('$watch', () => {
  it('calls back with the new and old value of a nested path', async () => {
    mount(`
      <div u-data="{ user: { name: 'a' }, calls: [] }">
        <button id="watch" @click="$watch('user.name', (value, old) => calls.push([value, old]))"></button>
        <button id="set" @click="user.name = 'b'"></button>
      </div>
    `);
    const component = document.querySelector('[u-data]').__x;

    document.getElementById('watch').click();
    document.getElementById('set').click();
    await tick();

    expect(component.data.calls).toEqual([['b', 'a']]);
  });

  it('ignores writes to other paths and writes of the same value', async () => {
    mount(`<div u-data="{ a: 1, b: 1 }"></div>`);
    const c = document.querySelector('[u-data]').__x;
    const calls = [];

    c.watch('a', value => calls.push(value));
    c.data.b = 2;
    await tick();
    c.data.a = 1;
    await tick();

    expect(calls).toEqual([]);
  });

  it('detects in-place array mutations', async () => {
    mount(`<div u-data="{ list: [] }"></div>`);
    const c = document.querySelector('[u-data]').__x;
    const calls = [];

    c.watch('list', value => calls.push([...value]));
    c.data.list.push('x');
    await tick();

    expect(calls).toEqual([['x']]);
  });

  it('sees a path owned by an ancestor component', async () => {
    mount(`
      <main u-data="{ shared: 1 }">
        <div u-data="{}"></div>
      </main>
    `);
    const parent = document.querySelector('main').__x;
    const child  = document.querySelector('div').__x;
    const calls  = [];

    child.watch('shared', value => calls.push(value));
    parent.data.shared = 2;
    await tick();

    expect(calls).toEqual([2]);
  });

  it('stops after the returned function is called', async () => {
    mount(`<div u-data="{ a: 1 }"></div>`);
    const c = document.querySelector('[u-data]').__x;
    const calls = [];

    const unwatch = c.watch('a', value => calls.push(value));
    unwatch();
    c.data.a = 2;
    await tick();

    expect(calls).toEqual([]);
  });

  it('keeps a write made inside the callback reactive', async () => {
    mount(`
      <div u-data="{ a: 1, b: 0 }">
        <span u-text="b"></span>
      </div>
    `);
    const c = document.querySelector('[u-data]').__x;

    c.watch('a', value => { c.data.b = value * 10; });
    c.data.a = 2;
    await tick(40);

    expect(document.querySelector('span').textContent).toBe('20');
  });

  it('accepts a getter instead of a path', async () => {
    mount(`<div u-data="{ a: 1 }"></div>`);
    const c = document.querySelector('[u-data]').__x;
    const calls = [];

    c.watch(() => c.data.a * 2, (value, old) => calls.push([value, old]));
    c.data.a = 2;
    await tick();

    expect(calls).toEqual([[4, 2]]);
  });
});
