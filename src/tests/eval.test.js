import { describe, it, expect } from 'vitest';
import { saferEval } from '../scripts/eval';

describe('saferEval — basic evaluation', () => {
  it('evaluates a literal expression', () => {
    expect(saferEval('1 + 1', {})).toBe(2);
  });

  it('reads a bare identifier off the data context', () => {
    expect(saferEval('count', { count: 5 })).toBe(5);
  });

  it('reads a nested property', () => {
    expect(saferEval('user.name', { user: { name: 'yan' } })).toBe('yan');
  });

  it('calls a method on the data context with "this" bound to it', () => {
    const data = { count: 2, double() { return this.count * 2; } };
    expect(saferEval('double()', data)).toBe(4);
  });

  it('evaluates a ternary expression', () => {
    expect(saferEval('count > 0 ? "yes" : "no"', { count: 1 })).toBe('yes');
  });

  it('evaluates a template literal', () => {
    expect(saferEval('`hello ${name}`', { name: 'world' })).toBe('hello world');
  });

  it('evaluates array/object literals', () => {
    expect(saferEval('[1, 2, 3]', {})).toEqual([1, 2, 3]);
    expect(saferEval('({ a: 1 })', {})).toEqual({ a: 1 });
  });
});

describe('saferEval — additional helper variables', () => {
  it('exposes extra named values alongside the data context', () => {
    expect(saferEval('$el.tagName', {}, { $el: { tagName: 'DIV' } })).toBe('DIV');
  });

  it('lets a helper variable be used together with data context properties', () => {
    expect(saferEval('count + $extra', { count: 1 }, { $extra: 9 })).toBe(10);
  });

  it('a same-named data property shadows the additional helper (with($data) resolves first)', () => {
    // "with($data){...}" checks $data's own properties before falling through to the outer
    // helper-variable function parameter of the same name — this is exactly why
    // withMagicVariables() exists: it wraps $data in a Proxy whose own "get" trap checks the
    // magic variables FIRST, so a data property named e.g. "$el" can never shadow the real $el.
    expect(saferEval('$el', { $el: 'from-data' }, { $el: 'from-helper' })).toBe('from-data');
  });
});

describe('saferEval — write access', () => {
  it('writes a property back onto the data context object', () => {
    const data = { count: 0 };
    saferEval('count = 5', data, {}, true);
    expect(data.count).toBe(5);
  });

  it('supports compound assignment', () => {
    const data = { count: 1 };
    saferEval('count += 4', data, {}, true);
    expect(data.count).toBe(5);
  });

  it('supports increment', () => {
    const data = { count: 1 };
    saferEval('count++', data, {}, true);
    expect(data.count).toBe(2);
  });

  it('runs multiple statements when noReturn is true', () => {
    const data = { a: 0, b: 0 };
    saferEval('a = 1; b = 2', data, {}, true);
    expect(data).toEqual({ a: 1, b: 2 });
  });

  it('does not return a value when noReturn is true', () => {
    const data = { a: 0 };
    expect(saferEval('a = 1', data, {}, true)).toBeUndefined();
  });
});

describe('saferEval — errors propagate to the caller', () => {
  it('throws for a reference to an undefined bare identifier', () => {
    expect(() => saferEval('doesNotExist', {})).toThrow();
  });

  it('throws for invalid syntax', () => {
    expect(() => saferEval('{{{', {})).toThrow();
  });

  it('throws when calling something that is not a function', () => {
    expect(() => saferEval('notAFunction()', { notAFunction: 1 })).toThrow();
  });
});

describe('saferEval — compilation cache', () => {
  it('produces consistent results across repeated calls with the same expression', () => {
    const data1 = { count: 1 };
    const data2 = { count: 2 };
    expect(saferEval('count', data1)).toBe(1);
    expect(saferEval('count', data2)).toBe(2);
  });

  it('distinguishes cache entries by the set of helper-variable names', () => {
    // Same expression text, different helper name sets — must not collide in the compiled cache.
    expect(saferEval('a', {}, { a: 1 })).toBe(1);
    expect(saferEval('a', { a: 2 })).toBe(2);
  });

  it('distinguishes cache entries by the noReturn flag', () => {
    const data = { count: 1 };
    expect(saferEval('count', data)).toBe(1);
    expect(saferEval('count', data, {}, true)).toBeUndefined();
  });
});
