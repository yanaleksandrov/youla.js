import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';
import { storage } from '../scripts/storage';
import { createMagicVariables } from '../scripts/magic-variables';

function mount(html) {
  document.body.innerHTML = html;
  Youla.componentDiscover(el => Youla.componentInitialize(el));
  return document.body.firstElementChild;
}

const tick = () => new Promise(resolve => setTimeout(resolve));

beforeAll(() => {
  window.Youla = Youla;
  Youla.data('themeToggle', () => ({
    dark: !!Youla.storage.get('dark', 'cookie'),
    toggle() {
      this.dark = !this.dark;
      this.$storage.set('dark', this.dark, 'cookie', { expires: '1y' });
    },
  }));
});

beforeEach(() => {
  localStorage.clear();
  document.cookie.split(';').forEach((c) => {
    const name = c.split('=')[0].trim();
    if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/`;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Youla.storage', () => {
  it('is the same object as $storage', () => {
    const root = document.createElement('div');
    expect(Youla.storage).toBe(storage);
    expect(createMagicVariables(root, root).$storage).toBe(storage);
  });

  it('forget() removes a localStorage entry', () => {
    Youla.storage.set('k', 'v');
    Youla.storage.forget('k');
    expect(Youla.storage.get('k')).toBeUndefined();
  });

  it('forget() removes a cookie', () => {
    Youla.storage.set('k', 'v', 'cookie');
    expect(Youla.storage.get('k', 'cookie')).toBe('v');
    Youla.storage.forget('k', 'cookie');
    expect(Youla.storage.get('k', 'cookie')).toBeUndefined();
  });

  it('accepts a duration string for expires', () => {
    const now = Date.now();
    Youla.storage.set('k', 'v', 'local', { expires: '2h' });
    const raw = JSON.parse(localStorage.getItem('k'));
    expect(raw.__youla_expires - now).toBeGreaterThanOrEqual(2 * 3600 * 1000 - 1000);
    expect(Youla.storage.get('k')).toBe('v');
  });

  it('writes cookies with path=/ and SameSite=Lax by default, without secure on HTTP', () => {
    const spy = vi.spyOn(document, 'cookie', 'set');
    Youla.storage.set('k', 'v', 'cookie', { expires: '30d' });
    const written = spy.mock.calls[0][0];
    expect(written).toMatch(/; path=\//);
    expect(written).toMatch(/; samesite=Lax/);
    expect(written).toMatch(/; expires=/);
    expect(written).not.toMatch(/secure/);
  });

  it('lets caller options override the cookie defaults', () => {
    const spy = vi.spyOn(document, 'cookie', 'set');
    Youla.storage.set('k', 'v', 'cookie', { path: '/shop', secure: true });
    const written = spy.mock.calls[0][0];
    expect(written).toMatch(/; path=\/shop/);
    expect(written).toMatch(/; secure/);
  });
});

describe('$storage', () => {
  it('is available in expressions', async () => {
    const root = mount(`<div u-data><button @click="$storage.set('seen', 'yes')"></button></div>`);
    root.querySelector('button').click();
    await tick();
    expect(Youla.storage.get('seen')).toBe('yes');
  });

  it('is available as this.$storage in provider methods', async () => {
    const root = mount(`<div u-data="themeToggle"><button @click="toggle()"></button></div>`);
    root.querySelector('button').click();
    await tick();
    expect(Youla.storage.get('dark', 'cookie')).toBe(true);

    root.querySelector('button').click();
    await tick();
    expect(Youla.storage.get('dark', 'cookie')).toBeUndefined();
  });

  it('cannot be overridden by Youla.variable()', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Youla.variable('storage', () => 'x');
    expect(warn).toHaveBeenCalled();
  });
});
