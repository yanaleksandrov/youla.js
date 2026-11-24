import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-text';
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

describe('$ajax fragments inside a component', () => {
  async function mountBoard(data) {
    document.body.innerHTML = `
      <div u-data="{ count: 0, label: 'hi' }">
        <div id="card">old</div>
        <ul id="list"><li>first</li></ul>
        <button id="load" @click="window.request = $ajax.get('/fragments')"></button>
      </div>
    `;

    Youla.componentInitialize(document.querySelector('[u-data]'));
    await tick();

    document.querySelector('#load').click();
    FakeXHR.last.respond({ data });
    await window.request;
    await tick();
  }

  it('binds events and bindings in markup inserted by "replace"', async () => {
    await mountBoard([{ target: '#card', replace: '<div id="card" @click="count++"><span u-text="count"></span></div>' }]);

    document.querySelector('#card').click();
    await tick();

    expect(document.querySelector('#card span').textContent).toBe('1');
  });

  it('binds the new children of an "update" target', async () => {
    await mountBoard([{ target: '#card', update: '<b :title="label" u-text="label"></b>' }]);

    const b = document.querySelector('#card b');
    expect(b.textContent).toBe('hi');
    expect(b.getAttribute('title')).toBe('hi');
  });

  it('binds markup inserted by "append" without re-binding existing nodes', async () => {
    await mountBoard([{ target: '#list', append: '<li @click="count++" u-text="count"></li>' }]);

    const items = document.querySelectorAll('#list li');
    expect(items).toHaveLength(2);

    items[1].click();
    await tick();

    expect(items[1].textContent).toBe('1');
    expect(items[0].textContent).toBe('first');
  });

  it('leaves a nested "u-data" root to be constructed with its own scope', async () => {
    Youla.componentWatch(el => Youla.componentInitialize(el));
    await mountBoard([{ target: '#card', update: '<div id="inner" u-data="{ label: \'own\' }"><i u-text="label"></i></div>' }]);

    expect(document.querySelector('#inner i').textContent).toBe('own');
  });
});
