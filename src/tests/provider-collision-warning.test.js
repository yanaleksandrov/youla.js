import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';

function initAll() {
  Youla.componentDiscover(el => Youla.componentInitialize(el));
}

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let warnSpy;

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  document.body.innerHTML = '';
  warnSpy.mockRestore();
});

// Regression: the sign-in form bug — u-data="password" silently resolves to the built-in password-strength provider instead of an empty scope, so u-prop="password" bolts an unexpected field onto it.
describe('u-prop inside a Youla.data() provider warns on an undeclared field', () => {
  it('warns when the field name is not part of the provider\'s own shape', async () => {
    Youla.data('password', () => ({ value: '', visible: false }));

    document.body.innerHTML = `
      <div u-data="password">
        <input u-prop="password">
      </div>
    `;

    initAll();
    await tick();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [message] = warnSpy.mock.calls[0];
    expect(message).toContain('u-prop="password"');
    expect(message).toContain('u-data="password"');
    expect(message).toContain('never declared a "password" field');
  });

  it('does not warn when the field targets a field the provider actually declares', async () => {
    Youla.data('themePicker', () => ({ value: '', visible: false }));

    document.body.innerHTML = `
      <div u-data="themePicker">
        <input u-prop="value">
      </div>
    `;

    initAll();
    await tick();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn for a plain object scope with no registered provider of that name', async () => {
    document.body.innerHTML = `
      <div u-data="{}">
        <input u-prop="anythingGoesHere">
      </div>
    `;

    initAll();
    await tick();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn for a top-level field that is not nested inside any u-data at all', async () => {
    document.body.innerHTML = `
      <div u-data="{ login: '' }">
        <input u-prop="login">
      </div>
    `;

    initAll();
    await tick();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('does not warn when ".up" correctly hoists the field out instead of landing on the provider', async () => {
    Youla.data('passwordBeta', () => ({ value: '', visible: false }));

    document.body.innerHTML = `
      <div u-data="{}">
        <div u-data="passwordBeta">
          <input u-prop.up="passwordBeta">
        </div>
      </div>
    `;

    initAll();
    await tick();

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('still warns with ".up" if there is no ancestor to hoist to, so it falls back to the provider itself', async () => {
    Youla.data('passwordGamma', () => ({ value: '', visible: false }));

    document.body.innerHTML = `
      <div u-data="passwordGamma">
        <input u-prop.up="passwordGamma">
      </div>
    `;

    initAll();
    await tick();

    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  // Regression: an earlier version warned on ANY undeclared field, which fired on step-required.test.js's legitimate u-prop="name"/"db" inside u-data="step" — narrowed to only fire on an exact name echo.
  it('does not warn when a provider is deliberately extended with an unrelated-named field (the "step" wizard pattern)', async () => {
    Youla.data('wizard', () => ({ steps: [], currentIndex: 1 }));

    document.body.innerHTML = `
      <div u-data="wizard">
        <input u-prop="name">
        <input u-prop="db">
      </div>
    `;

    initAll();
    await tick();

    expect(warnSpy).not.toHaveBeenCalled();
  });
});
