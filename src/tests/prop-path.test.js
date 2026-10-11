import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';
import '../scripts/directives/u-show';
import '../scripts/directives/u-text';

/**
 * `u-prop` must accept dot notation ("user.firstName"), bracket notation ("user[firstName]",
 * PHP/HTML-form style), or a mix of both ("items[0].name"/"user[address][city]"), to any depth —
 * not just plain top-level names. Bracket segments are unquoted identifiers ("user[firstName]"),
 * so evaluating them as if they were literal JS (as every other directive's expression is) reads
 * "firstName" as a variable instead of a string key and throws/produces "undefined".
 */
// jsdom has no CSS.escape() — polyfilled so hydrateProps()'s checkbox branch is exercised.
if (typeof CSS === 'undefined' || !CSS.escape) {
  globalThis.CSS = globalThis.CSS || {};
  globalThis.CSS.escape = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function type(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function tick(ms = 10) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('u-prop nested paths', () => {
  it('hydrates and reacts through bracket-notation ("user[firstName]")', async () => {
    document.body.innerHTML = `
      <form u-data="{}">
        <input u-prop="user[firstName]" placeholder="name">
        <span u-text="user.firstName"></span>
      </form>
    `;
    const form  = document.querySelector('form');
    const input = document.querySelector('input');
    const span  = document.querySelector('span');

    Youla.componentInitialize(form);
    await tick();

    expect(input.value).toBe('');

    type(input, 'Ivan');
    await tick();

    expect(span.textContent).toBe('Ivan');
  });

  it('hydrates and reacts through mixed dot/bracket paths ("user[address].city")', async () => {
    document.body.innerHTML = `
      <form u-data="{}">
        <input u-prop="user[address].city" placeholder="city">
        <span u-text="user.address.city"></span>
      </form>
    `;
    const form  = document.querySelector('form');
    const input = document.querySelector('input');
    const span  = document.querySelector('span');

    Youla.componentInitialize(form);
    await tick();

    type(input, 'Kyiv');
    await tick();

    expect(span.textContent).toBe('Kyiv');
  });

  it('creates deeper segments under a root key another u-prop already created', async () => {
    document.body.innerHTML = `
      <form u-data>
        <input type="checkbox" id="b" u-prop="a.b">
        <input type="checkbox" id="x" u-prop="a.c.x">
        <input type="checkbox" id="y" u-prop="a.c.y">
      </form>
    `;
    const form = document.querySelector('form');

    Youla.componentInitialize(form);
    await tick();

    expect(form.__x.data.a).toEqual({ b: false, c: { x: false, y: false } });

    for (const id of ['b', 'x', 'y']) {
      document.getElementById(id).click();
      await tick();
    }

    expect(form.__x.data.a).toEqual({ b: true, c: { x: true, y: true } });
  });
});
