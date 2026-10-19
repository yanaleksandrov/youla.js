import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-text';
import '../scripts/methods/$dispatch';
import '../youla-ajax';
import '../youla-select';

class FakeXHR {
  static all = [];
  upload = {};
  status = 0;
  responseText = '';
  open(method, url) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader() {}
  abort = vi.fn();
  send(body) {
    this.body = body;
    FakeXHR.all.push(this);
  }
}

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function mount(html) {
  document.body.innerHTML = html;
  const root = document.body.firstElementChild;
  Youla.componentInitialize(root);
  return root;
}

beforeAll(() => {
  window.Youla = Youla;
  window.XMLHttpRequest = FakeXHR;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
  FakeXHR.all = [];
  delete window.track;
});

describe('methods in directive expressions', () => {
  it('exposes registered methods to u-text', async () => {
    const root = mount(`<div u-data><span u-text="$dispatch ? 'ok' : 'no'"></span></div>`);
    await tick();

    expect(root.querySelector('span').textContent).toBe('ok');
  });

  it('resolves $ajax inside a u-select search closure and aborts the previous request', async () => {
    const requests = [];
    window.track = promise => (requests.push(promise.catch(error => error)), promise);

    const root = mount(`
      <div u-data>
        <select u-select="{events: {search: (text) => track($ajax.post('route', {s: text}))}}">
          <option value="a">A</option>
        </select>
      </div>
    `);
    await tick();

    const search = root.querySelector('select')._x_slimSelect.events.search;
    search('fi', []);
    search('se', []);

    expect(FakeXHR.all).toHaveLength(2);
    expect(FakeXHR.all[0].method).toBe('POST');
    expect(FakeXHR.all[0].url).toContain('route');
    expect(FakeXHR.all[0].abort).toHaveBeenCalled();
    expect(FakeXHR.all[1].abort).not.toHaveBeenCalled();
    expect((await requests[0]).name).toBe('AbortError');
  });

  it('keeps the same $ajax instance across re-evaluations', async () => {
    const seen = [];
    window.track = value => seen.push(value);

    const root = mount(`<div u-data="{count: 0}"><span u-text="(track($ajax), count)"></span></div>`);
    await tick();

    root.__x.data.count++;
    await tick();

    expect(root.querySelector('span').textContent).toBe('1');
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });

  it('does not track methods as reactive dependencies', async () => {
    const root = mount(`<div u-data="{count: 0}"><span u-text="$dispatch && count"></span></div>`);
    await tick();

    const { deps } = root.__x.evaluate('$dispatch && count', root.__x.getHelperVariables(root.querySelector('span')));
    expect(deps).toContain('count');
    expect(deps).not.toContain('$dispatch');
  });

  it('prefers the method over a same-named data property', async () => {
    const root = mount(`<div u-data="{$dispatch: 'data'}"><span u-text="typeof $dispatch"></span></div>`);
    await tick();

    expect(root.querySelector('span').textContent).toBe('function');
  });

  it('still passes the event to methods in event handlers', async () => {
    const factory = vi.fn(() => () => {});
    Youla.method('probe', factory);

    const root = mount(`<div u-data><button @click="$probe(); $ajax.post('route').catch(() => {})"></button></div>`);
    await tick();

    root.querySelector('button').click();

    expect(factory.mock.calls[0][0]).toBeInstanceOf(Event);
    expect(FakeXHR.all).toHaveLength(1);
  });
});
