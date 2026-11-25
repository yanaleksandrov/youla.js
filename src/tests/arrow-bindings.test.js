import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-text';

function tick(ms = 20) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function mount(html) {
  document.body.innerHTML = html;
  const root = document.body.firstElementChild;
  Youla.componentInitialize(root);
  return root;
}

beforeAll(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('arrow function bindings', () => {
  it('passes the context to attribute, directive and event bindings, tracking reads through it', async () => {
    Youla.data('arrowBoard', () => ({
      collapsed: [],
      label: 'Hello',
      title: () => ({ 'u-text': $ => $.label }),
      column: column => ({ ':class': $ => ({ 'is-collapsed': $.collapsed.includes(column) }) }),
      collapse: column => ({ '@click': (e, $) => $.collapsed.push(column) }),
    }));

    const root = mount(`
      <div u-data="arrowBoard">
        <h1 u-bind="title()"></h1>
        <button u-bind="column('a')"></button>
        <button u-bind="collapse('a')"></button>
      </div>
    `);
    const [column, toggle] = root.querySelectorAll('button');

    expect(root.querySelector('h1').textContent).toBe('Hello');
    expect(column.classList.contains('is-collapsed')).toBe(false);

    toggle.click();
    await tick();
    expect(column.classList.contains('is-collapsed')).toBe(true);

    root.__x.data.label = 'Bye';
    await tick();
    expect(root.querySelector('h1').textContent).toBe('Bye');
  });

  it('warns once about a parameterless arrow function using "this"', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    Youla.data('arrowThis', () => ({
      count: 0,
      text: () => ({ 'u-text': () => this.count }),
      plain: () => ({ 'u-text': () => 'static' }),
      method: () => ({ 'u-text'() { return this.count; } }),
    }));

    const root = mount(`
      <div u-data="arrowThis">
        <span u-bind="text()"></span>
        <span u-bind="plain()"></span>
        <span u-bind="method()"></span>
      </div>
    `);
    root.__x.data.count++;
    await tick();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('"u-text"');
  });
});
