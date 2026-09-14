import { describe, it, expect, vi } from 'vitest';
import {
  isUnsafeKey,
  parsePropPath,
  toJsPropAccessor,
  setNestedObjectValue,
  getNestedObjectValue,
} from '../scripts/object-path';

describe('isUnsafeKey', () => {
  it.each(['__proto__', 'constructor', 'prototype'])('flags "%s" as unsafe', (key) => {
    expect(isUnsafeKey(key)).toBe(true);
  });

  it.each(['name', 'value', 'user', '0', '__proto', 'proto__', 'Constructor'])(
    'does not flag "%s" as unsafe',
    (key) => {
      expect(isUnsafeKey(key)).toBe(false);
    }
  );
});

describe('parsePropPath', () => {
  it('splits a bare identifier into a single segment', () => {
    expect(parsePropPath('login')).toEqual(['login']);
  });

  it('splits dot notation', () => {
    expect(parsePropPath('user.firstName')).toEqual(['user', 'firstName']);
  });

  it('splits bracket notation', () => {
    expect(parsePropPath('user[firstName]')).toEqual(['user', 'firstName']);
  });

  it('splits mixed dot and bracket notation to any depth', () => {
    expect(parsePropPath('items[0].name')).toEqual(['items', '0', 'name']);
  });

  it('splits deeply nested bracket notation', () => {
    expect(parsePropPath('a[b][c][d]')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('returns an empty array for an empty string', () => {
    expect(parsePropPath('')).toEqual([]);
  });

  it('ignores stray brackets/dots with nothing between them', () => {
    expect(parsePropPath('a..b')).toEqual(['a', 'b']);
    expect(parsePropPath('a[]b')).toEqual(['a', 'b']);
  });
});

describe('toJsPropAccessor', () => {
  it('returns a bare identifier unchanged', () => {
    expect(toJsPropAccessor('login')).toBe('login');
  });

  it('converts dot notation to a quoted bracket chain after the first segment', () => {
    expect(toJsPropAccessor('user.firstName')).toBe('user["firstName"]');
  });

  it('converts bracket notation the same way', () => {
    expect(toJsPropAccessor('user[firstName]')).toBe('user["firstName"]');
  });

  it('handles a numeric-looking segment as a quoted string, not an index', () => {
    expect(toJsPropAccessor('items[0].name')).toBe('items["0"]["name"]');
  });

  it('escapes a segment containing a quote safely via JSON.stringify', () => {
    expect(toJsPropAccessor('user[a"b]')).toBe('user["a\\"b"]');
  });
});

describe('setNestedObjectValue', () => {
  it('returns the value as-is when the key array is empty', () => {
    expect(setNestedObjectValue([], 'hello')).toBe('hello');
  });

  it('builds a single-level object', () => {
    expect(setNestedObjectValue(['a'], 1)).toEqual({ a: 1 });
  });

  it('builds a nested object from multiple keys', () => {
    expect(setNestedObjectValue(['a', 'b'], 1)).toEqual({ a: { b: 1 } });
  });

  it('builds a deeply nested object', () => {
    expect(setNestedObjectValue(['a', 'b', 'c', 'd'], 'x')).toEqual({ a: { b: { c: { d: 'x' } } } });
  });

  it('refuses to write through an unsafe key and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(setNestedObjectValue(['__proto__', 'polluted'], true)).toEqual({});
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('refuses when the unsafe key is not the first segment', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(setNestedObjectValue(['user', 'constructor'], 1)).toEqual({});
    warn.mockRestore();
  });
});

describe('getNestedObjectValue', () => {
  const obj = { user: { profile: { name: 'Yan' }, tags: ['a', 'b'] } };

  it('reads a top-level property', () => {
    expect(getNestedObjectValue(obj, 'user')).toBe(obj.user);
  });

  it('reads a nested dot path', () => {
    expect(getNestedObjectValue(obj, 'user.profile.name')).toBe('Yan');
  });

  it('reads a nested bracket path', () => {
    expect(getNestedObjectValue(obj, 'user[profile][name]')).toBe('Yan');
  });

  it('reads an array element via bracket notation', () => {
    expect(getNestedObjectValue(obj, 'user.tags[0]')).toBe('a');
  });

  it('returns undefined for a missing segment partway through the path', () => {
    expect(getNestedObjectValue(obj, 'user.profile.missing.deeper')).toBeUndefined();
  });

  it('returns undefined for a completely missing top-level key', () => {
    expect(getNestedObjectValue(obj, 'missing')).toBeUndefined();
  });

  it('returns undefined when reading through an unsafe key', () => {
    expect(getNestedObjectValue(obj, 'user.__proto__.polluted')).toBeUndefined();
  });

  it('returns the object itself for an empty path', () => {
    expect(getNestedObjectValue(obj, '')).toBe(obj);
  });

  it('returns undefined when the root object is null/undefined', () => {
    expect(getNestedObjectValue(null, 'a.b')).toBeUndefined();
    expect(getNestedObjectValue(undefined, 'a.b')).toBeUndefined();
  });
});
