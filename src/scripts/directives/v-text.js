import { directive } from '../directives';

/**
 * @param {*} value
 * @returns {boolean} true when value is a non-null object that isn't an array.
 */
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {string|undefined} char - a single character (or undefined, for an out-of-bounds string index).
 * @returns {boolean} true when char is a letter, digit, or underscore in any script.
 */
function isWordChar(char) {
  return char !== undefined && /[\p{L}\p{N}_]/u.test(char);
}

/**
 * Finds every index in `text` where `needle` occurs without touching another
 * letter/digit/underscore on either side, so e.g. "5" can't match inside "2025".
 *
 * @param {string} text
 * @param {string} needle
 * @returns {number[]} the starting index of each isolated occurrence.
 */
function findIsolatedOccurrences(text, needle) {
  const positions = [];
  let from = 0, index;

  while ((index = text.indexOf(needle, from)) !== -1) {
    if (!isWordChar(text[index - 1]) && !isWordChar(text[index + needle.length])) {
      positions.push(index);
    }
    from = index + 1;
  }

  return positions;
}

/**
 * Turns already-rendered text plus the values that produced it into a reusable
 * template: locates each value once, splits the text around it, and remembers
 * the static parts. A key is skipped (with a console warning) when its value
 * can't be matched exactly once, or when its match collides with another
 * key's — the text around a skipped key stays untouched on every future
 * update instead of being guessed at.
 *
 * @param {HTMLElement} el - the element being compiled, used only for warning messages.
 * @param {string} text - the element's currently-rendered text content.
 * @param {object} data - the object passed to v-text, mapping keys to their current values.
 * @returns {Array<string|{key: string}>} an ordered list of static text chunks interleaved with placeholder references.
 */
function compilePlaceholders(el, text, data) {
  const tag = el.tagName.toLowerCase();
  const candidates = [];

  for (const [key, value] of Object.entries(data)) {
    if (isPlainObject(value) || Array.isArray(value) || typeof value === 'function' || value === undefined) {
      console.warn(`Youla.js: v-text placeholder "${key}" on <${tag}> is a ${typeof value} — only strings, numbers and booleans can be matched. Skipped.`);
      continue;
    }

    const needle = String(value);
    if (needle === '') {
      console.warn(`Youla.js: v-text placeholder "${key}" on <${tag}> is an empty string — nothing to match. Skipped.`);
      continue;
    }

    const positions = findIsolatedOccurrences(text, needle);

    if (positions.length === 0) {
      console.warn(`Youla.js: v-text placeholder "${key}" (value "${needle}") wasn't found in <${tag}>'s text. Skipped.`);
      continue;
    }

    if (positions.length > 1) {
      console.warn(`Youla.js: v-text placeholder "${key}" (value "${needle}") matches ${positions.length} places in <${tag}>'s text — too ambiguous to track. Skipped.`);
      continue;
    }

    candidates.push({ key, start: positions[0], end: positions[0] + needle.length });
  }

  candidates.sort((a, b) => a.start - b.start);

  const accepted = candidates.filter((candidate, i) => {
    const prev = candidates[i - 1];
    const next = candidates[i + 1];
    const collides = (prev && prev.end > candidate.start) || (next && next.start < candidate.end);

    if (collides) {
      console.warn(`Youla.js: v-text placeholder "${candidate.key}" on <${tag}> overlaps another placeholder's match. Skipped.`);
    }

    return !collides;
  });

  const segments = [];
  let cursor = 0;

  accepted.forEach(({ key, start, end }) => {
    segments.push(text.slice(cursor, start));
    segments.push({ key });
    cursor = end;
  });
  segments.push(text.slice(cursor));

  return segments;
}

/**
 * Rebuilds an element's text from a compiled segment list, substituting each
 * placeholder with the current value of its key.
 *
 * @param {Array<string|{key: string}>} segments - the list returned by compilePlaceholders.
 * @param {object} data - the object passed to v-text, mapping keys to their current values.
 * @returns {string} the fully rendered text.
 */
function renderSegments(segments, data) {
  return segments.map(segment => typeof segment === 'string' ? segment : String(data[segment.key] ?? '')).join('');
}

/**
 * Sets the element's text content from the bound expression. If the
 * expression evaluates to a plain object instead of a string or number, each
 * property's value is matched against a substring already present in the
 * element's rendered text and tracked as an independent placeholder that
 * updates on its own when that property changes (see compilePlaceholders).
 *
 * @param {HTMLElement} el - the element the directive is on.
 * @param {*} output - the directive attribute's expression, evaluated against the component's data.
 * @param {object} attribute - the parsed attribute descriptor (directive name, modifiers, raw expression, etc. — see parseAttribute in ../helpers).
 * @param {Component} component - the owning component instance.
 */
directive('text', (el, output, attribute, component) => {
  if (isPlainObject(output)) {
    // First pass: compile placeholders from whatever is already rendered — that
    // text already matches the current data by construction, so there's nothing
    // to write yet (no flicker, no layout shift).
    if (!el._x_text_segments) {
      el._x_text_segments = compilePlaceholders(el, el.textContent, output);
      el._x_text = el.textContent;
      return;
    }

    output = renderSegments(el._x_text_segments, output);
  }

  output = output ?? '';

  // textContent is layout-independent (unlike innerText, which forces a
  // reflow and varies across browsers for hidden elements).
  if (el._x_text === output) {
    return;
  }

  el._x_text = output;
  el.textContent = output;
});
