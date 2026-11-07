import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';
import '../youla-ajax';

// jsdom has no CSS.escape() or scrollIntoView() — polyfilled for findField() and showErrors().
if (typeof CSS === 'undefined' || !CSS.escape) {
  globalThis.CSS = globalThis.CSS || {};
  globalThis.CSS.escape = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

Element.prototype.scrollIntoView ??= () => {};

// Answers every request with a 422 and the configured validation errors.
class FakeXHR {
  static errors = {};
  upload = {};
  status = 422;
  open() {}
  abort() {}
  setRequestHeader() {}
  send() {
    this.responseText = JSON.stringify({ errors: FakeXHR.errors });
    setTimeout(() => {
      this.onload?.();
      this.onloadend?.({});
    });
  }
}

function type(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeAll(() => {
  window.Youla = Youla;
  window.XMLHttpRequest = FakeXHR;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('$ajax inline errors', () => {
  let form, password, login;

  beforeEach(async () => {
    FakeXHR.errors = { 'user[password]': ['Too short.'] };

    document.body.innerHTML = `
      <form u-data>
        <input id="login" u-prop="user.login">
        <input id="password" u-prop="user.password">
        <button type="button" id="fill" @click="user.password = 'x'.repeat(12)"></button>
        <button type="button" id="other" @click="user.login = 'admin'"></button>
        <button type="button" id="submit" @click="$ajax.post('/save').catch(() => {})"></button>
        <button type="button" id="background" @click="$ajax.post('/slug', null, null, { clearErrors: false }).catch(() => {})"></button>
      </form>
    `;

    form = document.querySelector('form');
    Youla.componentInitialize(form);
    await tick();

    login    = document.getElementById('login');
    password = document.getElementById('password');
  });

  async function submit() {
    document.getElementById('submit').click();
    await tick();
    expect(password.getAttribute('aria-invalid')).toBe('true');
  }

  it('clears the ajax error when the value changes from data', async () => {
    await submit();

    document.getElementById('fill').click();
    await tick();

    expect(password.value).toBe('x'.repeat(12));
    expect(password.hasAttribute('aria-invalid')).toBe(false);
    expect(form.querySelector('.ajax-error')).toBeNull();
    expect(form.__x.watchers).toEqual([]);
  });

  it('keeps the error when another field of the form changes', async () => {
    await submit();

    document.getElementById('other').click();
    await tick();

    expect(login.value).toBe('admin');
    expect(password.getAttribute('aria-invalid')).toBe('true');
  });

  it('keeps errors on a request with "clearErrors: false" and clears them on a plain one', async () => {
    await submit();

    FakeXHR.errors = {};
    document.getElementById('background').click();
    await tick();
    expect(password.getAttribute('aria-invalid')).toBe('true');

    document.getElementById('submit').click();
    await tick();
    expect(password.hasAttribute('aria-invalid')).toBe(false);
  });

  it('does not duplicate an error the request did not clear', async () => {
    await submit();

    document.getElementById('background').click();
    await tick();

    expect(password.getAttribute('aria-invalid')).toBe('true');
    expect(form.querySelectorAll('.ajax-error')).toHaveLength(1);
  });

  it('still clears the error on manual input', async () => {
    await submit();

    type(password, 'typed');
    await tick();

    expect(form.__x.data.user.password).toBe('typed');
    expect(password.hasAttribute('aria-invalid')).toBe(false);
  });
});

describe('$ajax error key to field name mapping', () => {
  let notices;

  beforeAll(() => {
    notices = [];
    Youla.variable('notice', () => ({ add: text => notices.push(text) }));
  });

  async function submitWith(errors, html) {
    notices.length = 0;
    FakeXHR.errors = errors;
    document.body.innerHTML = `
      <form u-data>
        ${html}
        <button type="button" id="submit" @click="$ajax.post('/save').catch(() => {})"></button>
      </form>
    `;
    Youla.componentInitialize(document.querySelector('form'));
    await tick();
    document.getElementById('submit').click();
    await tick();
  }

  const invalid = id => document.getElementById(id).getAttribute('aria-invalid') === 'true';

  it('maps dotted keys to bracket names', async () => {
    await submitWith(
      { 'user.email': ['Bad.'], 'rules.0.from': ['Required.'] },
      '<input id="email" name="user[email]"><input id="from" name="rules[0][from]">',
    );

    expect(invalid('email')).toBe(true);
    expect(invalid('from')).toBe(true);
    expect(notices).toEqual([]);
  });

  it('falls back to array names, with or without dots', async () => {
    await submitWith(
      { types: ['Pick one.'], 'user.tags': ['Too many.'] },
      '<input id="types" type="checkbox" name="types[]"><input id="tags" type="checkbox" name="user[tags][]">',
    );

    expect(invalid('types')).toBe(true);
    expect(invalid('tags')).toBe(true);
  });

  it('prefers the key as is and skips hidden inputs', async () => {
    await submitWith(
      { 'user.email': ['Bad.'], 'user.role': ['Invalid.'] },
      `<input id="dotted" name="user.email"><input id="bracket" name="user[email]">
       <input type="hidden" name="user[role]"><input id="role" type="checkbox" name="user[role][]">`,
    );

    expect(invalid('dotted')).toBe(true);
    expect(invalid('bracket')).toBe(false);
    expect(invalid('role')).toBe(true);
  });

  it('notifies when no field matches', async () => {
    await submitWith({ 'user.phone': ['Required.'] }, '<input name="user[email]">');

    expect(notices).toEqual(['Required.']);
  });
});
