import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';
import '../youla-expansa';

function mountWizard() {
  document.body.innerHTML = `
    <form u-data="step">
      <div id="step0" u-step.required>
        <input required u-prop="name" placeholder="name">
      </div>
      <div id="step1" hidden u-step="true"></div>
      <div id="elsewhere" u-elsewhere="'unrelated'"></div>
      <button id="next" type="button" :disabled="cannotGoNext()" @click="goNext()"></button>
    </form>
  `;
  return {
    form: document.querySelector('form'),
    nameInput: document.querySelector('input[u-prop="name"]'),
    elsewhere: document.getElementById('elsewhere'),
    next: document.getElementById('next'),
  };
}

function type(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let elsewhereSpy;

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));

  elsewhereSpy = vi.fn();
  Youla.directive('elsewhere', elsewhereSpy);
});

afterEach(() => {
  document.body.innerHTML = '';
});

// Regression: typing into a required field used to force-refresh the whole component, needlessly
// tearing down unrelated stateful widgets elsewhere in the form (see Component#refresh()).
describe('u-step.required no longer force-refreshes the whole component', () => {
  it('typing in a required field only re-runs that field\'s own step, not unrelated directives', async () => {
    const { form, nameInput, elsewhere, next } = mountWizard();

    Youla.componentInitialize(form);
    await tick();

    const callsAfterInit = elsewhereSpy.mock.calls.length;
    expect(callsAfterInit).toBeGreaterThan(0); // sanity: it did run once, at mount

    type(nameInput, 'Ivan');
    await tick();

    // The step became complete (the real, useful side effect)...
    expect(next.disabled).toBe(false);
    // ...but the unrelated directive elsewhere in the form was not re-invoked by that keystroke.
    expect(elsewhereSpy.mock.calls.length).toBe(callsAfterInit);
  });
});
