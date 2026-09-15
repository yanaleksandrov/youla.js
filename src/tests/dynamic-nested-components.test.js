import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-each';
import '../scripts/directives/u-prop';
import '../scripts/directives/u-text';

// jsdom doesn't implement CSS.escape() — see prop-up-modifier.test.js for the same polyfill.
if (typeof CSS === 'undefined' || !CSS.escape) {
  globalThis.CSS = globalThis.CSS || {};
  globalThis.CSS.escape = (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`);
}

function type(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function tick(ms = 30) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

// Regression: componentWatch() only ever inspected "mutation.addedNodes" itself, never its descendants, so a nested "u-data" inside a subtree added in one go (e.g. cloneNode()-based content) was silently never constructed.
describe('componentWatch discovers u-data nested inside a dynamically-added subtree', () => {
  it('initializes a u-data nested inside a directly-inserted subtree (not just the subtree\'s own root)', async () => {
    Youla.componentWatch(el => Youla.componentInitialize(el));

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="outer" u-data="{}">
        <div class="inner" u-data="{}">
          <input class="f" u-prop="x">
        </div>
      </div>
    `;
    document.body.appendChild(wrapper.firstElementChild);
    await tick();

    const outer = document.querySelector('.outer');
    const inner = document.querySelector('.inner');

    expect(outer.__x).toBeTruthy();
    expect(inner.__x).toBeTruthy();

    type(document.querySelector('.f'), 'hello');
    await tick();

    expect(inner.__x.data.x).toBe('hello');
  });

  it('initializes u-data nested three levels deep, in document order (each parent exists before its child needs it)', async () => {
    Youla.componentWatch(el => Youla.componentInitialize(el));

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
      <div class="a" u-data="{ shared: 'from-a' }">
        <div class="b" u-data="{}">
          <div class="c" u-data="{}">
            <span class="out" u-text="shared"></span>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(wrapper.firstElementChild);
    await tick();

    expect(document.querySelector('.a').__x).toBeTruthy();
    expect(document.querySelector('.b').__x).toBeTruthy();
    expect(document.querySelector('.c').__x).toBeTruthy();
    // Only possible if ".a" was initialized before ".b", so ".b".__x.parent was already set.
    expect(document.querySelector('.out').textContent).toBe('from-a');
  });

  it('u-each clones with a nested u-data now initialize (previously always inert)', async () => {
    document.body.innerHTML = `
      <main u-data="{ rows: [1, 2, 3] }">
        <li u-each="row in rows">
          <div class="clone" u-data="{}">
            <input class="f" u-prop.up="shared">
          </div>
        </li>
      </main>
    `;

    Youla.componentDiscover(el => Youla.componentInitialize(el));
    Youla.componentWatch(el => Youla.componentInitialize(el));
    await tick();

    const clones = document.querySelectorAll('div.clone');
    // 4, not 3: the u-each template itself stays in the DOM (CSS-hidden via [u-each]).
    expect(clones.length).toBe(4);
    clones.forEach(clone => expect(clone.__x).toBeTruthy());

    const inputs = document.querySelectorAll('input.f');
    type(inputs[1], 'row-1');
    await tick();

    const main = document.querySelector('main');
    expect(main.__x.data.shared).toBe('row-1');
    // Every clone shares the one hoisted key, so u-prop's "alwaysSync" re-syncs every field.
    inputs.forEach(input => expect(input.value).toBe('row-1'));
  });

  it('does not re-initialize (and does not throw) if the same node is somehow observed twice', async () => {
    Youla.componentWatch(el => Youla.componentInitialize(el));

    const el = document.createElement('div');
    el.setAttribute('u-data', '{}');
    document.body.appendChild(el);
    await tick();

    const firstInstance = el.__x;
    expect(firstInstance).toBeTruthy();

    // An unrelated mutation in the same subtree must not hand the already-initialized node back.
    const sibling = document.createElement('span');
    document.body.appendChild(sibling);
    await tick();

    expect(el.__x).toBe(firstInstance);
  });
});
