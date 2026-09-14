import { describe, it, expect, vi } from 'vitest';
import { makeObservable, toRaw, RAW, reactive, forceRefresh } from '../scripts/reactivity';

describe('makeObservable', () => {
  it('returns a Proxy wrapping the given object', () => {
    const obs = makeObservable({ a: 1 }, () => {});
    expect(obs.a).toBe(1);
  });

  it('calls onChange with the written property name', () => {
    const onChange = vi.fn();
    const obs = makeObservable({ a: 1 }, onChange);
    obs.a = 2;
    expect(onChange).toHaveBeenCalledWith('a');
    expect(obs.a).toBe(2);
  });

  it('does not call onChange for a mere read', () => {
    const onChange = vi.fn();
    const obs = makeObservable({ a: 1 }, onChange);
    // eslint-disable-next-line no-unused-expressions
    obs.a;
    expect(onChange).not.toHaveBeenCalled();
  });

  it('wraps a nested object so writes to it are also observed', () => {
    const onChange = vi.fn();
    const obs = makeObservable({ user: { name: 'a' } }, onChange);
    obs.user.name = 'b';
    expect(onChange).toHaveBeenCalledWith('name');
    expect(obs.user.name).toBe('b');
  });

  it('reports the array mutator method name with force=true on push', () => {
    const onChange = vi.fn();
    const obs = makeObservable({ items: [] }, onChange);
    obs.items.push('x');
    expect(onChange).toHaveBeenCalledWith('push', true);
    expect(obs.items).toEqual(['x']);
  });

  it.each(['push', 'pop', 'shift', 'unshift', 'splice', 'sort', 'reverse', 'fill', 'copyWithin'])(
    'treats "%s" as a mutator that forces a refresh',
    (method) => {
      const onChange = vi.fn();
      const obs = makeObservable({ items: [1, 2, 3] }, onChange);
      obs.items[method]();
      expect(onChange).toHaveBeenCalledWith(method, true);
    }
  );

  it('mutator methods still operate on the real underlying array', () => {
    const obs = makeObservable({ items: [1, 2, 3] }, () => {});
    obs.items.pop();
    expect(obs.items).toEqual([1, 2]);
  });

  it('a value written into an array is wrapped observable too', () => {
    const onChange = vi.fn();
    const obs = makeObservable({ items: [] }, onChange);
    obs.items.push({ nested: 1 });
    obs.items[0].nested = 2;
    expect(onChange).toHaveBeenCalledWith('nested');
  });

  it('leaves a DOM node unwrapped when read off observed data', () => {
    const node = document.createElement('div');
    const obs = makeObservable({ el: node }, () => {});
    expect(obs.el).toBe(node);
  });

  it('does not double-wrap a value that already went through makeObservable (toRaw before rewrap)', () => {
    const inner = makeObservable({ a: 1 }, () => {});
    const outer = makeObservable({ nested: inner }, () => {});
    // Reading it back should not stack a second proxy layer around the raw target.
    expect(toRaw(outer.nested)).toEqual({ a: 1 });
  });

  it('does not treat null as an object to wrap', () => {
    const obs = makeObservable({ a: null }, () => {});
    expect(obs.a).toBeNull();
  });

  it('leaves a primitive value untouched', () => {
    const obs = makeObservable({ n: 5, s: 'x', b: true }, () => {});
    expect(obs.n).toBe(5);
    expect(obs.s).toBe('x');
    expect(obs.b).toBe(true);
  });
});

describe('toRaw', () => {
  it('unwraps an observable proxy back to its plain target', () => {
    const raw = { a: 1 };
    const obs = makeObservable(raw, () => {});
    expect(toRaw(obs)).toEqual(raw);
  });

  it('is a no-op for an already-plain object', () => {
    const raw = { a: 1 };
    expect(toRaw(raw)).toBe(raw);
  });

  it('is a no-op for a primitive value', () => {
    expect(toRaw(5)).toBe(5);
    expect(toRaw('x')).toBe('x');
    expect(toRaw(null)).toBeNull();
    expect(toRaw(undefined)).toBeUndefined();
  });

  it('responds to the RAW symbol directly', () => {
    const raw = { a: 1 };
    const obs = makeObservable(raw, () => {});
    expect(obs[RAW]).toEqual(raw);
  });
});

describe('reactive', () => {
  it('returns a Proxy wrapping the given object', () => {
    const root = document.createElement('div');
    const obs = reactive({ a: 1 }, root);
    expect(obs.a).toBe(1);
  });

  it('schedules a force-refresh on the root component after a write', async () => {
    const root = document.createElement('div');
    root.__x = { refresh: vi.fn() };
    const obs = reactive({ a: 1 }, root);

    obs.a = 2;
    await new Promise((r) => setTimeout(r, 20));

    expect(root.__x.refresh).toHaveBeenCalledWith(true);
  });

  it('coalesces multiple writes to the same property into one scheduled refresh call', async () => {
    const root = document.createElement('div');
    root.__x = { refresh: vi.fn() };
    const obs = reactive({ a: 1 }, root);

    obs.a = 2;
    obs.a = 3;
    obs.a = 4;
    await new Promise((r) => setTimeout(r, 20));

    expect(root.__x.refresh).toHaveBeenCalledTimes(1);
  });

  it('does nothing (no throw) when the root has no component attached yet', async () => {
    const root = document.createElement('div');
    const obs = reactive({ a: 1 }, root);
    expect(() => { obs.a = 2; }).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
  });
});

describe('forceRefresh', () => {
  it('calls refresh(true) on the root element\'s component after a tick', async () => {
    const root = document.createElement('div');
    root.__x = { refresh: vi.fn() };

    forceRefresh(root);
    await new Promise((r) => setTimeout(r, 20));

    expect(root.__x.refresh).toHaveBeenCalledWith(true);
  });

  it('does nothing when the root has no component', async () => {
    const root = document.createElement('div');
    expect(() => forceRefresh(root)).not.toThrow();
    await new Promise((r) => setTimeout(r, 20));
  });
});
