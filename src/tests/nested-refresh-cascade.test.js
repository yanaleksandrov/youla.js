import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';
import '../scripts/directives/u-each';
import '../scripts/directives/u-text';

function initAll() {
  Youla.componentDiscover(el => Youla.componentInitialize(el));
}

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function type(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

// Regression: a nested "u-data" component only ever refreshed its own subtree based on its own
// "concernedData" (see Component#flush()); an ancestor's change never reached a binding declared
// *inside* a nested child (only a sibling elsewhere in the ancestor's own tree — already covered
// by nested-scope.test.js). u-each's own items expression was also evaluated against
// "component.data" instead of "component.scope", so it couldn't see an ancestor-owned collection
// at all. Component#flush() now cascades down through every "u-data" child synchronously, so a
// change reaches every descendant within the same tick regardless of nesting depth.
describe('a nested u-data component reacts to an ancestor-initiated change', () => {
  it('a binding declared inside a nested child updates when the parent changes its own data', async () => {
    document.body.innerHTML = `
      <div u-data="{ login: '' }">
        <button id="fill" type="button" @click="login = 'filled'"></button>
        <div u-data="{} as p">
          <span id="out" :data-login="login"></span>
        </div>
      </div>
    `;
    initAll();
    await tick();

    click(document.getElementById('fill'));
    await tick();

    expect(document.getElementById('out').getAttribute('data-login')).toBe('filled');
  });

  it('u-each inside a nested child renders an ancestor-owned array and re-renders when the parent mutates it', async () => {
    document.body.innerHTML = `
      <div u-data="{ items: ['a'] }">
        <button id="add" type="button" @click="items.push('b')"></button>
        <div u-data="{} as p">
          <ul>
            <li u-each="item in items" u-text="item"></li>
          </ul>
        </div>
      </div>
    `;
    initAll();
    await tick();

    expect(document.querySelectorAll('li:not([u-each])').length).toBe(1);

    click(document.getElementById('add'));
    await tick();

    expect(document.querySelectorAll('li:not([u-each])').length).toBe(2);
  });

  it('cascades through 3 levels of nesting within a single tick, however deep', async () => {
    document.body.innerHTML = `
      <div u-data="{ count: 0 }">
        <button id="inc" type="button" @click="count++"></button>
        <div u-data="{} as mid">
          <div u-data="{} as leaf">
            <span id="out" :data-count="count"></span>
          </div>
        </div>
      </div>
    `;
    initAll();
    await tick();

    click(document.getElementById('inc'));
    await tick();
    expect(document.getElementById('out').getAttribute('data-count')).toBe('1');

    click(document.getElementById('inc'));
    await tick();
    expect(document.getElementById('out').getAttribute('data-count')).toBe('2');
  });

  it('a deeply nested u-prop write reaches a binding at the very top', async () => {
    document.body.innerHTML = `
      <div u-data="{ login: '' }">
        <span id="topOut" :data-login="login"></span>
        <div u-data="{} as l1">
          <div u-data="{} as l2">
            <input id="login" u-prop="login">
          </div>
        </div>
      </div>
    `;
    initAll();
    await tick();

    type(document.getElementById('login'), 'deep-value');
    await tick();

    expect(document.getElementById('topOut').getAttribute('data-login')).toBe('deep-value');
  });

  it('a mid-level local property shadows the root one for a leaf below it', async () => {
    document.body.innerHTML = `
      <div u-data="{ login: 'root-value' }">
        <button id="setRoot" type="button" @click="login = 'root-changed'"></button>
        <div u-data="{ login: 'mid-value' } as mid">
          <button id="setMid" type="button" @click="login = 'mid-changed'"></button>
          <div u-data="{} as leaf">
            <span id="out" :data-login="login"></span>
          </div>
        </div>
      </div>
    `;
    initAll();
    await tick();

    expect(document.getElementById('out').getAttribute('data-login')).toBe('mid-value');

    // Root's own change must not leak through — the leaf resolves "login" from mid, which shadows root.
    click(document.getElementById('setRoot'));
    await tick();
    expect(document.getElementById('out').getAttribute('data-login')).toBe('mid-value');

    // Mid's own change must still reach the leaf.
    click(document.getElementById('setMid'));
    await tick();
    expect(document.getElementById('out').getAttribute('data-login')).toBe('mid-changed');
  });

  it('sibling nested components each keep their own local state independent of one another', async () => {
    document.body.innerHTML = `
      <div u-data="{}">
        <div u-data="{ count: 0 } as a">
          <button id="incA" type="button" @click="count++"></button>
          <span id="outA" :data-count="count"></span>
        </div>
        <div u-data="{ count: 100 } as b">
          <span id="outB" :data-count="count"></span>
        </div>
      </div>
    `;
    initAll();
    await tick();

    click(document.getElementById('incA'));
    await tick();

    expect(document.getElementById('outA').getAttribute('data-count')).toBe('1');
    expect(document.getElementById('outB').getAttribute('data-count')).toBe('100');
  });
});
