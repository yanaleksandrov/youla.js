import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest';

let pickadateDirective;

beforeAll(async () => {
  window.Youla = { directive: (name, fn) => { pickadateDirective = fn; } };
  await import('../youla-pickadate');
  document.dispatchEvent(new Event('youla:init'));
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const tick = () => new Promise((resolve) => setTimeout(resolve));

function mount(value = '') {
  document.body.innerHTML = `<form id="f"><div><label><input name="date" form="f" value="${value}"></label></div></form>`;
  const el = document.querySelector('input');
  const events = [];
  document.body.addEventListener('input', (e) => e.target.type === 'hidden' && events.push('input'));
  document.body.addEventListener('change', (e) => e.target.type === 'hidden' && events.push('change'));
  return { el, events, hidden: () => document.querySelectorAll('input[type=hidden]') };
}

describe('u-pickadate', () => {
  it('moves the name to a hidden field holding the ISO value', () => {
    const { el, hidden } = mount('2026-10-19');
    pickadateDirective(el, { dateFormat: 'dd.MM.yyyy' });

    expect(hidden()).toHaveLength(1);
    expect(hidden()[0].name).toBe('date');
    expect(hidden()[0].getAttribute('form')).toBe('f');
    expect(el.hasAttribute('name')).toBe(false);
    expect(el.value).toBe('19.10.2026');
    expect(hidden()[0].value).toBe('2026-10-19');
  });

  it('formats values like native inputs', () => {
    const cases = [
      ['2026-10-19T09:05', { timepicker: true }, '2026-10-19T09:05'],
      ['2026-10', { minView: 'months', view: 'months' }, '2026-10'],
      ['2026', { minView: 'years', view: 'years' }, '2026'],
      ['2026-10-01,2026-10-05', { range: true }, '2026-10-01,2026-10-05'],
      ['2026-10-01,2026-10-05,2026-10-07', { multipleDates: true }, '2026-10-01,2026-10-05,2026-10-07'],
    ];

    for (const [value, options, expected] of cases) {
      const { el, hidden } = mount(value);
      pickadateDirective(el, options);
      expect(hidden()[0].value).toBe(expected);
    }
  });

  it('keeps today with the given time for "onlyTimepicker"', () => {
    const { el, hidden } = mount('14:30');
    pickadateDirective(el, { timepicker: true, onlyTimepicker: true });

    expect(hidden()[0].value).toBe('14:30');
    expect(el._x_pickadate.selectedDates[0].getDate()).toBe(new Date().getDate());
  });

  it('keeps a non-ISO value as is and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { el, hidden } = mount('19.10.2026');
    pickadateDirective(el, {});

    expect(hidden()[0].value).toBe('19.10.2026');
    expect(warn).toHaveBeenCalledOnce();
  });

  it('syncs the hidden field on select and clear', async () => {
    const { el, events, hidden } = mount('2026-10-19');
    pickadateDirective(el, {});
    await tick();
    expect(events).toEqual([]);

    el._x_pickadate.selectDate(new Date(2026, 9, 20));
    await tick();
    expect(hidden()[0].value).toBe('2026-10-20');
    expect(events).toEqual(['input', 'change']);

    el._x_pickadate.clear();
    await tick();
    expect(hidden()[0].value).toBe('');
    expect(events).toEqual(['input', 'change', 'input', 'change']);
  });

  it('clears the selection when the text is erased manually', async () => {
    const { el, hidden } = mount('2026-10-19');
    pickadateDirective(el, {});

    el.value = '';
    el.dispatchEvent(new Event('input'));
    await tick();

    expect(el._x_pickadate.selectedDates).toEqual([]);
    expect(hidden()[0].value).toBe('');
  });

  it('restores the field on destroy and re-init without duplicates', () => {
    const { el, hidden } = mount('2026-10-19');
    pickadateDirective(el, {});
    pickadateDirective(el, {});
    expect(hidden()).toHaveLength(1);

    el._x_pickadate.destroy();
    expect(hidden()).toHaveLength(0);
    expect(el.name).toBe('date');
    expect(el.getAttribute('form')).toBe('f');
    expect(el.value).toBe('2026-10-19');
  });

  describe('form reset', () => {
    const settle = async () => {
      for (let i = 0; i < 4; i++) await tick();
    };

    it('restores the initial date in both fields', async () => {
      const { el, events, hidden } = mount('2026-10-16T17:45');
      pickadateDirective(el, { timepicker: true, dateFormat: 'dd.MM.yyyy' });
      const visible = el.value;
      expect(visible).toContain('16.10.2026');

      el._x_pickadate.selectDate(new Date(2026, 9, 20, 9, 30));
      await settle();
      expect(hidden()[0].value).toBe('2026-10-20T09:30');
      events.length = 0;

      el.form.reset();
      await settle();

      expect(el.value).toBe(visible);
      expect(hidden()[0].value).toBe('2026-10-16T17:45');
      expect(el._x_pickadate.selectedDates).toHaveLength(1);
      expect(el._x_pickadate.selectedDates[0].getDate()).toBe(16);
      expect(events).toEqual([]);
    });

    it('keeps an empty field empty', async () => {
      const { el, events, hidden } = mount('');
      pickadateDirective(el, {});

      el._x_pickadate.selectDate(new Date(2026, 9, 20));
      await settle();
      expect(hidden()[0].value).toBe('2026-10-20');
      events.length = 0;

      el.form.reset();
      await settle();

      expect(el.value).toBe('');
      expect(hidden()[0].value).toBe('');
      expect(el._x_pickadate.selectedDates).toEqual([]);
      expect(events).toEqual([]);
    });

    it('listens on a form referenced by the "form" attribute', async () => {
      document.body.innerHTML = `<form id="g"></form><div><input form="g" name="date" value="2026-10-19"></div>`;
      const el = document.querySelector('input');
      pickadateDirective(el, {});

      el._x_pickadate.selectDate(new Date(2026, 9, 25));
      await settle();

      document.getElementById('g').reset();
      await settle();

      expect(document.querySelector('input[type=hidden]').value).toBe('2026-10-19');
    });

    it('removes the reset listener on destroy', () => {
      const { el } = mount('2026-10-19');
      const add = vi.spyOn(el.form, 'addEventListener');
      const remove = vi.spyOn(el.form, 'removeEventListener');
      pickadateDirective(el, {});

      const onReset = add.mock.calls.find(([type]) => type === 'reset')[1];
      el._x_pickadate.destroy();

      expect(remove).toHaveBeenCalledWith('reset', onReset);
    });
  });
});
