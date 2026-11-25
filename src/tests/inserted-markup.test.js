import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-text';
import '../scripts/directives/u-html';
import '../scripts/directives/u-each';

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeAll(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
  Youla.componentWatch(el => Youla.componentInitialize(el));
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function mount(html) {
  document.body.innerHTML = html;
  const root = document.body.firstElementChild;
  Youla.componentInitialize(root);
  return root;
}

describe('markup inserted into a component', () => {
  it('is initialized as part of the nearest component', async () => {
    const root = mount(`<div u-data="{ name: 'Ann', clicks: 0 }"><div class="slot"></div></div>`);

    root.querySelector('.slot').innerHTML = `<p><span u-text="name"></span><button @click="clicks++"></button></p>`;
    await tick();

    expect(root.querySelector('span').textContent).toBe('Ann');

    root.querySelector('button').click();
    root.__x.data.name = 'Bob';
    await tick();

    expect(root.__x.data.clicks).toBe(1);
    expect(root.querySelector('span').textContent).toBe('Bob');
  });

  it('initializes nested added nodes only once', async () => {
    const root = mount(`<div u-data="{ clicks: 0 }"></div>`);
    const outer = document.createElement('div');

    root.appendChild(outer);
    outer.innerHTML = `<button @click="clicks++"></button>`;
    await tick();

    root.querySelector('button').click();
    await tick();

    expect(root.__x.data.clicks).toBe(1);
  });

  it('gives inserted markup inside a u-each clone its loop variables', async () => {
    const root = mount(`<ul u-data="{ items: ['a', 'b'] }"><li u-each="item in items"><i></i></li></ul>`);
    const clones = root.querySelectorAll('li:not([u-each])');

    clones[1].querySelector('i').innerHTML = `<b u-text="item"></b>`;
    await tick();

    expect(root.querySelector('b').textContent).toBe('b');
  });

  it('binds events inside u-html content after an update, as on the first render', async () => {
    const root = mount(`<div u-data="{ html: '<button @click=&quot;clicks++&quot;>1</button>', clicks: 0 }"><div u-html="html"></div></div>`);

    root.querySelector('button').click();
    root.__x.data.html = '<button @click="clicks++">2</button>';
    await tick();
    root.querySelector('button').click();
    await tick();

    expect(root.__x.data.clicks).toBe(2);
  });

  it('leaves markup outside components alone', async () => {
    document.body.innerHTML = `<div class="free"></div>`;
    document.querySelector('.free').innerHTML = `<span u-text="'x'"></span>`;
    await tick();

    expect(document.querySelector('span').textContent).toBe('');
  });
});

describe('Youla.component()', () => {
  it('returns the nearest component, or null', async () => {
    const root = mount(`<div u-data="{ a: 1 }"><div u-data="{ b: 2 }"><i></i></div><b></b></div>`);
    await tick();
    const inner = root.querySelector('[u-data]');

    expect(Youla.component(root.querySelector('i'))).toBe(inner.__x);
    expect(Youla.component(root.querySelector('b'))).toBe(root.__x);
    expect(Youla.component(root)).toBe(root.__x);
    expect(Youla.component(document.body)).toBeNull();
    expect(Youla.component(root.querySelector('i')).data.b).toBe(2);
  });
});
