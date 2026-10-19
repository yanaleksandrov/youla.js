import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { Youla } from '../scripts/index';
import '../scripts/directives/u-prop';

function tick(ms = 10) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

beforeAll(async () => {
  window.Youla = Youla;
  await import('../youla-select');
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
});

async function mount() {
  document.body.innerHTML = `
    <form u-data="{action: ''}">
      <select u-prop="action" u-select>
        <option value="">—</option>
        <option value="delete">Delete</option>
        <option value="archive">Archive</option>
      </select>
      <button :disabled="!action">Apply</button>
    </form>
  `;
  const form = document.querySelector('form');
  Youla.componentInitialize(form);
  await tick();

  return { form, select: form.querySelector('select'), button: form.querySelector('button') };
}

describe('u-prop on a single u-select', () => {
  it('updates the bound value after slim.setSelected()', async () => {
    const { form, select, button } = await mount();

    expect(select._x_slimSelect).toBeTruthy();
    expect(button.disabled).toBe(true);

    select._x_slimSelect.setSelected('delete');
    await tick();

    expect(form.__x.data.action).toBe('delete');
    expect(button.disabled).toBe(false);
  });

  it('updates the bound value on a "change" event alone', async () => {
    const { form, select, button } = await mount();

    select.value = 'archive';
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await tick();

    expect(form.__x.data.action).toBe('archive');
    expect(button.disabled).toBe(false);
  });
});
