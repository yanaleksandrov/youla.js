import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';

function initAll() {
  Youla.componentDiscover((el) => Youla.componentInitialize(el));
}

function tick(ms = 20) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('@event modifiers — core behaviors', () => {
  it('.prevent calls preventDefault before the handler runs', async () => {
    document.body.innerHTML = `
      <form u-data="{ submitted: false }">
        <button type="submit" @click.prevent="submitted = true"></button>
      </form>
    `;
    initAll();
    await tick();

    const btn = document.querySelector('button');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    btn.dispatchEvent(event);
    await tick();

    expect(event.defaultPrevented).toBe(true);
    expect(document.querySelector('form').__x.data.submitted).toBe(true);
  });

  it('.stop stops propagation to an ancestor listener', async () => {
    document.body.innerHTML = `
      <div u-data="{ outerCalled: false, innerCalled: false }" @click="outerCalled = true">
        <button id="btn" @click.stop="innerCalled = true"></button>
      </div>
    `;
    initAll();
    await tick();

    document.getElementById('btn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();

    const data = document.querySelector('[u-data]').__x.data;
    expect(data.innerCalled).toBe(true);
    expect(data.outerCalled).toBe(false);
  });

  it('.once only fires the handler on the first event', async () => {
    document.body.innerHTML = `
      <div u-data="{ count: 0 }">
        <button id="btn" @click.once="count++"></button>
      </div>
    `;
    initAll();
    await tick();

    const btn = document.getElementById('btn');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();

    expect(document.querySelector('[u-data]').__x.data.count).toBe(1);
  });

  it('.delay debounces rapid calls into a single trailing invocation', async () => {
    document.body.innerHTML = `
      <div u-data="{ count: 0 }">
        <button id="btn" @click.delay.50ms="count++"></button>
      </div>
    `;
    initAll();
    await tick();

    const btn = document.getElementById('btn');
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await tick(10);
    expect(document.querySelector('[u-data]').__x.data.count).toBe(0);

    await tick(80);
    expect(document.querySelector('[u-data]').__x.data.count).toBe(1);
  });

  it('.enter key modifier only fires for the Enter key', async () => {
    document.body.innerHTML = `
      <div u-data="{ count: 0 }">
        <input id="inp" @keydown.enter="count++">
      </div>
    `;
    initAll();
    await tick();

    const input = document.getElementById('inp');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    await tick();

    expect(document.querySelector('[u-data]').__x.data.count).toBe(1);
  });

  it('.outside fires only for a click outside the element', async () => {
    document.body.innerHTML = `
      <div u-data="{ count: 0 }">
        <div id="box" @click.outside="count++" style="width:10px;height:10px;">inside</div>
        <button id="elsewhere">elsewhere</button>
      </div>
    `;
    initAll();
    await tick();

    const box = document.getElementById('box');
    Object.defineProperty(box, 'offsetWidth', { value: 10 });
    Object.defineProperty(box, 'offsetHeight', { value: 10 });

    box.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();
    expect(document.querySelector('[u-data]').__x.data.count).toBe(0);

    document.getElementById('elsewhere').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();
    expect(document.querySelector('[u-data]').__x.data.count).toBe(1);
  });

  it('.window retargets the listener to the element\'s window', async () => {
    document.body.innerHTML = `
      <div u-data="{ resized: false }">
        <div @resize.window="resized = true"></div>
      </div>
    `;
    initAll();
    await tick();

    window.dispatchEvent(new Event('resize'));
    await tick();

    expect(document.querySelector('[u-data]').__x.data.resized).toBe(true);
  });

  it('combines .prevent and .stop together', async () => {
    document.body.innerHTML = `
      <div u-data="{ outer: false, count: 0 }" @click="outer = true">
        <a id="link" href="/" @click.prevent.stop="count++"></a>
      </div>
    `;
    initAll();
    await tick();

    const link = document.getElementById('link');
    const event = new MouseEvent('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    await tick();

    const data = document.querySelector('[u-data]').__x.data;
    expect(event.defaultPrevented).toBe(true);
    expect(data.count).toBe(1);
    expect(data.outer).toBe(false);
  });
});

describe('event handler expressions — additional scenarios', () => {
  it('$event exposes the triggering DOM event', async () => {
    document.body.innerHTML = `
      <div u-data="{ type: '' }">
        <button id="btn" @click="type = $event.type"></button>
      </div>
    `;
    initAll();
    await tick();

    document.getElementById('btn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();

    expect(document.querySelector('[u-data]').__x.data.type).toBe('click');
  });

  it('$el refers to the element the listener is attached to', async () => {
    document.body.innerHTML = `
      <div u-data="{ tag: '' }">
        <button id="btn" @click="tag = $el.tagName"></button>
      </div>
    `;
    initAll();
    await tick();

    document.getElementById('btn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();

    expect(document.querySelector('[u-data]').__x.data.tag).toBe('BUTTON');
  });

  it('a handler can call a method defined on the component data', async () => {
    document.body.innerHTML = `
      <div u-data="{ count: 0, inc() { this.count++; } }">
        <button id="btn" @click="inc()"></button>
      </div>
    `;
    initAll();
    await tick();

    document.getElementById('btn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();

    expect(document.querySelector('[u-data]').__x.data.count).toBe(1);
  });

  it('multiple statements separated by ";" all run', async () => {
    document.body.innerHTML = `
      <div u-data="{ a: 0, b: 0 }">
        <button id="btn" @click="a = 1; b = 2"></button>
      </div>
    `;
    initAll();
    await tick();

    document.getElementById('btn').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await tick();

    const data = document.querySelector('[u-data]').__x.data;
    expect(data.a).toBe(1);
    expect(data.b).toBe(2);
  });
});
