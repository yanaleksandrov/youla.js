import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Youla } from '../scripts/index';

function tick(ms = 20) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

beforeEach(() => {
  window.Youla = Youla;
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
  document.body.removeAttribute('u-data');
  delete document.body.__x;
  vi.restoreAllMocks();
});

describe('component initialization order', () => {
  it('@load on an ancestor can reach a component that is initialized after it', async () => {
    Youla.data('dialog', () => ({
      options: null,
      init(options) {
        this.options = options;
      },
    }));
    Youla.variable('dialog', () => document.querySelector('[u-data="dialog"]')?.__x?.data);

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    document.body.setAttribute('u-data', '');
    document.body.innerHTML = `
      <div u-data="dialog"></div>
      <template @load="$dialog.init({ title: 'Hello' })"></template>
    `;

    Youla.componentDiscover(el => Youla.componentInitialize(el));
    await tick();

    const dialog = document.querySelector('[u-data="dialog"]').__x;
    expect(errorSpy).not.toHaveBeenCalled();
    expect(dialog).toBeDefined();
    expect(dialog.data.options).toEqual({ title: 'Hello' });
  });

  it('a component that throws during initialization does not stop the rest', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    document.body.innerHTML = `
      <div id="broken" u-data="{ value: missingVariable.prop }"></div>
      <div id="healthy" u-data="{ value: 1 }"></div>
    `;

    Youla.componentDiscover(el => Youla.componentInitialize(el));
    await tick();

    expect(errorSpy).toHaveBeenCalled();
    expect(document.getElementById('broken').__x).toBeUndefined();
    expect(document.getElementById('healthy').__x.data.value).toBe(1);
  });
});
