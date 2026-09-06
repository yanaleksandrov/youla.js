import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';
import '../scripts/directives/u-show';
import '../scripts/directives/u-text';
import '../youla-expansa';
import '../youla-ajax';

/**
 * Reproduces the install wizard from src/view/examples.html closely enough to answer one
 * question: does `u-step:action="$ajax(...)"` actually call `$ajax` (i.e. open an XHR) the
 * moment the wizard navigates onto that step? A trimmed markup (3 steps instead of 5), no outer
 * `u-data="youla"` wrapper (unrelated to `$ajax`'s own resolution — see component.js's
 * invokeListener: methods are passed as separate saferEval parameters, never through the
 * data/scope proxy at all).
 */
function mountWizard() {
  document.body.innerHTML = `
    <form u-data="{...step, approved: {}, site: {}, db: {}}">
      <div id="step0" u-step="site.name?.trim()">
        <input name="site[name]" u-prop="site.name">
      </div>
      <div id="step1" hidden u-step="[db.database].every(v => v !== undefined && v.trim())" u-step:action="approved = {}">
        <input name="db[database]" u-prop="db.database">
      </div>
      <div id="step2" hidden u-step="Object.values(approved).every(Boolean) === true" u-step:action="$ajax('system/test', db).then(response => approved = response)"></div>
      <button id="next" type="button" @click="goNext()"></button>
    </form>
  `;
  return {
    form: document.querySelector('form'),
    siteInput: document.querySelector('input[name="site[name]"]'),
    dbInput: document.querySelector('input[name="db[database]"]'),
    next: document.getElementById('next'),
  };
}

function type(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

// Real setTimeout(0)-based debounce (component.js's refresh()) needs a real tick to flush.
function tick(ms = 10) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class FakeXHR {
  constructor() {
    this.upload = {};
    FakeXHR.instances.push(this);
  }
  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader() {}
  send(body) { this.body = body; } // left pending on purpose — we only care whether it was opened
  abort() {}
}
FakeXHR.instances = [];

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
  FakeXHR.instances = [];
  vi.stubGlobal('XMLHttpRequest', FakeXHR);
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('u-step:action', () => {
  it('calls $ajax the moment the wizard navigates onto the step carrying it', async () => {
    const { form, siteInput, dbInput, next } = mountWizard();

    Youla.componentInitialize(form);
    await tick();

    // Step 0 -> 1: fill the site name, then advance.
    type(siteInput, 'My Site');
    await tick();
    click(next);
    await tick();

    // Entering step 1 should have reset "approved" via its own action, and NOT called $ajax yet.
    expect(FakeXHR.instances.length).toBe(0);

    // Step 1 -> 2: fill the db field, then advance onto the $ajax step.
    type(dbInput, 'mydb');
    await tick();
    click(next);
    await tick();

    expect(FakeXHR.instances.length).toBe(1);
    expect(FakeXHR.instances[0].method).toBe('GET');
    expect(FakeXHR.instances[0].url).toContain('system/test');
  });
});
