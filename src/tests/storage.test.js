import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { storage, computeExpires, isStorageModifier, getStorageType, castToType } from '../scripts/storage';

beforeEach(() => {
  localStorage.clear();
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
  });
});

describe('storage.set / storage.get — localStorage', () => {
  it('round-trips a string value', () => {
    storage.set('name', 'yan');
    expect(storage.get('name')).toBe('yan');
  });

  it('round-trips an object value, JSON-encoded', () => {
    storage.set('user', { id: 1, name: 'yan' });
    expect(storage.get('user')).toEqual({ id: 1, name: 'yan' });
  });

  it('round-trips an array value', () => {
    storage.set('tags', ['a', 'b', 'c']);
    expect(storage.get('tags')).toEqual(['a', 'b', 'c']);
  });

  it('returns undefined for a key that was never set', () => {
    expect(storage.get('missing')).toBeUndefined();
  });

  it('does nothing when name is falsy', () => {
    expect(() => storage.set('', 'x')).not.toThrow();
    expect(storage.get('')).toBeUndefined();
  });

  it('clears the entry when value is falsy', () => {
    storage.set('temp', 'x');
    expect(storage.get('temp')).toBe('x');

    storage.set('temp', '');
    expect(storage.get('temp')).toBeUndefined();
  });

  it('clears the entry when value is 0', () => {
    storage.set('n', 'x');
    storage.set('n', 0);
    expect(storage.get('n')).toBeUndefined();
  });

  it('respects an explicit future expiry', () => {
    const future = new Date(Date.now() + 100000);
    storage.set('withTTL', 'alive', 'local', { expires: future });
    expect(storage.get('withTTL')).toBe('alive');
  });

  it('treats a past expiry as already expired and removes the entry on read', () => {
    const past = new Date(Date.now() - 100000);
    storage.set('expired', 'gone', 'local', { expires: past });
    expect(storage.get('expired')).toBeUndefined();
    expect(localStorage.getItem('expired')).toBeNull();
  });

  it('a plain (non-wrapped) localStorage value written outside Youla.js still reads back raw', () => {
    localStorage.setItem('raw', 'plain-value');
    expect(storage.get('raw')).toBe('plain-value');
  });
});

describe('storage.set / storage.get — cookies', () => {
  it('round-trips a string value', () => {
    storage.set('lang', 'ru', 'cookie');
    expect(storage.get('lang', 'cookie')).toBe('ru');
  });

  it('round-trips an object value', () => {
    storage.set('prefs', { theme: 'dark' }, 'cookie');
    expect(storage.get('prefs', 'cookie')).toEqual({ theme: 'dark' });
  });

  it('returns undefined for a cookie that was never set', () => {
    expect(storage.get('nope', 'cookie')).toBeUndefined();
  });

  it('clears the cookie when value is falsy', () => {
    storage.set('c', 'x', 'cookie');
    expect(storage.get('c', 'cookie')).toBe('x');

    storage.set('c', null, 'cookie');
    expect(storage.get('c', 'cookie')).toBeUndefined();
  });

  it('URL-encodes special characters in the value', () => {
    storage.set('special', 'a=b;c', 'cookie');
    expect(storage.get('special', 'cookie')).toBe('a=b;c');
  });

  it('escapes regex-special characters in the cookie name when reading', () => {
    storage.set('a.b+c', 'val', 'cookie');
    expect(storage.get('a.b+c', 'cookie')).toBe('val');
  });
});

describe('computeExpires', () => {
  it('adds days', () => {
    const now = Date.now();
    const result = computeExpires('7d');
    expect(result.getTime()).toBeGreaterThan(now);
    expect(result.getTime() - now).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
  });

  it.each([
    ['1y', 'FullYear'],
    ['1m', 'Month'],
    ['1d', 'Date'],
    ['1h', 'Hours'],
    ['1i', 'Minutes'],
    ['1s', 'Seconds'],
  ])('recognizes unit "%s"', (str) => {
    expect(computeExpires(str)).toBeInstanceOf(Date);
  });

  it('returns null for an unrecognized unit', () => {
    expect(computeExpires('7x')).toBeNull();
  });

  it('parses the numeric amount correctly', () => {
    const before = new Date();
    const result = computeExpires('2h');
    const diffHours = (result.getTime() - before.getTime()) / (1000 * 60 * 60);
    expect(diffHours).toBeGreaterThan(1.9);
    expect(diffHours).toBeLessThan(2.1);
  });
});

describe('isStorageModifier', () => {
  it('detects ".local"', () => {
    expect(isStorageModifier(['local'])).toBe(true);
  });

  it('detects ".cookie"', () => {
    expect(isStorageModifier(['cookie'])).toBe(true);
  });

  it('detects either alongside other modifiers', () => {
    expect(isStorageModifier(['local', '30d'])).toBe(true);
  });

  it('returns false when neither is present', () => {
    expect(isStorageModifier(['prevent', 'stop'])).toBe(false);
  });

  it('returns false for an empty list', () => {
    expect(isStorageModifier([])).toBe(false);
  });
});

describe('getStorageType', () => {
  it('prefers "cookie" when both are somehow present', () => {
    expect(getStorageType(['cookie', 'local'])).toBe('cookie');
  });

  it('returns "cookie" when only cookie is present', () => {
    expect(getStorageType(['cookie'])).toBe('cookie');
  });

  it('defaults to "local" otherwise', () => {
    expect(getStorageType(['local'])).toBe('local');
    expect(getStorageType([])).toBe('local');
  });
});

describe('castToType', () => {
  it('casts to string', () => {
    expect(castToType('ref', 123)).toBe('123');
  });

  it('casts to integer when the reference is an integer', () => {
    expect(castToType(5, '42')).toBe(42);
  });

  it('casts to float when the reference is a float', () => {
    expect(castToType(5.5, '42.75')).toBeCloseTo(42.75);
  });

  it('casts to boolean', () => {
    expect(castToType(true, 'anything-truthy')).toBe(true);
    expect(castToType(false, '')).toBe(false);
  });

  it('casts to a Date', () => {
    const result = castToType(new Date(), '2024-01-01T00:00:00.000Z');
    expect(result).toBeInstanceOf(Date);
    expect(result.getUTCFullYear()).toBe(2024);
  });

  it('casts to an array', () => {
    expect(castToType([], 'abc')).toEqual(['a', 'b', 'c']);
  });

  it('wraps a plain object reference in Object()', () => {
    const result = castToType({}, 'x');
    expect(result.valueOf()).toBe('x');
  });

  it('handles an undefined reference by inferring booleans from "true"/"false" strings', () => {
    expect(castToType(undefined, 'true')).toBe(true);
    expect(castToType(undefined, 'false')).toBe(false);
    expect(castToType(undefined, 'other')).toBe('other');
  });

  it('passes the value through unmodified when the reference is explicitly null', () => {
    expect(castToType(null, 'anything')).toBe('anything');
  });
});
