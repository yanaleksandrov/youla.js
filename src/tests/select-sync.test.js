import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';

function tick(ms = 10) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeAll(async () => {
  window.Youla = Youla;
  await import('../youla-select');
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

async function mount(multiple = false) {
  document.body.innerHTML = `
    <div u-data="{item: {target: ${multiple ? "['a']" : "'a'"}}}">
      <select u-prop="item.target" u-select${multiple ? ' multiple' : ''}>
        <option value="a" selected>A</option>
        <option value="b">B</option>
        <option value="c">C</option>
      </select>
    </div>
  `;
  const root = document.querySelector('div');
  Youla.componentInitialize(root);
  await tick();

  let changes = 0;
  root.addEventListener('change', () => changes++);

  return { root, select: root.querySelector('select'), changes: () => changes };
}

describe('u-select syncs with the native select', () => {
  it('shows the value of a newly bound object', async () => {
    const { root, select, changes } = await mount();
    expect(select._x_slimSelect.getSelected()).toEqual(['a']);

    root.__x.data.item = { target: 'c' };
    await tick();

    expect(select.value).toBe('c');
    expect(select._x_slimSelect.getSelected()).toEqual(['c']);
    expect(changes()).toBe(0);
  });

  it('shows the values of a newly bound object for multiple', async () => {
    const { root, select, changes } = await mount(true);
    expect(select._x_slimSelect.getSelected()).toEqual(['a']);

    root.__x.data.item = { target: ['b', 'c'] };
    await tick();

    expect([...select.selectedOptions].map(o => o.value)).toEqual(['b', 'c']);
    expect(select._x_slimSelect.getSelected()).toEqual(['b', 'c']);
    expect(changes()).toBe(0);
  });

  it('stays in sync on a forced refresh', async () => {
    const { root, select, changes } = await mount();

    root.__x.data.item = { target: 'b' };
    root.__x.refresh(true);
    await tick();

    expect(select._x_slimSelect.getSelected()).toEqual(['b']);
    expect(changes()).toBe(0);
  });

  it('stops watching once the instance is destroyed', async () => {
    const { root, select } = await mount();
    const watchers = root.__x.watchers.length;

    select._x_slimSelect.destroy();

    expect(root.__x.watchers.length).toBe(watchers - 1);
  });
});
