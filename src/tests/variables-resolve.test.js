import { describe, it, expect } from 'vitest';
import { resolve, variable } from '../scripts/variables';

describe('resolve', () => {
  it('returns the registered variable\'s value', () => {
    const notice = { add: () => {} };
    variable('resolveNotice', () => notice);
    expect(resolve('resolveNotice')).toBe(notice);
  });

  it('passes document.body as root and el', () => {
    variable('resolveArgs', (root, el) => [root, el]);
    expect(resolve('resolveArgs')).toEqual([document.body, document.body]);
  });

  it('returns undefined for an unregistered variable', () => {
    expect(resolve('missing')).toBeUndefined();
  });
});
