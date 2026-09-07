import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';

function initAll() {
  Youla.componentDiscover(el => Youla.componentInitialize(el));
}

function type(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

// Regression: hydrateProps() used to seed a same-named local "user" on a nested u-data component
// instead of writing through to the outer form's, silently shadowing it.
describe('u-prop inside a nested u-data', () => {
  it('writes through to the ancestor property instead of shadowing it locally', async () => {
    document.body.innerHTML = `
      <form u-data="{ user: {} }">
        <div u-data="{ visible: false } as p">
          <input id="pwd" u-prop="user.password">
        </div>
        <button id="submit" :disabled="!(user.password || '').trim()" disabled></button>
      </form>
    `;

    initAll();
    await tick();

    const form   = document.querySelector('form');
    const child  = document.querySelector('div[u-data]');
    const submit = document.getElementById('submit');

    // The nested component must not have created its own local "user".
    expect('user' in child.__x.data).toBe(false);
    // The outer form owns it.
    expect(form.__x.data.user).toEqual({ password: '' });

    type(document.getElementById('pwd'), 'S3cr3t!!');
    await tick();

    expect(form.__x.data.user.password).toBe('S3cr3t!!');
    // A sibling binding elsewhere in the outer form reacts to the nested field's write.
    expect(submit.disabled).toBe(false);
  });

  it('reflects a programmatic write back onto the field once the nested component itself re-renders (u-prop reads through "scope", not just "data")', async () => {
    // "tick" mimics the real password provider's own local state (see youla-expansa.js's
    // generate(), which also mutates local fields as a side effect) — that local write is what
    // wakes the nested component's own refresh(); a pure ancestor-only write wouldn't (see
    // Component#refresh(): each component only walks its own subtree).
    document.body.innerHTML = `
      <form u-data="{ user: {} }">
        <div u-data="{ tick: 0 } as p">
          <input id="pwd" u-prop="user.password">
          <button type="button" id="gen" @click="user.password = 'GENERATED'; tick++"></button>
        </div>
      </form>
    `;

    initAll();
    await tick();

    document.getElementById('gen').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();

    expect(document.getElementById('pwd').value).toBe('GENERATED');
  });
});
