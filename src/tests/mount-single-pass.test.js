import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';
import '../youla-expansa';

/**
 * Regression: mounting a "u-step" wizard pushes onto the reactive "steps" array as a side
 * effect of the step directive's own first run (see getStep() in youla-expansa.js). That array
 * mutation used to force-refresh the whole component right after mount (Component#observeData),
 * re-running every directive on the page a second time for nothing — see console.log(4324234)
 * in youla-select.js, which used to fire twice for exactly this reason.
 */
function mountWizard() {
  document.body.innerHTML = `
    <form u-data="step">
      <div id="step1" u-step="true" u-spy></div>
      <div id="step2" hidden u-step="true"></div>
    </form>
  `;
  return { form: document.querySelector('form') };
}

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

let spy;

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));

  spy = vi.fn();
  Youla.directive('spy', spy);
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Component#initialize() runs each directive exactly once at mount', () => {
  it('does not re-run a directive after mount just because another directive mutated reactive data during initialize()', async () => {
    mountWizard();
    const { form } = { form: document.querySelector('form') };

    Youla.componentInitialize(form);
    await tick();

    expect(spy.mock.calls.length).toBe(1);
  });
});
