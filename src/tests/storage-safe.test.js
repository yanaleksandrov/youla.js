import { describe, it, expect, afterEach, vi } from 'vitest';
import { storage } from '../scripts/storage';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('storage when localStorage is blocked', () => {
  it('never throws and warns at most once', () => {
    const blocked = () => { throw new DOMException('denied', 'SecurityError'); };
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(blocked);
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(blocked);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(storage.get('key')).toBeUndefined();
    expect(storage.set('key', { a: 1 })).toBeUndefined();
    expect(storage.forget('key')).toBeUndefined();
    expect(storage.get('key')).toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('still reads and writes when storage works', () => {
    storage.set('works', { a: 1 });
    expect(storage.get('works')).toEqual({ a: 1 });
    storage.forget('works');
    expect(storage.get('works')).toBeUndefined();
  });
});
