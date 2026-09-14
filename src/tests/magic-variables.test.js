import { describe, it, expect, afterEach } from 'vitest';
import {
  getForData,
  createRefsProxy,
  createMagicVariables,
  withMagicVariables,
  splitMagicVariables,
} from '../scripts/magic-variables';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('getForData', () => {
  it('returns undefined when no ancestor carries loop data', () => {
    document.body.innerHTML = '<div id="a"><div id="b"></div></div>';
    expect(getForData(document.getElementById('b'))).toBeUndefined();
  });

  it('returns the loop data on the element itself', () => {
    const el = document.createElement('div');
    el.__x_for_data = { item: 'x' };
    expect(getForData(el)).toEqual({ item: 'x' });
  });

  it('walks up to find loop data on an ancestor', () => {
    document.body.innerHTML = '<div id="a"><div id="b"><div id="c"></div></div></div>';
    document.getElementById('a').__x_for_data = { item: 'x' };
    expect(getForData(document.getElementById('c'))).toEqual({ item: 'x' });
  });

  it('finds the nearest ancestor\'s loop data, not a further one', () => {
    document.body.innerHTML = '<div id="a"><div id="b"><div id="c"></div></div></div>';
    document.getElementById('a').__x_for_data = { item: 'outer' };
    document.getElementById('b').__x_for_data = { item: 'inner' };
    expect(getForData(document.getElementById('c'))).toEqual({ item: 'inner' });
  });
});

describe('createRefsProxy', () => {
  it('resolves a u-ref element by name', () => {
    document.body.innerHTML = '<div id="root"><input u-ref="email"></div>';
    const root = document.getElementById('root');
    const refs = createRefsProxy(root);
    expect(refs.email).toBe(root.querySelector('input'));
  });

  it('returns undefined for a name with no matching u-ref', () => {
    document.body.innerHTML = '<div id="root"></div>';
    const refs = createRefsProxy(document.getElementById('root'));
    expect(refs.missing).toBeUndefined();
  });

  it('does not see a ref belonging to a nested component', () => {
    document.body.innerHTML = `
      <div id="root">
        <div u-data="{}"><input u-ref="inner"></div>
      </div>
    `;
    const refs = createRefsProxy(document.getElementById('root'));
    expect(refs.inner).toBeUndefined();
  });
});

describe('createMagicVariables', () => {
  it('exposes $el/$event/$refs/$root', () => {
    const root = document.createElement('div');
    const el = document.createElement('button');
    const event = new Event('click');

    const vars = createMagicVariables(root, el, event);
    expect(vars.$el).toBe(el);
    expect(vars.$event).toBe(event);
    expect(vars.$root).toBe(root);
    expect(vars.$refs).toBeDefined();
  });

  it('$event is undefined when no event is given', () => {
    const root = document.createElement('div');
    const vars = createMagicVariables(root, root);
    expect(vars.$event).toBeUndefined();
  });
});

describe('withMagicVariables', () => {
  it('reads a magic variable before falling through to the data context', () => {
    const context = withMagicVariables({ $el: 'data-value' }, { $el: 'magic-value' });
    expect(context.$el).toBe('magic-value');
  });

  it('falls through to the data context for a name that is not magic', () => {
    const context = withMagicVariables({ count: 5 }, { $el: 'x' });
    expect(context.count).toBe(5);
  });

  it('"has" reports a magic variable as present even if the data context lacks it', () => {
    const context = withMagicVariables({}, { $el: 'x' });
    expect('$el' in context).toBe(true);
  });

  it('"has" still reports real data-context properties', () => {
    const context = withMagicVariables({ count: 1 }, {});
    expect('count' in context).toBe(true);
  });

  it('silently discards a write to a magic key, without touching the data context', () => {
    const data = {};
    const context = withMagicVariables(data, { $el: 'x' });
    context.$el = 'attempt-to-overwrite';
    expect(context.$el).toBe('x');
    expect(data.$el).toBeUndefined();
  });

  it('allows a write to a non-magic key to reach the data context', () => {
    const data = { count: 1 };
    const context = withMagicVariables(data, { $el: 'x' });
    context.count = 2;
    expect(data.count).toBe(2);
  });
});

describe('splitMagicVariables', () => {
  it('separates $-prefixed keys from the rest', () => {
    const { magicVariables, otherVariables } = splitMagicVariables({ $el: 1, item: 2, index: 3 });
    expect(magicVariables).toEqual({ $el: 1 });
    expect(otherVariables).toEqual({ item: 2, index: 3 });
  });

  it('returns empty objects for an empty/undefined input', () => {
    expect(splitMagicVariables()).toEqual({ magicVariables: {}, otherVariables: {} });
    expect(splitMagicVariables({})).toEqual({ magicVariables: {}, otherVariables: {} });
  });

  it('handles an all-magic input', () => {
    const { magicVariables, otherVariables } = splitMagicVariables({ $a: 1, $b: 2 });
    expect(magicVariables).toEqual({ $a: 1, $b: 2 });
    expect(otherVariables).toEqual({});
  });

  it('handles an all-plain input', () => {
    const { magicVariables, otherVariables } = splitMagicVariables({ a: 1, b: 2 });
    expect(magicVariables).toEqual({});
    expect(otherVariables).toEqual({ a: 1, b: 2 });
  });
});
