import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseAttribute, getAttributes, updateAttribute } from '../scripts/attributes';

describe('parseAttribute', () => {
  it('parses a bind attribute (":")', () => {
    const parsed = parseAttribute(':disabled', 'isDisabled');
    expect(parsed.bind).toBe(true);
    expect(parsed.directive).toBe('');
    expect(parsed.event).toBe('');
    expect(parsed.expression).toBe('isDisabled');
  });

  it('parses an event attribute ("@")', () => {
    const parsed = parseAttribute('@click', 'doThing()');
    expect(parsed.event).toBe('click');
    expect(parsed.bind).toBe(false);
    expect(parsed.directive).toBe('');
  });

  it('parses a directive attribute ("u-")', () => {
    const parsed = parseAttribute('u-show', 'visible');
    expect(parsed.directive).toBe('u-show');
    expect(parsed.bind).toBe(false);
    expect(parsed.event).toBe('');
  });

  it('parses a plain attribute name with no prefix', () => {
    const parsed = parseAttribute('type', 'text');
    expect(parsed.bind).toBe(false);
    expect(parsed.directive).toBe('');
    expect(parsed.event).toBe('');
  });

  it('extracts modifiers from an event attribute', () => {
    const parsed = parseAttribute('@click.prevent.stop', 'go()');
    expect(parsed.event).toBe('click');
    expect(parsed.modifiers).toEqual(['prevent', 'stop']);
  });

  it('extracts modifiers from a directive attribute', () => {
    const parsed = parseAttribute('u-data.local.30d', '{}');
    expect(parsed.directive).toBe('u-data');
    expect(parsed.modifiers).toEqual(['local', '30d']);
  });

  it('extracts a bare duration modifier', () => {
    const parsed = parseAttribute('u-data.cookie.30d', '{}');
    expect(parsed.duration).toEqual({ value: 30, unit: 'd' });
  });

  it('returns null duration when no modifier matches the duration shape', () => {
    const parsed = parseAttribute('u-data.cookie', '{}');
    expect(parsed.duration).toBeNull();
  });

  it('finds a duration modifier anywhere in the modifier list', () => {
    const parsed = parseAttribute('@keydown.delay.250ms', 'go()');
    expect(parsed.duration).toEqual({ value: 250, unit: 'ms' });
  });

  it('marks a string value as non-literal (an expression)', () => {
    expect(parseAttribute(':disabled', 'isDisabled').literal).toBe(false);
  });

  it('marks a non-string value as literal', () => {
    expect(parseAttribute('disabled', true).literal).toBe(true);
    expect(parseAttribute('disabled', 42).literal).toBe(true);
  });

  it('keeps the original attribute name verbatim', () => {
    expect(parseAttribute('u-each.lazy', 'x in xs').name).toBe('u-each.lazy');
  });

  it('does not treat "u-" appearing mid-name as a directive prefix', () => {
    const parsed = parseAttribute('data-u-foo', 'x');
    expect(parsed.directive).toBe('');
    expect(parsed.bind).toBe(false);
  });
});

describe('getAttributes', () => {
  function el(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.firstElementChild;
  }

  it('collects only directive/event/bind attributes, ignoring plain ones', () => {
    const attrs = getAttributes(el('<button type="button" :disabled="x" @click="y()" u-show="z"></button>'));
    const names = attrs.map((a) => a.name);
    expect(names).toEqual([':disabled', '@click', 'u-show']);
  });

  it('returns an empty array for an element with no matching attributes', () => {
    const attrs = getAttributes(el('<div class="foo" id="bar"></div>'));
    expect(attrs).toEqual([]);
  });

  it('preserves DOM attribute order', () => {
    const attrs = getAttributes(el('<div u-show="a" :class="b" @click="c"></div>'));
    expect(attrs.map((a) => a.name)).toEqual(['u-show', ':class', '@click']);
  });

  it('caches the result on the element and reuses it when attributes are unchanged', () => {
    const node = el('<div :class="a"></div>');
    const first = getAttributes(node);
    const second = getAttributes(node);
    expect(second).toBe(first);
  });

  it('invalidates the cache when an attribute value changes', () => {
    const node = el('<div :class="a"></div>');
    const first = getAttributes(node);
    node.setAttribute(':class', 'b');
    const second = getAttributes(node);
    expect(second).not.toBe(first);
    expect(second[0].expression).toBe('b');
  });

  it('invalidates the cache when an attribute is added', () => {
    const node = el('<div :class="a"></div>');
    const first = getAttributes(node);
    // "@" is rejected by jsdom's setAttribute() (stricter Name-production check than real
    // browsers apply to parsed HTML), so exercise this with a "u-*" name instead.
    node.setAttribute('u-show', 'visible');
    const second = getAttributes(node);
    expect(second.length).toBe(2);
    expect(second).not.toBe(first);
  });
});

describe('updateAttribute', () => {
  let el;
  beforeEach(() => {
    el = document.createElement('div');
  });

  it('sets a generic attribute', () => {
    updateAttribute(el, 'title', 'hello');
    expect(el.getAttribute('title')).toBe('hello');
  });

  it('sets "value" on an input element', () => {
    const input = document.createElement('input');
    updateAttribute(input, 'value', 'hi');
    expect(input.value).toBe('hi');
  });

  it('sets a single selected option for a select element', () => {
    const select = document.createElement('select');
    select.innerHTML = '<option value="a">A</option><option value="b">B</option>';
    updateAttribute(select, 'value', 'b');
    expect(select.value).toBe('b');
  });

  it('sets multiple selected options for a select element via an array', () => {
    const select = document.createElement('select');
    select.multiple = true;
    select.innerHTML = '<option value="a">A</option><option value="b">B</option><option value="c">C</option>';
    updateAttribute(select, 'value', ['a', 'c']);
    expect(Array.from(select.selectedOptions).map((o) => o.value)).toEqual(['a', 'c']);
  });

  it.each(['disabled', 'readonly', 'required', 'checked', 'autofocus', 'autoplay', 'hidden'])(
    'sets boolean attribute "%s" as a present, empty attribute when truthy',
    (name) => {
      updateAttribute(el, name, true);
      expect(el.hasAttribute(name)).toBe(true);
      expect(el.getAttribute(name)).toBe('');
    }
  );

  it.each(['disabled', 'readonly', 'required', 'checked', 'autofocus', 'autoplay', 'hidden'])(
    'removes boolean attribute "%s" when falsy',
    (name) => {
      el.setAttribute(name, '');
      updateAttribute(el, name, false);
      expect(el.hasAttribute(name)).toBe(false);
    }
  );

  it('refuses to write an inline event-handler attribute and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    updateAttribute(el, 'onclick', 'alert(1)');
    expect(el.getAttribute('onclick')).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('refuses a "javascript:" URL on href and warns', () => {
    const a = document.createElement('a');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    updateAttribute(a, 'href', 'javascript:alert(1)');
    expect(a.getAttribute('href')).toBeNull();
    warn.mockRestore();
  });

  it('refuses a "javascript:" URL with whitespace inserted to dodge naive filters', () => {
    const a = document.createElement('a');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    updateAttribute(a, 'href', 'java\nscript:alert(1)');
    expect(a.getAttribute('href')).toBeNull();
    warn.mockRestore();
  });

  it('allows a normal http(s) URL on href', () => {
    const a = document.createElement('a');
    updateAttribute(a, 'href', 'https://example.com');
    expect(a.getAttribute('href')).toBe('https://example.com');
  });

  it('refuses a "javascript:" URL on src/action/formaction too', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const img = document.createElement('img');
    updateAttribute(img, 'src', 'javascript:alert(1)');
    expect(img.getAttribute('src')).toBeNull();

    const form = document.createElement('form');
    updateAttribute(form, 'action', 'javascript:alert(1)');
    expect(form.getAttribute('action')).toBeNull();
    warn.mockRestore();
  });

  it('sets a "class" via setClasses, adding missing classes', () => {
    updateAttribute(el, 'class', 'a b');
    expect(el.classList.contains('a')).toBe(true);
    expect(el.classList.contains('b')).toBe(true);
  });

  it('sets a "style" via setStyles, from an object', () => {
    updateAttribute(el, 'style', { color: 'red' });
    expect(el.style.color).toBe('red');
  });
});
