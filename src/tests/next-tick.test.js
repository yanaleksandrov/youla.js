import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-text';
import '../scripts/methods/$dispatch';
import '../scripts/methods/$nextTick';

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

describe('$nextTick()', () => {
  it('resolves after pending changes are applied to the DOM', async () => {
    let seen;

    Youla.data('nextTickDom', () => ({
      count: 0,
      async increment() {
        this.count++;
        await this.$nextTick();
        seen = this.$refs.label.textContent;
      },
    }));

    const root = mount(`<div u-data="nextTickDom" @click="increment()"><span u-ref="label" u-text="count"></span></div>`);
    root.click();
    await tick();

    expect(seen).toBe('1');
  });

  it('calls the callback and resolves in the next microtask when nothing is scheduled', async () => {
    const root     = mount(`<div u-data="{}"></div>`);
    const callback = vi.fn();
    const promise  = root.__x.nextTick(callback);

    expect(callback).not.toHaveBeenCalled();
    await promise;
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('waits for a write made right after the call', async () => {
    const root = mount(`<div u-data="{ text: 'a' }"><span u-text="text"></span></div>`);
    const promise = root.__x.nextTick();

    root.__x.data.text = 'b';
    await promise;

    expect(root.querySelector('span').textContent).toBe('b');
  });

  it('lets $dispatch("change") reach regular change listeners', async () => {
    const listener = vi.fn();

    Youla.data('nextTickChange', () => ({
      value: 1,
      async changed() {
        this.value++;
        await this.$nextTick();
        this.$dispatch('change');
      },
    }));

    const root = mount(`<div u-data="nextTickChange" @click="changed()"></div>`);
    document.addEventListener('change', listener);
    root.click();
    await tick();
    document.removeEventListener('change', listener);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].target).toBe(root);
  });
});
