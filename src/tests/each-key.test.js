import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-each';
import '../scripts/directives/u-text';

function initAll() {
  Youla.componentDiscover(el => Youla.componentInitialize(el));
}

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function rows() {
  return [...document.querySelectorAll('#root li:not([u-each])')];
}

function texts() {
  return rows().map(el => el.textContent);
}

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

const items = `[{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }]`;

const variants = {
  'u-key on <template>': `
    <ul id="root" u-data="{ items: ${items} }">
      <template u-each="(item, i) in items" u-key="item.id"><li u-text="i + ':' + item.name"></li></template>
    </ul>
  `,
  ':key on a loop element': `
    <ul id="root" u-data="{ items: ${items} }">
      <li u-each="(item, i) in items" :key="item.id" u-text="i + ':' + item.name"></li>
    </ul>
  `,
  'u-key in a u-bind set': `
    <ul id="root" u-data="{ items: ${items}, list: { 'u-each': '(item, i) in items', 'u-key': 'item.id' } }">
      <template u-bind="list"><li u-text="i + ':' + item.name"></li></template>
    </ul>
  `,
};

Object.entries(variants).forEach(([title, markup]) => {
  describe(`keyed u-each: ${title}`, () => {
    it('keeps the other nodes when one item is replaced', async () => {
      document.body.innerHTML = markup;
      initAll();
      await tick();

      const before = rows();
      expect(texts()).toEqual(['0:a', '1:b', '2:c']);

      const data = document.getElementById('root').__x.data;
      data.items = data.items.map(item => item.id === 2 ? { ...item, name: 'B' } : item);
      await tick();

      const after = rows();
      expect(texts()).toEqual(['0:a', '1:B', '2:c']);
      after.forEach((node, idx) => expect(node).toBe(before[idx]));
    });

    it('keeps the remaining nodes and updates their index when one is removed', async () => {
      document.body.innerHTML = markup;
      initAll();
      await tick();

      const [first, , third] = rows();

      const data = document.getElementById('root').__x.data;
      data.items = data.items.filter(item => item.id !== 2);
      await tick();

      expect(texts()).toEqual(['0:a', '1:c']);
      expect(rows()[0]).toBe(first);
      expect(rows()[1]).toBe(third);
    });

    it('reorders reused nodes and creates new keys', async () => {
      document.body.innerHTML = markup;
      initAll();
      await tick();

      const [first, second, third] = rows();

      const data = document.getElementById('root').__x.data;
      data.items = [data.items[2], { id: 4, name: 'd' }, data.items[0], data.items[1]];
      await tick();

      expect(texts()).toEqual(['0:c', '1:d', '2:a', '3:b']);
      expect(rows()[0]).toBe(third);
      expect(rows()[2]).toBe(first);
      expect(rows()[3]).toBe(second);
    });
  });
});

describe('keyed u-each', () => {
  it('re-renders a reused node after an in-place mutation of its item', async () => {
    document.body.innerHTML = `
      <ul id="root" u-data="{ items: ${items} }">
        <template u-each="item in items" u-key="item.id"><li u-text="item.name"></li></template>
      </ul>
    `;
    initAll();
    await tick();

    const before = rows();
    document.getElementById('root').__x.data.items[0].name = 'A';
    await tick();

    expect(texts()).toEqual(['A', 'b', 'c']);
    expect(rows()[0]).toBe(before[0]);
  });

  it('keeps join separators between items only', async () => {
    document.body.innerHTML = `
      <p id="root" u-data="{ items: ${items} }"><template u-each="item in items join ', '" u-key="item.id"><i u-text="item.name"></i></template></p>
    `;
    initAll();
    await tick();

    expect(document.getElementById('root').textContent).toBe('a, b, c');

    const data = document.getElementById('root').__x.data;
    data.items = data.items.filter(item => item.id !== 3);
    await tick();

    expect(document.getElementById('root').textContent).toBe('a, b');
  });

  it('updates nested loops inside reused nodes', async () => {
    document.body.innerHTML = `
      <div id="root" u-data="{ groups: [{ id: 1, tags: ['x'] }, { id: 2, tags: ['y'] }] }">
        <template u-each="group in groups" u-key="group.id">
          <section><template u-each="tag in group.tags" u-key="tag"><b u-text="tag"></b></template></section>
        </template>
      </div>
    `;
    initAll();
    await tick();

    const sections = [...document.querySelectorAll('#root section')];
    const data = document.getElementById('root').__x.data;
    data.groups = [{ ...data.groups[0], tags: ['x', 'z'] }, data.groups[1]];
    await tick();

    expect([...document.querySelectorAll('#root section')]).toEqual(sections);
    expect([...sections[0].querySelectorAll('b')].map(el => el.textContent)).toEqual(['x', 'z']);
    expect([...sections[1].querySelectorAll('b')].map(el => el.textContent)).toEqual(['y']);
  });
});

describe('u-each without a key', () => {
  it('reuses nodes of the same objects on add and remove', async () => {
    document.body.innerHTML = `
      <ul id="root" u-data="{ items: ${items} }">
        <template u-each="(item, i) in items"><li u-text="i + ':' + item.name"></li></template>
      </ul>
    `;
    initAll();
    await tick();

    const [first, , third] = rows();
    const data = document.getElementById('root').__x.data;

    data.items = [...data.items, { id: 4, name: 'd' }];
    await tick();
    data.items = data.items.filter(item => item.id !== 2);
    await tick();

    expect(texts()).toEqual(['0:a', '1:c', '2:d']);
    expect(rows()[0]).toBe(first);
    expect(rows()[1]).toBe(third);
  });

  it('reuses nodes of primitive values', async () => {
    document.body.innerHTML = `
      <ul id="root" u-data="{ items: ['a', 'b', 'c'] }">
        <li u-each="item in items" u-text="item"></li>
      </ul>
    `;
    initAll();
    await tick();

    const [a, , c] = rows();
    document.getElementById('root').__x.data.items.splice(1, 1);
    await tick();

    expect(texts()).toEqual(['a', 'c']);
    expect(rows()).toEqual([a, c]);
  });

  it('updates a notice-like card in place when its item is mutated', async () => {
    document.body.innerHTML = `
      <div id="root" u-data="{
        items: [{ id: 1, hiding: false }, { id: 2, hiding: false }],
        card: { ':class': 'classes(item)' },
        classes(item) { return 'card' + (item.hiding ? ' is-hiding' : ''); },
      }">
        <template u-each="(item, index) in items"><li u-bind="card"></li></template>
      </div>
    `;
    initAll();
    await tick();

    const before = rows();
    const data = document.getElementById('root').__x.data;
    data.items.find(item => item.id === 2).hiding = true;
    await tick();

    expect(rows()).toEqual(before);
    expect(before[1].className).toBe('card is-hiding');

    data.items = data.items.filter(item => item.id !== 2);
    await tick();
    expect(rows()).toEqual([before[0]]);
  });
});
