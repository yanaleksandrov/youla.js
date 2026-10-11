import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../youla-ajax';

// Holds every request until the test answers it.
class FakeXHR {
  static last = null;
  upload = {};
  status = 0;
  responseText = '';
  open() {}
  setRequestHeader() {}
  abort() {}
  send() {
    FakeXHR.last = this;
  }
  respond(status) {
    this.status = status;
    this.responseText = '{}';
    status ? this.onload?.() : this.onerror?.();
    this.onloadend?.({});
  }
}

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeAll(() => {
  window.Youla = Youla;
  window.XMLHttpRequest = FakeXHR;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
  Youla.ajax = {};
});

describe('$ajax loading state', () => {
  let form, button;

  beforeEach(async () => {
    document.body.innerHTML = `
      <form u-data @submit.prevent="$ajax.post('/save').catch(() => {})">
        <button type="submit">Save</button>
      </form>
    `;

    form   = document.querySelector('form');
    button = form.querySelector('button');
    Youla.componentInitialize(form);
    await tick();
  });

  function submit() {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  function expectLoading(loading, className = 'is-loading') {
    expect(form.classList.contains(className)).toBe(loading);
    expect(button.classList.contains(className)).toBe(loading);
    expect(form.getAttribute('aria-busy')).toBe(loading ? 'true' : null);
  }

  it.each([[200], [422], [0]])('resets after a response with status %s', async (status) => {
    submit();
    expectLoading(true);
    expect(button.hasAttribute('aria-busy')).toBe(false);

    FakeXHR.last.respond(status);
    await tick();
    expectLoading(false);
  });

  it('resets after a superseded request is aborted', async () => {
    submit();
    const first = FakeXHR.last;
    submit();
    expectLoading(true);

    first.respond(200);
    expectLoading(true);

    FakeXHR.last.respond(200);
    await tick();
    expectLoading(false);
  });

  it('uses Youla.ajax.loadingClass', async () => {
    Youla.ajax = { loadingClass: 'busy' };

    submit();
    expectLoading(true, 'busy');
    expect(form.classList.contains('is-loading')).toBe(false);

    FakeXHR.last.respond(200);
    await tick();
    expectLoading(false, 'busy');
  });
});
