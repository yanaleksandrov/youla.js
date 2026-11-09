import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';

// Regression: hydrateProps() only saw u-prop written as markup, so a u-prop coming from a u-bind set got no seeded value and the input showed "undefined".

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

describe('u-prop from a u-bind set', () => {
  it('seeds the ".up" path on the parent and never renders "undefined"', async () => {
    Youla.data('password', () => (label) => ({
      label,
      input: { 'u-prop.up': 'user.password' },
    }));

    document.body.innerHTML = `
      <form u-data="{ submitted: false } as form">
        <div u-data="password('x') as password">
          <input id="password" u-bind="password.input">
        </div>
      </form>
    `;

    initAll();
    await tick();

    const input = document.getElementById('password');
    const form  = document.querySelector('form').__x;
    const child = document.querySelector('div[u-data]').__x;

    expect(input.value).toBe('');
    expect(form.data.user).toEqual({ password: '' });
    expect(Object.hasOwn(child.rawData, 'user')).toBe(false);

    type(input, 'secret');
    await tick();

    expect(form.data.user.password).toBe('secret');
  });

  it('seeds a plain path on the component itself', async () => {
    document.body.innerHTML = `
      <div u-data="{ field: { 'u-prop': 'profile.name' } }">
        <input id="name" u-bind="field">
      </div>
    `;

    initAll();
    await tick();

    const input = document.getElementById('name');
    expect(input.value).toBe('');
    expect(document.querySelector('div').__x.data.profile).toEqual({ name: '' });
  });
});
