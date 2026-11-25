import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeAll(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(html, selector = '[u-data]') {
  document.body.innerHTML = html;
  const root = document.querySelector(selector);
  Youla.componentInitialize(root);
  return root;
}

describe('.form modifier', () => {
  it('reacts to changes of fields in its own form, including ones attached by the form attribute', async () => {
    Youla.data('formWatcher', () => ({
      changed: [],
      self: {
        '@change.form'() { this.changed.push(this.$event.target.name); },
      },
    }));

    const root = mount(`
      <form id="own"><div u-data="formWatcher"></div><input name="inside"></form>
      <input name="outside" form="own">
      <form id="other"><input name="foreign"></form>
    `);

    document.querySelectorAll('input').forEach(input => input.dispatchEvent(new Event('change', { bubbles: true })));
    await tick();

    expect(root.__x.data.changed).toEqual(['inside', 'outside']);
  });

  it('catches events targeting the form itself, once', async () => {
    const root = mount(`<form><button u-data="{ resets: 0 }" @reset.form="resets++"></button></form>`);

    document.querySelector('form').reset();
    await tick();

    expect(root.__x.data.resets).toBe(1);
  });

  it('warns and skips the listener without a form', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mount(`<div u-data @change.form="1"></div>`);

    expect(warn).toHaveBeenCalled();
  });

  it('is removed with the element', async () => {
    const root = mount(`<form><div u-data="{ hits: 0 }" @input.form="hits++"><input></div></form>`);
    const form = document.querySelector('form');
    const component = root.__x;

    form.remove();
    await tick();
    document.body.appendChild(form);
    form.querySelector('input').dispatchEvent(new Event('input', { bubbles: true }));

    expect(component.data.hits).toBe(0);
  });
});

describe('.self modifier', () => {
  it('runs only for events dispatched on the element itself', async () => {
    const root = mount(`<div u-data="{ hits: 0 }" @click.self="hits++"><button></button></div>`);

    root.querySelector('button').click();
    await tick();
    expect(root.__x.data.hits).toBe(0);

    root.click();
    await tick();
    expect(root.__x.data.hits).toBe(1);
  });

  it('combines with other modifiers', async () => {
    const root = mount(`<div u-data="{ hits: 0 }" @keydown.self.enter.prevent="hits++"><input></div>`);
    const inner = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    const own   = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });

    root.querySelector('input').dispatchEvent(inner);
    root.dispatchEvent(own);
    await tick();

    expect(root.__x.data.hits).toBe(1);
    expect(inner.defaultPrevented).toBe(false);
    expect(own.defaultPrevented).toBe(true);
  });
});
