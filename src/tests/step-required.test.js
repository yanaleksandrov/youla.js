import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';
import '../scripts/directives/u-show';
import '../youla-expansa';

/**
 * `u-step.required` should gate a step on native checkValidity() of every required field inside
 * it, without needing a hand-written condition, and stay reactive even for fields that carry no
 * "u-prop" (so no reactive data write ever fires for them).
 */
function mountWizard() {
  document.body.innerHTML = `
    <form u-data="step">
      <div id="step0" u-step.required>
        <input required u-prop="name" placeholder="name">
      </div>
      <div id="step1" hidden u-step.required="db.trim().length > 0">
        <input id="plain" required placeholder="no u-prop here">
        <input u-prop="db" placeholder="db name">
      </div>
      <div id="step2" hidden u-step="true"></div>
      <button id="next" type="button" :disabled="cannotGoNext()" @click="goNext()"></button>
    </form>
  `;
  return {
    form: document.querySelector('form'),
    nameInput: document.querySelector('input[u-prop="name"]'),
    plainInput: document.getElementById('plain'),
    dbInput: document.querySelector('input[u-prop="db"]'),
    next: document.getElementById('next'),
  };
}

function type(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// Real setTimeout(0)-based debounce (component.js's refresh()) needs a real tick to flush.
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

describe('u-step.required', () => {
  it('keeps a bare u-step.required (no expression) incomplete until its required field is filled', async () => {
    const { form, nameInput, next } = mountWizard();

    Youla.componentInitialize(form);
    await tick();

    expect(next.disabled).toBe(true);

    type(nameInput, 'Ivan');
    await tick();

    expect(next.disabled).toBe(false);
  });

  it('combines the required-fields check with its own expression (both must hold)', async () => {
    const { form, nameInput, plainInput, dbInput, next } = mountWizard();

    Youla.componentInitialize(form);
    await tick();

    type(nameInput, 'Ivan');
    await tick();
    next.click();
    await tick();

    // On step1: "db" expression is false, and the plain required field is also empty.
    expect(next.disabled).toBe(true);

    type(dbInput, 'mydb');
    await tick();

    // Expression now true, but the plain required field (no u-prop) is still empty.
    expect(next.disabled).toBe(true);

    // A field with no "u-prop" writes no reactive data at all — this exercises the directive's
    // own input/change listener, not the usual concernedData dependency tracking.
    type(plainInput, 'anything');
    await tick();

    expect(next.disabled).toBe(false);
  });
});
