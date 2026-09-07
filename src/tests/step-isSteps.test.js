import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../youla-expansa';

/**
 * isSteps(...values) is isStep()'s variadic sibling: each argument is either an exact index or a
 * [from, to] inclusive range, and it's true as soon as any of them matches the current step.
 */
function mountWizard() {
  document.body.innerHTML = `
    <form u-data="step">
      <div id="step0" u-step="true"></div>
      <div id="step1" hidden u-step="true"></div>
      <div id="step2" hidden u-step="true"></div>
      <div id="step3" hidden u-step="true"></div>
      <div id="step4" hidden u-step="true"></div>
    </form>
  `;
  return { form: document.querySelector('form') };
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

describe('step.isSteps', () => {
  it('matches a bare exact index', async () => {
    const { form } = mountWizard();
    Youla.componentInitialize(form);
    await tick();
    const step = form.__x.data;

    step.goto(2);

    expect(step.isSteps(2)).toBe(true);
    expect(step.isSteps(0)).toBe(false);
  });

  it('matches any of several exact indexes', async () => {
    const { form } = mountWizard();
    Youla.componentInitialize(form);
    await tick();
    const step = form.__x.data;

    step.goto(3);

    expect(step.isSteps(0, 3)).toBe(true);
    expect(step.isSteps(0, 1)).toBe(false);
  });

  it('matches an inclusive [from, to] range', async () => {
    const { form } = mountWizard();
    Youla.componentInitialize(form);
    await tick();
    const step = form.__x.data;

    step.goto(2);
    expect(step.isSteps([1, 3])).toBe(true);

    step.goto(1);
    expect(step.isSteps([1, 3])).toBe(true);

    step.goto(3);
    expect(step.isSteps([1, 3])).toBe(true);

    step.goto(0);
    expect(step.isSteps([1, 3])).toBe(false);

    step.goto(4);
    expect(step.isSteps([1, 3])).toBe(false);
  });

  it('combines exact indexes and a range in the same call', async () => {
    const { form } = mountWizard();
    Youla.componentInitialize(form);
    await tick();
    const step = form.__x.data;

    step.goto(0);
    expect(step.isSteps(0, [2, 4])).toBe(true);

    step.goto(3);
    expect(step.isSteps(0, [2, 4])).toBe(true);

    step.goto(1);
    expect(step.isSteps(0, [2, 4])).toBe(false);
  });
});
