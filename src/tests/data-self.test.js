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
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('Youla.data() "self" bindings', () => {
  it('applies events and :class from "self" to the root', async () => {
    Youla.data('selfToggle', () => ({
      open: false,
      self: {
        '@click'() { this.open = !this.open; },
        ':class'() { return { 'is-open': this.open }; },
      },
    }));

    const root = mount(`<div u-data="selfToggle" class="box"></div>`);
    expect(root.classList.contains('is-open')).toBe(false);

    root.click();
    await tick();

    expect(root.__x.data.open).toBe(true);
    expect(root.classList.contains('is-open')).toBe(true);
    expect(root.classList.contains('box')).toBe(true);
  });

  it('supports event modifiers', async () => {
    Youla.data('selfModifiers', () => ({
      hits: 0,
      self: { '@keydown.window.ctrl.k.prevent'() { this.hits++; } },
    }));

    const root  = mount(`<div u-data="selfModifiers"></div>`);
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    await tick();

    expect(root.__x.data.hits).toBe(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it('keeps "self" out of $data, scope and storage', async () => {
    Youla.data('selfStored', () => ({
      count: 0,
      self: { '@click'() { this.count++; } },
    }));

    const root = mount(`<div u-data.local="selfStored"><span u-text="typeof self === 'object' && self === window"></span></div>`);
    root.click();
    await tick();

    expect(Object.hasOwn(root.__x.rawData, 'self')).toBe(false);
    expect('self' in root.__x.data).toBe(false);
    expect(root.querySelector('span').textContent).toBe('true');
    expect(JSON.parse(localStorage.getItem('u-data:selfStored'))).toEqual({ count: 1 });
  });

  it('lets explicit markup win on a key collision but attaches both event handlers', async () => {
    const markupClick = vi.fn();
    window.markupClick = markupClick;

    Youla.data('selfCollision', () => ({
      clicks: 0,
      self: {
        title: 'from self',
        ':data-state'() { return 'self'; },
        '@click'() { this.clicks++; },
      },
    }));

    const root = mount(`<div u-data="selfCollision" title="from markup" :data-state="'markup'" @click="markupClick()"></div>`);
    root.click();
    await tick();

    expect(root.getAttribute('title')).toBe('from markup');
    expect(root.getAttribute('data-state')).toBe('markup');
    expect(root.__x.data.clicks).toBe(1);
    expect(markupClick).toHaveBeenCalledTimes(1);

    delete window.markupClick;
  });

  it('lets an explicit u-bind on the root win over "self"', () => {
    Youla.data('selfWithBind', () => ({
      wrapper: { ':data-source'() { return 'u-bind'; } },
      self: { ':data-source'() { return 'self'; }, ':data-extra'() { return 'self'; } },
    }));

    const root = mount(`<div u-data="selfWithBind" u-bind="wrapper"></div>`);

    expect(root.getAttribute('data-source')).toBe('u-bind');
    expect(root.getAttribute('data-extra')).toBe('self');
  });

  it('warns about and ignores a non-object "self"', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Youla.data('selfInvalid', () => ({ value: 1, self: 'nope' }));

    const root = mount(`<div u-data="selfInvalid"></div>`);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"self"'));
    expect('self' in root.__x.data).toBe(false);
    expect(root.__x.data.value).toBe(1);
  });

  it('still supports u-bind="wrapper" on the root without "self"', async () => {
    Youla.data('plainWrapper', () => ({
      open: false,
      wrapper: {
        '@click'() { this.open = true; },
        ':class'() { return { 'is-open': this.open }; },
      },
    }));

    const root = mount(`<div u-data="plainWrapper" u-bind="wrapper"></div>`);
    root.click();
    await tick();

    expect(root.classList.contains('is-open')).toBe(true);
  });
});
