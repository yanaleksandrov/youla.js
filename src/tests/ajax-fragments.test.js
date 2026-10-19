import { describe, it, expect, beforeAll, afterEach } from 'vitest';
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
  respond(body) {
    this.status = 200;
    this.responseText = JSON.stringify(body);
    this.onload?.();
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
});

async function request(data) {
  document.body.innerHTML = `
    <div id="box">old</div>
    <div id="later">old</div>
    <button u-data @click="window.request = $ajax.get('/fragments')"></button>
  `;

  const button = document.querySelector('button');
  Youla.componentInitialize(button);
  await tick();

  button.click();
  FakeXHR.last.respond({ data });

  return window.request;
}

describe('$ajax fragments', () => {
  it('applies undelayed actions before the promise resolves', async () => {
    let seen;

    await request([{ target: '#box', update: '<span id="inserted">new</span>' }])
      .then(() => seen = document.querySelector('#inserted')?.textContent);

    expect(seen).toBe('new');
  });

  it('runs delayed actions after the promise resolves', async () => {
    let seen;

    await request([{ target: '#later', 'update:10': 'new' }])
      .then(() => seen = document.querySelector('#later').textContent);

    expect(seen).toBe('old');

    await tick();
    expect(document.querySelector('#later').textContent).toBe('new');
  });
});
