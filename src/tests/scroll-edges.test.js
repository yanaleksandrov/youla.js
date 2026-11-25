import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';

function initAll() {
  Youla.componentDiscover((el) => Youla.componentInitialize(el));
}

function tick(ms = 20) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// jsdom has no layout, so scroll metrics are stubbed and stay mutable through the returned object.
function stubScroll(el, metrics) {
  const state = { scrollTop: 0, scrollLeft: 0, clientHeight: 100, clientWidth: 100, scrollHeight: 1000, scrollWidth: 1000, ...metrics };
  Object.keys(state).forEach(key => {
    Object.defineProperty(el, key, { configurable: true, get: () => state[key], set: value => { state[key] = value; } });
  });
  return state;
}

function scrollTo(el, metrics, target = el) {
  Object.assign(el, metrics);
  target.dispatchEvent(new Event('scroll'));
}

async function mount(html, metrics) {
  document.body.innerHTML = html;
  const list = document.querySelector('.list');
  const state = stubScroll(list, metrics);
  initAll();
  await tick();
  return { list, state, data: document.querySelector('[u-data]').__x.data };
}

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('@scroll edge modifiers', () => {
  it.each([
    ['top', { scrollTop: 500 }, { scrollTop: 0 }],
    ['bottom', { scrollTop: 0 }, { scrollTop: 900 }],
    ['left', { scrollLeft: 500 }, { scrollLeft: 0 }],
    ['right', { scrollLeft: 0 }, { scrollLeft: 900 }],
  ])('.%s fires only at its edge', async (edge, away, at) => {
    const { list, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.${edge}="count++"></div></div>`, away);
    expect(data.count).toBe(0);

    scrollTo(list, { scrollTop: 500, scrollLeft: 500 });
    expect(data.count).toBe(0);

    scrollTo(list, at);
    expect(data.count).toBe(1);
  });

  it('.block fires at the top or bottom edge, .inline at the left or right edge', async () => {
    document.body.innerHTML = `
      <div u-data="{ block: 0, inline: 0 }">
        <div class="list" @scroll.block="block++" @scroll.inline="inline++"></div>
      </div>`;
    const list = document.querySelector('.list');
    stubScroll(list, { scrollTop: 500, scrollLeft: 500 });
    initAll();
    await tick();
    const data = document.querySelector('[u-data]').__x.data;

    scrollTo(list, { scrollTop: 0 });
    scrollTo(list, { scrollTop: 900 });
    scrollTo(list, { scrollTop: 500, scrollLeft: 0 });
    scrollTo(list, { scrollLeft: 900 });

    expect(data.block).toBe(2);
    expect(data.inline).toBe(2);
  });

  it('combines edges with "or": .top.bottom behaves like .block', async () => {
    const { list, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.top.bottom="count++"></div></div>`, { scrollTop: 500 });

    scrollTo(list, { scrollTop: 0 });
    scrollTo(list, { scrollTop: 900 });
    expect(data.count).toBe(2);
  });

  it('fires on every event inside the zone and stays silent outside it', async () => {
    const { list, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.bottom="count++"></div></div>`, { scrollTop: 0 });

    scrollTo(list, { scrollTop: 900 });
    scrollTo(list, { scrollTop: 899.5 });
    scrollTo(list, { scrollTop: 900 });
    expect(data.count).toBe(3);

    scrollTo(list, { scrollTop: 800 });
    expect(data.count).toBe(3);
  });

  it('uses a 1px tolerance without an offset', async () => {
    const { list, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.bottom="count++"></div></div>`, { scrollTop: 0 });

    scrollTo(list, { scrollTop: 898 });
    expect(data.count).toBe(0);

    scrollTo(list, { scrollTop: 899 });
    expect(data.count).toBe(1);
  });

  it('.200px widens the edge zone', async () => {
    const { list, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.bottom.200px="count++"></div></div>`, { scrollTop: 0 });

    scrollTo(list, { scrollTop: 699 });
    expect(data.count).toBe(0);

    scrollTo(list, { scrollTop: 700 });
    expect(data.count).toBe(1);
  });

  it('.50% is measured against the current scroll area size on every event', async () => {
    const { list, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.top.50%="count++"></div></div>`, { scrollTop: 500 });

    scrollTo(list, { scrollTop: 60 });
    expect(data.count).toBe(0);

    scrollTo(list, { scrollTop: 50 });
    expect(data.count).toBe(1);

    scrollTo(list, { clientHeight: 200, scrollTop: 100 });
    expect(data.count).toBe(2);
  });

  it('.50% on left/right is measured against the width', async () => {
    const { list, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.right.50%="count++"></div></div>`, { clientWidth: 200, clientHeight: 10 });

    scrollTo(list, { scrollLeft: 699 });
    expect(data.count).toBe(0);

    scrollTo(list, { scrollLeft: 700 });
    expect(data.count).toBe(1);
  });

  it('fires once right after mounting when the content already fits', async () => {
    const { data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.bottom="count++"></div></div>`, { scrollHeight: 100 });
    expect(data.count).toBe(1);
  });

  it('does not fire initially when the scroll position is away from the edge', async () => {
    const { data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.bottom="count++"></div></div>`, { scrollTop: 0 });
    expect(data.count).toBe(0);
  });

  it('.lazy skips the initial call and fires on the first scroll in the zone', async () => {
    const { list, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.top.lazy="count++"></div></div>`, { scrollTop: 0 });
    expect(data.count).toBe(0);

    scrollTo(list, { scrollTop: 0 });
    expect(data.count).toBe(1);
  });

  it('.lazy.once fires once on the first scroll in the zone', async () => {
    const { list, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.bottom.lazy.once="count++"></div></div>`, { scrollHeight: 100 });
    expect(data.count).toBe(0);

    scrollTo(list, { scrollTop: 0 });
    scrollTo(list, { scrollTop: 0 });
    expect(data.count).toBe(1);
  });

  it('.once counts the initial call and stops listening afterwards', async () => {
    const { list, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.bottom.once="count++"></div></div>`, { scrollHeight: 100 });
    expect(data.count).toBe(1);

    scrollTo(list, { scrollTop: 0 });
    expect(data.count).toBe(1);
  });

  it('.once waits for the edge instead of being spent on the first scroll event', async () => {
    const { list, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.bottom.once="count++"></div></div>`, { scrollTop: 0 });

    scrollTo(list, { scrollTop: 300 });
    expect(data.count).toBe(0);

    scrollTo(list, { scrollTop: 900 });
    scrollTo(list, { scrollTop: 900 });
    expect(data.count).toBe(1);
  });

  it('a synthetic dispatchEvent(new Event("scroll")) triggers the check', async () => {
    const { list, state, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.bottom="count++"></div></div>`, { scrollTop: 0 });

    state.scrollHeight = 100;
    list.dispatchEvent(new Event('scroll'));
    expect(data.count).toBe(1);
  });

  it('works together with .delay', async () => {
    const { list, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" @scroll.passive.bottom.delay.30ms="count++"></div></div>`, { scrollTop: 0 });

    scrollTo(list, { scrollTop: 500 });
    scrollTo(list, { scrollTop: 900 });
    scrollTo(list, { scrollTop: 900 });
    expect(data.count).toBe(0);

    await tick(60);
    expect(data.count).toBe(1);
  });

  it('.window checks the document scrolling element', async () => {
    const root = document.scrollingElement || document.documentElement;
    const state = stubScroll(root, { scrollTop: 0 });

    document.body.innerHTML = `<div u-data="{ count: 0 }" @scroll.window.passive.bottom="count++"></div>`;
    initAll();
    await tick();
    const data = document.querySelector('[u-data]').__x.data;
    expect(data.count).toBe(0);

    state.scrollTop = 900;
    window.dispatchEvent(new Event('scroll'));
    expect(data.count).toBe(1);

    ['scrollTop', 'scrollLeft', 'clientHeight', 'clientWidth', 'scrollHeight', 'scrollWidth'].forEach(key => delete root[key]);
  });

  it.each([
    ['left', 0, -900],
    ['right', -900, 0],
  ])('RTL: .%s stays silent at scrollLeft %i and fires at %i', async (edge, away, at) => {
    const { list, data } = await mount(`<div u-data="{ count: 0 }"><div class="list" style="direction: rtl" @scroll.${edge}="count++"></div></div>`, { scrollLeft: away });
    expect(data.count).toBe(0);

    scrollTo(list, { scrollLeft: at });
    expect(data.count).toBe(1);
  });

  it('works when declared in a u-bind set', async () => {
    document.body.innerHTML = `<div u-data="{ count: 0 }"><div class="list" u-bind="{ '@scroll.bottom.50%'() { this.count++ } }"></div></div>`;
    const list = document.querySelector('.list');
    stubScroll(list, { scrollTop: 0 });
    initAll();
    await tick();
    const data = document.querySelector('[u-data]').__x.data;

    scrollTo(list, { scrollTop: 850 });
    expect(data.count).toBe(1);
    expect(list.hasAttribute('@scroll.bottom.50%')).toBe(false);
  });
});

describe('edge names stay key filters outside @scroll', () => {
  it('@keydown.left still reacts to the left arrow only', async () => {
    document.body.innerHTML = `<div u-data="{ count: 0 }"><input @keydown.left="count++"></div>`;
    initAll();
    await tick();

    const input = document.querySelector('input');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(document.querySelector('[u-data]').__x.data.count).toBe(1);
  });

  it('@keydown.enter.200px ignores the offset when matching keys', async () => {
    document.body.innerHTML = `<div u-data="{ count: 0 }"><input @keydown.enter.200px="count++"></div>`;
    initAll();
    await tick();

    const input = document.querySelector('input');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(document.querySelector('[u-data]').__x.data.count).toBe(1);
  });
});
