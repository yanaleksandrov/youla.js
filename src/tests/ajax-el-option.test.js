import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';
import '../youla-ajax';

// jsdom has no CSS.escape() or scrollIntoView() — polyfilled for findField() and showErrors().
if (typeof CSS === 'undefined' || !CSS.escape) {
  globalThis.CSS = globalThis.CSS || {};
  globalThis.CSS.escape = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\${ch}`);
}

Element.prototype.scrollIntoView ??= () => {};

// Holds every request until the test answers it.
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
  respond(status, data = {}) {
    this.status = status;
    this.responseText = JSON.stringify(data);
    this.onload?.();
    this.onloadend?.({});
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

const results = [];

beforeAll(() => {
  window.Youla = Youla;
  window.XMLHttpRequest = FakeXHR;
  window.track = promise => (results.push(promise.catch(error => error)), promise.catch(() => {}));
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
  FakeXHR.all = [];
  results.length = 0;
  vi.restoreAllMocks();
});

describe('$ajax "el" option', () => {
  it('without "el" aborts the previous request of the same element', async () => {
    const root = mount(`<div u-data><button @click="track($ajax.post('route', {a: 1}))"></button></div>`);
    await tick();

    const button = root.querySelector('button');
    button.click();
    button.click();

    expect(FakeXHR.all).toHaveLength(2);
    expect(FakeXHR.all[0].abort).toHaveBeenCalled();
    expect((await results[0]).name).toBe('AbortError');
    expect([...FakeXHR.all[1].body.entries()]).toEqual([['a', '1']]);
  });

  it('with {el: $root} shares one request stream and loading state across buttons', async () => {
    const root = mount(`
      <div u-data>
        <button id="one" @click="track($ajax.post('filter', null, null, {el: $root}))"></button>
        <button id="two" @click="track($ajax.post('filter', null, null, {el: $root}))"></button>
      </div>
    `);
    await tick();

    const one = root.querySelector('#one');
    const two = root.querySelector('#two');
    one.click();

    expect(root.classList.contains('is-loading')).toBe(true);
    expect(root.getAttribute('aria-busy')).toBe('true');
    expect(one.classList.contains('is-loading')).toBe(false);

    two.click();

    expect(FakeXHR.all[0].abort).toHaveBeenCalled();
    expect((await results[0]).name).toBe('AbortError');
    expect(two.classList.contains('is-loading')).toBe(false);
    expect(root.classList.contains('is-loading')).toBe(true);

    FakeXHR.all[1].respond(200);

    expect(root.classList.contains('is-loading')).toBe(false);
    expect(root.hasAttribute('aria-busy')).toBe(false);
  });

  it('reports the target element in the "ajax:route" event', async () => {
    const root = mount(`<div u-data><button @click="track($ajax.post('saved', null, null, {el: $root}))"></button></div>`);
    await tick();

    const seen = vi.fn();
    document.addEventListener('ajax:saved', e => seen(e.detail.el), { once: true });
    root.querySelector('button').click();
    FakeXHR.all[0].respond(200);

    expect(seen).toHaveBeenCalledWith(root);
  });

  it('with {el: form} sends the form fields plus the payload', async () => {
    const root = mount(`
      <div u-data>
        <form u-ref="form"><input name="title" value="Hello"></form>
        <button name="ignored" value="x" @click="track($ajax.post('save', {extra: 'yes'}, null, {el: $refs.form}))"></button>
      </div>
    `);
    await tick();

    root.querySelector('button').click();

    expect([...FakeXHR.all[0].body.entries()]).toEqual([['title', 'Hello'], ['extra', 'yes']]);
  });

  it('sends only the payload for a non-form target', async () => {
    const root = mount(`<div u-data><input name="q" value="term" @input="track($ajax.post('search', {page: 2}, null, {el: $root}))"></div>`);
    await tick();

    root.querySelector('input').dispatchEvent(new Event('input'));

    expect([...FakeXHR.all[0].body.entries()]).toEqual([['page', '2']]);
  });

  it('shows response errors in the target scope', async () => {
    const root = mount(`
      <div u-data>
        <input id="outside" name="title">
        <form u-ref="form"><input id="inside" name="title"></form>
        <button @click="track($ajax.post('save', null, null, {el: $refs.form}))"></button>
      </div>
    `);
    await tick();

    root.querySelector('button').click();
    FakeXHR.all[0].respond(422, { errors: { title: ['Required.'] } });

    expect(root.querySelector('#inside').getAttribute('aria-invalid')).toBe('true');
    expect(root.querySelector('#outside').hasAttribute('aria-invalid')).toBe(false);
  });

  it('ignores a non-Element "el" with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const root = mount(`<div u-data><button @click="track($ajax.post('route', null, null, {el: '#nope'}))"></button></div>`);
    await tick();

    const button = root.querySelector('button');
    button.click();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"el"'), '#nope');
    expect(button.classList.contains('is-loading')).toBe(true);
    expect(button.__ajax).toBe(FakeXHR.all[0]);
  });

  it('keeps existing calls without options or with {clearErrors: false} unchanged', async () => {
    const root = mount(`
      <form u-data>
        <input name="title" value="Hi">
        <button type="button" id="plain" @click="track($ajax.post('save', {a: 1}))"></button>
        <button type="button" id="background" @click="track($ajax.post('slug', {b: 2}, null, {clearErrors: false}))"></button>
      </form>
    `);
    await tick();

    const plain = root.querySelector('#plain');
    plain.click();

    expect(plain.__ajax).toBe(FakeXHR.all[0]);
    expect(plain.classList.contains('is-loading')).toBe(true);
    expect([...FakeXHR.all[0].body.entries()]).toEqual([['a', '1']]);

    FakeXHR.all[0].respond(422, { errors: { title: ['Required.'] } });
    const input = root.querySelector('input');
    expect(input.getAttribute('aria-invalid')).toBe('true');

    const background = root.querySelector('#background');
    background.click();

    expect(background.__ajax).toBe(FakeXHR.all[1]);
    expect([...FakeXHR.all[1].body.entries()]).toEqual([['b', '2']]);
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });
});
