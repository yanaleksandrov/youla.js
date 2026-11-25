import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-text';
import '../scripts/methods/$on';

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

describe('init() and destroy()', () => {
  it('calls init() once after the first render with the component context', async () => {
    const calls = [];

    Youla.data('lifecycleInit', () => ({
      count: 1,
      init() {
        calls.push([this.count, this.$root, this.$refs.label.textContent]);
        this.count++;
      },
    }));

    const root = mount(`<div u-data="lifecycleInit"><span u-ref="label" u-text="count"></span></div>`);
    expect(calls).toEqual([]);

    await tick();
    await root.__x.nextTick();

    expect(calls).toEqual([[1, root, '1']]);
    expect(root.querySelector('span').textContent).toBe('2');
  });

  it('calls destroy() and the function returned by init() when the root is removed', async () => {
    const log = [];

    Youla.data('lifecycleDestroy', () => ({
      init() {
        return () => log.push('cleanup');
      },
      destroy() {
        log.push(`destroy:${this.$root.id}`);
      },
    }));

    const root = mount(`<div id="box" u-data="lifecycleDestroy"></div>`);
    await tick();
    expect(log).toEqual([]);

    root.remove();
    await tick();

    expect(log).toEqual(['destroy:box', 'cleanup']);
  });

  it('supports async init() and logs its errors without breaking the component', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    Youla.data('lifecycleAsync', () => ({
      value: 'a',
      async init() {
        await Promise.resolve();
        throw new Error('boom');
      },
    }));

    const root = mount(`<div u-data="lifecycleAsync"><span u-text="value"></span></div>`);
    await tick();

    expect(errorSpy).toHaveBeenCalledWith('Youla.js: init() failed', root, expect.any(Error));

    root.__x.data.value = 'b';
    await tick();
    expect(root.querySelector('span').textContent).toBe('b');
  });

  it('works with inline u-data objects', async () => {
    const root = mount(`<div u-data="{ ready: false, init() { this.ready = true } }"><span u-text="ready"></span></div>`);
    await tick();

    expect(root.querySelector('span').textContent).toBe('true');
  });
});

describe('$on()', () => {
  it('removes the listener when the component root leaves the DOM', async () => {
    const calls = [];

    Youla.data('onCleanup', () => ({
      init() {
        this.$on(document, 'ping', () => calls.push('ping'));
      },
    }));

    const root = mount(`<div u-data="onCleanup"></div>`);
    await tick();

    document.dispatchEvent(new Event('ping'));
    expect(calls).toEqual(['ping']);

    root.remove();
    await tick();

    document.dispatchEvent(new Event('ping'));
    expect(calls).toEqual(['ping']);
  });

  it('returns a function that removes the listener immediately', async () => {
    const calls = [];

    Youla.data('onOff', () => ({
      init() {
        const off = this.$on(window, 'ping', () => calls.push('ping'));
        window.dispatchEvent(new Event('ping'));
        off();
        window.dispatchEvent(new Event('ping'));
      },
    }));

    mount(`<div u-data="onOff"></div>`);
    await tick();

    expect(calls).toEqual(['ping']);
  });
});
