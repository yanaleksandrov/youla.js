import { describe, it, expect } from 'vitest';
import { createEvent, getNextModifier, isKeyModifier, matchesKeyModifiers } from '../scripts/events';

describe('createEvent', () => {
  it('creates a CustomEvent with the given name', () => {
    const e = createEvent('youla:init');
    expect(e).toBeInstanceOf(CustomEvent);
    expect(e.type).toBe('youla:init');
  });

  it('carries the given detail payload', () => {
    const e = createEvent('foo', { a: 1 });
    expect(e.detail).toEqual({ a: 1 });
  });

  it('defaults detail to an empty object', () => {
    const e = createEvent('foo');
    expect(e.detail).toEqual({});
  });

  it('is bubbling, cancelable and composed', () => {
    const e = createEvent('foo');
    expect(e.bubbles).toBe(true);
    expect(e.cancelable).toBe(true);
    expect(e.composed).toBe(true);
  });
});

describe('getNextModifier', () => {
  it('returns the modifier right after the given one', () => {
    expect(getNextModifier(['delay', '250ms'], 'delay')).toBe('250ms');
  });

  it('returns the default when the modifier is absent', () => {
    expect(getNextModifier(['prevent'], 'delay', '100ms')).toBe('100ms');
  });

  it('returns an empty string by default when absent and no default given', () => {
    expect(getNextModifier(['prevent'], 'delay')).toBe('');
  });

  it('returns the default when the modifier is the last item (nothing follows it)', () => {
    expect(getNextModifier(['prevent', 'delay'], 'delay', 'x')).toBe('x');
  });

  it('works for storage duration modifiers', () => {
    expect(getNextModifier(['local', '30d'], 'local')).toBe('30d');
    expect(getNextModifier(['cookie', '1y'], 'cookie')).toBe('1y');
  });
});

describe('isKeyModifier', () => {
  it.each(['window', 'document', 'passive', 'capture', 'delay', 'prevent', 'stop', 'outside', 'once'])(
    'treats "%s" as a behavior modifier, not a key filter',
    (modifier) => {
      expect(isKeyModifier(modifier)).toBe(false);
    }
  );

  it.each(['250ms', '100s'])('treats a ms/s duration like "%s" (the ".delay" argument) as not a key filter', (modifier) => {
    expect(isKeyModifier(modifier)).toBe(false);
  });

  // Only the ms/s shape used by ".delay" is excluded — a storage duration like "30d"/"1y" would
  // read as a key filter here, but it never reaches this function: u-data/u-prop's own duration
  // modifiers never go through attachListener()'s modifiers list (u-prop passes "[]" instead).
  it.each(['30d', '1y'])('does not special-case a non-ms/s duration like "%s"', (modifier) => {
    expect(isKeyModifier(modifier)).toBe(true);
  });

  it.each(['enter', 'esc', 'escape', 'ctrl', 'shift', 'alt', 'meta', 's', 'a', '1'])(
    'treats "%s" as a key filter',
    (modifier) => {
      expect(isKeyModifier(modifier)).toBe(true);
    }
  );
});

function keyEvent(overrides = {}) {
  return { key: '', code: '', ctrlKey: false, altKey: false, shiftKey: false, metaKey: false, ...overrides };
}

describe('matchesKeyModifiers', () => {
  it('matches when there is no key filter at all', () => {
    expect(matchesKeyModifiers(keyEvent(), ['prevent'])).toBe(true);
  });

  it('matches a named key alias by e.key', () => {
    expect(matchesKeyModifiers(keyEvent({ key: 'Enter' }), ['enter'])).toBe(true);
  });

  it('does not match a different key', () => {
    expect(matchesKeyModifiers(keyEvent({ key: 'Escape' }), ['enter'])).toBe(false);
  });

  it('matches case-insensitively', () => {
    expect(matchesKeyModifiers(keyEvent({ key: 'ENTER' }), ['enter'])).toBe(true);
  });

  it('matches a system modifier key', () => {
    expect(matchesKeyModifiers(keyEvent({ ctrlKey: true }), ['ctrl'])).toBe(true);
  });

  it('fails a system modifier key when not pressed', () => {
    expect(matchesKeyModifiers(keyEvent({ ctrlKey: false }), ['ctrl'])).toBe(false);
  });

  it('requires every listed modifier to match (ctrl+s)', () => {
    expect(matchesKeyModifiers(keyEvent({ ctrlKey: true, key: 's', code: 'KeyS' }), ['ctrl', 's'])).toBe(true);
  });

  it('fails a combo when only one of two modifiers matches', () => {
    expect(matchesKeyModifiers(keyEvent({ ctrlKey: false, key: 's', code: 'KeyS' }), ['ctrl', 's'])).toBe(false);
  });

  it('falls back to e.code for a single letter, layout-independent', () => {
    // Cyrillic layout reports a different e.key for the same physical key.
    expect(matchesKeyModifiers(keyEvent({ key: 'ы', code: 'KeyS' }), ['s'])).toBe(true);
  });

  it('falls back to e.code for a single digit', () => {
    expect(matchesKeyModifiers(keyEvent({ key: '', code: 'Digit1' }), ['1'])).toBe(true);
  });

  it('matches the space alias via code', () => {
    expect(matchesKeyModifiers(keyEvent({ key: '', code: 'Space' }), ['space'])).toBe(true);
  });

  it('ignores behavior modifiers mixed in with key filters', () => {
    expect(matchesKeyModifiers(keyEvent({ key: 'Enter' }), ['prevent', 'enter', 'stop'])).toBe(true);
  });
});
