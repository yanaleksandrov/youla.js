import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';

const providers = {
  pa: vi.fn(() => ({ b: { x: 1 }, kind: 'a' })),
  pb: vi.fn(() => ({ kind: 'b' })),
  pc: vi.fn(() => ({ kind: 'c' })),
  pf: vi.fn(() => n => ({ n })),
};

function mount(html) {
  document.body.innerHTML = html;
  Youla.componentDiscover(el => Youla.componentInitialize(el));
  return document.body.firstElementChild;
}

function calls() {
  return Object.fromEntries(Object.entries(providers).map(([name, fn]) => [name, fn.mock.calls.length]));
}

beforeAll(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
  Object.entries(providers).forEach(([name, fn]) => Youla.data(name, fn));
});

beforeEach(() => {
  Object.values(providers).forEach(fn => fn.mockClear());
});

afterEach(() => {
  document.body.innerHTML = '';
  delete window.pa;
  delete window.someGlobal;
});

describe('u-data calls only the provider named in its expression', () => {
  it('calls the named provider exactly once, with the component root', () => {
    const root = mount(`<div u-data="pa"></div>`);

    expect(calls()).toEqual({ pa: 1, pb: 0, pc: 0, pf: 0 });
    expect(providers.pa).toHaveBeenCalledWith(root);
    expect(root.__x.data.kind).toBe('a');
  });

  it('keeps the provider object behind an alias', () => {
    const root = mount(`<div u-data="pa as tab"></div>`);

    expect(calls()).toEqual({ pa: 1, pb: 0, pc: 0, pf: 0 });
    expect(root.__x.alias).toBe('tab');
    expect(root.__x.data.kind).toBe('a');
  });

  it('calls no provider for a plain object literal', () => {
    const root = mount(`<div u-data="{x: 1}"></div>`);

    expect(calls()).toEqual({ pa: 0, pb: 0, pc: 0, pf: 0 });
    expect(root.__x.data.x).toBe(1);
  });

  it('calls only the provider a member access or factory call starts from', () => {
    const member = mount(`<div u-data="pa.b"></div>`);
    expect(calls()).toEqual({ pa: 1, pb: 0, pc: 0, pf: 0 });
    expect(member.__x.data.x).toBe(1);

    providers.pa.mockClear();

    const factory = mount(`<div u-data="pf(1)"></div>`);
    expect(calls()).toEqual({ pa: 0, pb: 0, pc: 0, pf: 1 });
    expect(factory.__x.data.n).toBe(1);
  });

  it('leaves global names alone', () => {
    document.body.innerHTML = `<div></div>`;
    const root = document.body.firstElementChild;
    root.setAttribute('u-data', `JSON.parse('{"x":1}')`);
    Youla.componentInitialize(root);

    expect(root.__x.data.x).toBe(1);
    expect(calls()).toEqual({ pa: 0, pb: 0, pc: 0, pf: 0 });
  });

  it('falls back to a window value when no provider has that name', () => {
    window.someGlobal = { g: 1 };
    const root = mount(`<div u-data="someGlobal"></div>`);

    expect(root.__x.data.g).toBe(1);
  });

  it('prefers a provider over a same-named window value', () => {
    window.pa = { kind: 'window' };
    const root = mount(`<div u-data="pa"></div>`);

    expect(root.__x.data.kind).toBe('a');
  });

  it('calls each nested component\'s own provider with its own root', () => {
    const outer = mount(`<div u-data="pa"><section u-data="pb"><p u-data="{x: 1}"></p></section></div>`);
    const inner = outer.querySelector('section');

    expect(calls()).toEqual({ pa: 1, pb: 1, pc: 0, pf: 0 });
    expect(providers.pa).toHaveBeenCalledWith(outer);
    expect(providers.pb).toHaveBeenCalledWith(inner);
  });
});
