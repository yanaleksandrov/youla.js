import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';
import '../scripts/directives/u-show';
import '../scripts/directives/u-text';

// jsdom doesn't implement CSS.escape() (a real browser always does) — polyfilled here only so the
// checkbox-array branch of hydrateProps() (which calls it) is actually exercised under vitest,
// per https://developer.mozilla.org/en-US/docs/Web/API/CSS/escape_static, condensed.
if (typeof CSS === 'undefined' || !CSS.escape) {
  globalThis.CSS = globalThis.CSS || {};
  globalThis.CSS.escape = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function initAll() {
  Youla.componentDiscover(el => Youla.componentInitialize(el));
}

function type(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeEach(() => {
  window.Youla = Youla;
  localStorage.clear();
  document.cookie.split(';').forEach(c => {
    document.cookie = c.replace(/^ +/, '').replace(/=.*/, '=;expires=' + new Date(0).toUTCString());
  });
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('u-prop.up', () => {
  it('writes to the ancestor even when neither the ancestor nor the nested component declared the key', async () => {
    document.body.innerHTML = `
      <main u-data>
        <input id="login" u-prop="login">
        <div u-data="{ visible: false }">
          <input id="password" u-prop.up="password">
        </div>
        <button id="submit" :disabled="!login.trim() || !password.trim()" disabled></button>
      </main>
    `;

    initAll();
    await tick();

    const main  = document.querySelector('main');
    const child = document.querySelector('div[u-data]');
    const submit = document.getElementById('submit');

    // The nested component never claims the key locally.
    expect('password' in child.__x.data).toBe(false);
    // The outer component does, auto-seeded to ''.
    expect(main.__x.data.password).toBe('');

    expect(submit.disabled).toBe(true);

    type(document.getElementById('login'), 'yan');
    await tick();
    type(document.getElementById('password'), 'S3cr3t!!');
    await tick();

    expect(main.__x.data.password).toBe('S3cr3t!!');
    expect(submit.disabled).toBe(false);
  });

  it('does not pollute the provider-shaped local data with the hoisted key (the password/value mixup)', async () => {
    // Mirrors youla-expansa.js's real Youla.data('password', ...) shape.
    Youla.data('password', () => ({
      value: '',
      visible: false,
    }));

    document.body.innerHTML = `
      <main u-data>
        <input id="login" u-prop="login">
        <div u-data="password">
          <input id="password" u-prop.up="password">
        </div>
      </main>
    `;

    initAll();
    await tick();

    const main  = document.querySelector('main');
    const child = document.querySelector('div[u-data]');

    type(document.getElementById('password'), 'S3cr3t!!');
    await tick();

    expect(main.__x.data.password).toBe('S3cr3t!!');
    // The provider's own shape is untouched — no stray "password" key on it.
    expect(child.__x.data).toEqual({ value: '', visible: false });
  });

  it('re-disables once the hoisted field is cleared again (no stale dep gating)', async () => {
    document.body.innerHTML = `
      <main u-data>
        <input id="login" u-prop="login">
        <div u-data="{}">
          <input id="password" u-prop.up="password">
        </div>
        <button id="submit" :disabled="!login.trim() || !password.trim()" disabled></button>
      </main>
    `;

    initAll();
    await tick();

    const submit = document.getElementById('submit');
    type(document.getElementById('login'), 'yan');
    type(document.getElementById('password'), 'S3cr3t!!');
    await tick();
    expect(submit.disabled).toBe(false);

    type(document.getElementById('password'), '');
    await tick();
    expect(submit.disabled).toBe(true);
  });

  it('keeps other, non-".up" fields in the same nested component owned locally', async () => {
    document.body.innerHTML = `
      <main u-data>
        <div u-data="{}">
          <input id="hoisted" u-prop.up="shared">
          <input id="local" u-prop="local">
        </div>
      </main>
    `;

    initAll();
    await tick();

    const main  = document.querySelector('main');
    const child = document.querySelector('div[u-data]');

    expect('shared' in main.__x.data).toBe(true);
    expect('shared' in child.__x.data).toBe(false);

    expect('local' in child.__x.data).toBe(true);
    expect('local' in main.__x.data).toBe(false);

    type(document.getElementById('hoisted'), 'H');
    type(document.getElementById('local'), 'L');
    await tick();

    expect(main.__x.data.shared).toBe('H');
    expect(child.__x.data.local).toBe('L');
  });

  it('walks past an intermediate component up to the nearest ancestor that already owns the key', async () => {
    document.body.innerHTML = `
      <main u-data="{ password: '' }">
        <div u-data="{}">
          <div u-data="{}">
            <input id="password" u-prop.up="password">
          </div>
        </div>
      </main>
    `;

    initAll();
    await tick();

    const main = document.querySelector('main');
    const [outerChild, innerChild] = document.querySelectorAll('div[u-data]');

    type(document.getElementById('password'), 'deep');
    await tick();

    expect(main.__x.data.password).toBe('deep');
    expect('password' in outerChild.__x.data).toBe(false);
    expect('password' in innerChild.__x.data).toBe(false);
  });

  it('auto-vivifies on the IMMEDIATE parent — not the topmost root — when nothing anywhere declares the key', async () => {
    // ".up" only forces ownership to start the lookup one level higher than usual (skipping this
    // component's own data). It does not force the eventual write all the way to the root: the
    // scope Proxy's own "set" trap (component.js) claims an undeclared key locally on whichever
    // component the write lands on, so with nothing declared anywhere it stops at the immediate
    // parent, not the outermost ancestor. It only reaches further up when some ancestor in
    // between already owns the key (see the "walks past an intermediate component" test above).
    document.body.innerHTML = `
      <main u-data="{}">
        <div u-data="{}">
          <div u-data="{}">
            <input id="password" u-prop.up="password">
          </div>
        </div>
      </main>
    `;

    initAll();
    await tick();

    const main = document.querySelector('main');
    const [outer, inner] = document.querySelectorAll('div[u-data]');

    expect('password' in main.__x.data).toBe(false);
    expect(outer.__x.data.password).toBe('');
    expect('password' in inner.__x.data).toBe(false);

    type(document.getElementById('password'), 'one-level-up');
    await tick();

    expect(outer.__x.data.password).toBe('one-level-up');
    expect('password' in main.__x.data).toBe(false);
  });

  it('is a no-op (falls back to local ownership, no throw) on a top-level u-data with no parent', async () => {
    document.body.innerHTML = `
      <main u-data="{}">
        <input id="password" u-prop.up="password">
      </main>
    `;

    initAll();
    await tick();

    const main = document.querySelector('main');
    expect(main.__x.data.password).toBe('');

    type(document.getElementById('password'), 'x');
    await tick();
    expect(main.__x.data.password).toBe('x');
  });

  it('works through a dot-path expression, hoisting only the root identifier', async () => {
    document.body.innerHTML = `
      <main u-data>
        <div u-data="{}">
          <input id="password" u-prop.up="user.password">
        </div>
      </main>
    `;

    initAll();
    await tick();

    const main = document.querySelector('main');
    expect(main.__x.data.user).toEqual({ password: '' });

    type(document.getElementById('password'), 'nested-path');
    await tick();

    expect(main.__x.data.user.password).toBe('nested-path');
  });

  it('composes with .trim', async () => {
    document.body.innerHTML = `
      <main u-data>
        <div u-data="{}">
          <input id="password" u-prop.up.trim="password">
        </div>
      </main>
    `;

    initAll();
    await tick();

    type(document.getElementById('password'), '  padded  ');
    await tick();

    const main = document.querySelector('main');
    expect(main.__x.data.password).toBe('padded');
  });

  it('composes with .number', async () => {
    document.body.innerHTML = `
      <main u-data>
        <div u-data="{}">
          <input id="age" u-prop.up.number="age">
        </div>
      </main>
    `;

    initAll();
    await tick();

    type(document.getElementById('age'), '42');
    await tick();

    const main = document.querySelector('main');
    expect(main.__x.data.age).toBe(42);
    expect(typeof main.__x.data.age).toBe('number');
  });

  it('hoists a checkbox group into the ancestor as an array', async () => {
    document.body.innerHTML = `
      <main u-data>
        <div u-data="{}">
          <input type="checkbox" value="red" u-prop.up="colors">
          <input type="checkbox" value="blue" u-prop.up="colors">
        </div>
      </main>
    `;

    initAll();
    await tick();

    const main = document.querySelector('main');
    expect(main.__x.data.colors).toEqual([]);

    const [red, blue] = document.querySelectorAll('input[type=checkbox]');
    red.checked = true;
    red.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(main.__x.data.colors).toEqual(['red']);

    blue.checked = true;
    blue.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();
    expect(main.__x.data.colors).toEqual(['red', 'blue']);
  });

  it('reflects a programmatic ancestor write back onto the field (reads still go through scope)', async () => {
    document.body.innerHTML = `
      <main u-data>
        <div u-data="{ tick: 0 } as p">
          <input id="password" u-prop.up="password">
          <button type="button" id="gen" @click="password = 'GENERATED'; tick++"></button>
        </div>
      </main>
    `;

    initAll();
    await tick();

    click(document.getElementById('gen'));
    await tick();

    expect(document.getElementById('password').value).toBe('GENERATED');
  });

  it('keeps syncing a sibling binding declared inside the nested component itself, not just in the ancestor', async () => {
    document.body.innerHTML = `
      <main u-data>
        <input id="login" u-prop="login">
        <div u-data="{}">
          <input id="password" u-prop.up="password">
          <button id="submit" :disabled="!login.trim() || !password.trim()" disabled></button>
        </div>
      </main>
    `;

    initAll();
    await tick();

    const submit = document.getElementById('submit');
    expect(submit.disabled).toBe(true);

    type(document.getElementById('login'), 'yan');
    await tick();
    type(document.getElementById('password'), 'S3cr3t!!');
    await tick();

    expect(submit.disabled).toBe(false);
  });

  it('two independent hoisted fields under the same ancestor do not clobber each other', async () => {
    document.body.innerHTML = `
      <main u-data>
        <div u-data="{}">
          <input id="password" u-prop.up="password">
        </div>
        <div u-data="{}">
          <input id="confirm" u-prop.up="confirmPassword">
        </div>
      </main>
    `;

    initAll();
    await tick();

    type(document.getElementById('password'), 'abc');
    type(document.getElementById('confirm'), 'xyz');
    await tick();

    const main = document.querySelector('main');
    expect(main.__x.data.password).toBe('abc');
    expect(main.__x.data.confirmPassword).toBe('xyz');
  });

  it('persists a .up + .local field through the owning ancestor', async () => {
    document.body.innerHTML = `
      <main u-data>
        <div u-data="{}">
          <input id="remember" u-prop.up.local="remembered">
        </div>
      </main>
    `;

    initAll();
    await tick();

    type(document.getElementById('remember'), 'saved-value');
    await tick();

    expect(localStorage.getItem('remembered')).toBe('saved-value');

    document.body.innerHTML = `
      <main u-data>
        <div u-data="{}">
          <input id="remember" u-prop.up.local="remembered">
        </div>
      </main>
    `;
    initAll();
    await tick();

    const main = document.querySelector('main');
    expect(main.__x.data.remembered).toBe('saved-value');
    expect(document.getElementById('remember').value).toBe('saved-value');
  });
});

describe('u-prop.up — conflict scenarios', () => {
  // Not specific to ".up": ANY u-prop (hoisted or not) always syncs the DOM element's current
  // value into data at mount — see hydrateProps()'s unconditional saferEval(generateExpressionForProp
  // (...)) call, which runs regardless of whether the owner already had a value. Documented here
  // because it bites harder with ".up": the ancestor whose value gets silently blanked is often a
  // component you don't otherwise control from this nested field's markup.
  it('an empty field mounts over — and blanks — a non-empty default already declared on the target ancestor', async () => {
    document.body.innerHTML = `
      <main u-data="{ password: 'preset' }">
        <div u-data="{}">
          <input id="password" u-prop.up="password">
        </div>
      </main>
    `;

    initAll();
    await tick();

    const main = document.querySelector('main');
    expect(main.__x.data.password).toBe('');
    expect(document.getElementById('password').value).toBe('');
  });

  // Give the field a matching "value" attribute (or set .value before Youla.start()/componentInitialize
  // runs) if the ancestor's initial value is meant to survive — same rule as plain, non-hoisted u-prop.
  it('...but survives if the field itself carries the matching DOM value at mount', async () => {
    document.body.innerHTML = `
      <main u-data="{ password: 'preset' }">
        <div u-data="{}">
          <input id="password" u-prop.up="password" value="preset">
        </div>
      </main>
    `;

    initAll();
    await tick();

    const main = document.querySelector('main');
    expect(main.__x.data.password).toBe('preset');
  });

  // ".up" resolves ownership purely by key name — it has no idea the name is already taken by
  // something other than a plain string field. Since Component#scope's "set" trap writes through
  // unconditionally, a method (or object, array, anything) already living under that name on the
  // target ancestor is silently overwritten by the field's string value.
  it('silently clobbers a pre-existing method of the same name on the target ancestor', async () => {
    document.body.innerHTML = `
      <main u-data="{ password(){ return 'original method' } }">
        <div u-data="{}">
          <input id="password" u-prop.up="password">
        </div>
      </main>
    `;

    initAll();
    await tick();

    const main = document.querySelector('main');
    // Mount alone already replaced the method with the field's blank sync — see the previous test.
    expect(typeof main.__x.data.password).toBe('string');

    type(document.getElementById('password'), 'clobbered');
    await tick();

    expect(main.__x.data.password).toBe('clobbered');
  });

  // Two ".up" fields that happen to target the same key on the same ancestor share one slot —
  // by design (this is how you'd deliberately mirror one value across two widgets), but a real
  // footgun if the name collision is accidental rather than intended. Last write wins; neither
  // field is a stable "keyed" source, and the field NOT last edited goes stale until it is
  // rendered again (u-prop resyncs on any refresh, so it *would* catch up on the next unrelated
  // change — this test only checks the write itself, not a later resync).
  it('two independent ".up" fields that accidentally share a key overwrite the same ancestor slot', async () => {
    document.body.innerHTML = `
      <main u-data="{}">
        <div u-data="{}">
          <input id="a" u-prop.up="value">
        </div>
        <div u-data="{}">
          <input id="b" u-prop.up="value">
        </div>
      </main>
    `;

    initAll();
    await tick();

    const main = document.querySelector('main');

    type(document.getElementById('a'), 'from-a');
    await tick();
    expect(main.__x.data.value).toBe('from-a');

    type(document.getElementById('b'), 'from-b');
    await tick();
    expect(main.__x.data.value).toBe('from-b');
  });

  // Nested u-data inside a u-each clone never gets its own Component at all — a separate,
  // pre-existing gap unrelated to ".up" (see write-up): u-each clones bypass both componentDiscover's
  // initial sweep and componentWatch's MutationObserver (which only inspects the directly-added
  // node, not its descendants), and Component#initialize()'s own domWalk deliberately stops at any
  // nested "u-data" boundary. So ".up" (like every other directive) is simply inert there — this
  // test pins that down rather than silently relying on undefined behavior.
  it('is inert inside a u-each clone\'s nested u-data (pre-existing gap, not ".up"-specific)', async () => {
    document.body.innerHTML = `
      <main u-data="{ rows: [1, 2] }">
        <li u-each="row in rows">
          <div class="clone" u-data="{}">
            <input class="f" u-prop.up="shared">
          </div>
        </li>
      </main>
    `;

    initAll();
    await tick();

    const clones = document.querySelectorAll('div.clone');
    // One extra "phantom" clone is the u-each template element itself (CSS-hidden via [u-each],
    // but never removed from the DOM) — it predates any cloning and so IS a real, working
    // component, unlike the two genuine rendered rows after it.
    const real = Array.from(clones).slice(1);
    expect(real.every(el => el.__x === undefined)).toBe(true);
  });
});
