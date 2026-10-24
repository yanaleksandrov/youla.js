import { describe, it, expect, afterEach, vi } from 'vitest';
import { Filler } from '../youla-filler';

function mount(attrs = {}, options = {}) {
  const input = Object.assign(document.createElement('input'), { type: 'text', value: '#FF0000' });
  Object.entries(attrs).forEach(([key, value]) => input.setAttribute(key, value));
  document.body.appendChild(input);
  return new Filler(input, { customPaletteKey: null, ...options });
}

/**
 * jsdom has no ClipboardEvent constructor with clipboardData, so a plain event carries a stub.
 */
function paste(el, text) {
  const event = new Event('paste', { cancelable: true });
  event.clipboardData = { getData: () => text };
  el.dispatchEvent(event);
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('Filler opacity option', () => {
  it('keeps transparency controls by default', () => {
    const filler = mount({ 'data-alpha': '40' });
    expect(filler.alphaInput).toBeTruthy();
    expect(filler.hsva.a).toBe(40);

    filler.openDialog();
    expect(filler.dialogAlpha).toBeTruthy();
    expect(filler.dialogFieldInputs).toHaveLength(2);
  });

  it('creates no transparency controls and ignores alpha / data-alpha when disabled', () => {
    const filler = mount({ 'data-alpha': '40' }, { opacity: false, alpha: 20 });
    expect(filler.alphaInput).toBeUndefined();
    expect(filler.wrapper.querySelector('.filler-alpha')).toBeNull();
    expect(filler.hsva.a).toBe(100);

    filler.openDialog();
    expect(filler.dialogAlpha).toBeUndefined();
    expect(filler.dialog.querySelector('.filler-dialog-alpha')).toBeNull();
    // HEX only, no "A".
    expect(filler.dialogFieldInputs).toHaveLength(1);
    filler.format = 'rgb';
    filler.renderDialogFields();
    expect(filler.dialogFieldInputs).toHaveLength(3);
  });

  it('drops alpha from 8-digit hex input and pasted colors', () => {
    const filler = mount({}, { opacity: false });

    filler.el.value = '#00FF0080';
    filler.el.dispatchEvent(new Event('input'));
    expect(filler.hex).toBe('#00FF00');
    expect(filler.hsva.a).toBe(100);

    paste(filler.el, 'rgba(0, 0, 255, 0.5)');
    expect(filler.hex).toBe('#0000FF');
    expect(filler.hsva.a).toBe(100);
  });

  it('always formats an opaque value', () => {
    const filler = mount({}, { opacity: false });
    filler.hsva.a = 50;
    expect(filler.getFormattedValue()).toBe('#FF0000');
    filler.format = 'rgb';
    expect(filler.getFormattedValue()).toBe('rgb(255, 0, 0)');
    filler.format = 'hsl';
    expect(filler.getFormattedValue()).toBe('hsl(0, 100%, 50%)');
  });

  it('toggles on the fly via update()', () => {
    const filler = mount({ 'data-alpha': '40' });
    filler.openDialog();
    const onChange = vi.fn();
    filler.el.addEventListener('change', onChange);

    filler.update({ opacity: false });
    expect(filler.hsva.a).toBe(100);
    expect(filler.alphaWrapper.hidden).toBe(true);
    expect(filler.dialogAlpha.hidden).toBe(true);
    expect(filler.dialogFieldInputs).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(1);

    // Same value again is a no-op (the directive re-sends options on every re-evaluation).
    filler.update({ opacity: false });
    expect(onChange).toHaveBeenCalledTimes(1);

    filler.update({ opacity: true });
    expect(filler.alphaWrapper.hidden).toBe(false);
    expect(filler.dialogAlpha.hidden).toBe(false);
    expect(filler.dialogFieldInputs).toHaveLength(2);
  });

  it('builds skipped controls when enabled later', () => {
    const filler = mount({}, { opacity: false });
    filler.openDialog();

    filler.update({ opacity: true });
    expect(filler.alphaInput.value).toBe('100');
    expect(filler.dialogAlpha.previousElementSibling).toBe(filler.dialogHue);

    filler.setAlpha(30);
    expect(filler.getFormattedValue()).toBe('#FF00004D');
  });
});
