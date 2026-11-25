import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-text';

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function mount(html) {
  document.body.innerHTML = html;
  const root = document.body.firstElementChild;
  Youla.componentInitialize(root);
  return root;
}

beforeAll(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('lazy custom variables', () => {
  it('runs a factory only for expressions that read it, once per evaluation', async () => {
    const unused = vi.fn(() => 'unused');
    const used   = vi.fn(() => ({ name: 'Ann' }));

    Youla.variable('lazyUnused', unused);
    Youla.variable('lazyUsed', used);

    const root = mount(`
      <div u-data="{ n: 0 }">
        <span u-text="n"></span>
        <b u-text="$lazyUsed.name + $lazyUsed.name"></b>
      </div>
    `);

    expect(root.querySelector('b').textContent).toBe('AnnAnn');
    expect(unused).not.toHaveBeenCalled();
    expect(used).toHaveBeenCalledTimes(1);

    root.__x.flush(true);
    expect(unused).not.toHaveBeenCalled();
    expect(used).toHaveBeenCalledTimes(2);
  });
});

describe('$refs cache', () => {
  it('finds refs added, moved or removed between renders', async () => {
    const root = mount(`<div u-data="{ n: 0 }" @click="n = $refs.target ? $refs.target.id : 'none'"><i id="a" u-ref="target"></i></div>`);

    root.click();
    await tick();
    expect(root.__x.data.n).toBe('a');

    root.querySelector('i').remove();
    root.click();
    await tick();
    expect(root.__x.data.n).toBe('none');

    root.insertAdjacentHTML('beforeend', '<i id="b"></i>');
    root.querySelector('#b').setAttribute('u-ref', 'target');
    root.click();
    await tick();
    expect(root.__x.data.n).toBe('b');
  });
});
