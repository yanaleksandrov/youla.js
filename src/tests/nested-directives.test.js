import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';
import '../scripts/directives/u-each';
import '../scripts/directives/u-text';
import '../scripts/directives/u-show';
import '../scripts/directives/u-html';

function initAll() {
  Youla.componentDiscover(el => Youla.componentInitialize(el));
}

function click(el) {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
}

function check(el, value) {
  el.checked = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
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

// Regression: Component#initialize() built a checkbox's u-prop change-listener expression via
// generateExpressionForProp(el, self.data, ...) — self.data only, not self.scope — so it could
// never see an array owned by an ancestor (see the "scope" getter) and always fell back to the
// non-array "$el.checked" branch, silently overwriting the ancestor's array with a boolean
// instead of toggling the checkbox's value in and out of it.
describe('checkbox arrays inside a nested u-data reading an ancestor-owned array', () => {
  it('toggles the ancestor array and reflects across siblings', async () => {
    document.body.innerHTML = `
      <div u-data="{ tags: [] }">
        <span id="out" u-text="tags.join(',')"></span>
        <div u-data="{} as p">
          <input type="checkbox" id="a" u-prop="tags" value="a">
          <input type="checkbox" id="b" u-prop="tags" value="b">
        </div>
      </div>
    `;
    initAll();
    await tick();

    check(document.getElementById('a'), true);
    await tick();
    expect(document.getElementById('out').textContent).toBe('a');

    check(document.getElementById('b'), true);
    await tick();
    expect(document.getElementById('out').textContent).toBe('a,b');

    check(document.getElementById('a'), false);
    await tick();
    expect(document.getElementById('out').textContent).toBe('b');
  });
});

describe('u-each with "join" inside a nested component over an ancestor array', () => {
  it('renders separators between items', async () => {
    document.body.innerHTML = `
      <div u-data="{ items: ['x', 'y', 'z'] }">
        <div u-data="{} as p">
          <span u-each="item in items join ', '" u-text="item"></span>
        </div>
      </div>
    `;
    initAll();
    await tick();

    const container = document.querySelector('div[u-data] div[u-data]');
    expect(container.textContent.trim()).toBe('x, y, z');
  });
});

describe('u-show/u-html work normally inside a nested component reading ancestor data', () => {
  it('u-show toggles visibility based on ancestor-owned boolean', async () => {
    document.body.innerHTML = `
      <div u-data="{ visible: false }">
        <button id="toggle" type="button" @click="visible = !visible"></button>
        <div u-data="{} as p">
          <div id="target" u-show="visible"></div>
        </div>
      </div>
    `;
    initAll();
    await tick();

    expect(document.getElementById('target').style.display).toBe('none');

    click(document.getElementById('toggle'));
    await tick();

    expect(document.getElementById('target').style.display).not.toBe('none');
  });

  it('u-html renders ancestor-owned markup inside a nested component', async () => {
    document.body.innerHTML = `
      <div u-data="{ markup: '<b>hi</b>' }">
        <div u-data="{} as p">
          <div id="target" u-html="markup"></div>
        </div>
      </div>
    `;
    initAll();
    await tick();

    expect(document.getElementById('target').innerHTML).toBe('<b>hi</b>');
  });
});

describe('u-bind expression inside a nested component, referencing ancestor data', () => {
  it('expands to individual bound attributes reactively', async () => {
    document.body.innerHTML = `
      <div u-data="{ label: 'go' }">
        <button id="fill" type="button" @click="label = 'stop'"></button>
        <div u-data="{} as p">
          <button id="target" u-bind="{ ':data-label': 'label' }"></button>
        </div>
      </div>
    `;
    initAll();
    await tick();

    expect(document.getElementById('target').getAttribute('data-label')).toBe('go');

    click(document.getElementById('fill'));
    await tick();

    expect(document.getElementById('target').getAttribute('data-label')).toBe('stop');
  });
});
