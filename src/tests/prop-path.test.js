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
});
