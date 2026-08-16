import { directive } from '../directives';

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isWordChar(char) {
  return char !== undefined && /[\p{L}\p{N}_]/u.test(char);
}

// Every index in "text" where "needle" occurs without touching another
// letter/digit/underscore on either side, so "5" can't match inside "2025".
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

// Turns already-rendered text plus the values that produced it into a reusable
// template: locate each value once, split the text around it, and remember the
// static parts. A key is skipped (with a console warning) when its value can't
// be matched exactly once, or when its match collides with another key's — the
// text around a skipped key is left untouched on every future update instead
// of guessed at.
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

function renderSegments(segments, data) {
  return segments.map(segment => typeof segment === 'string' ? segment : String(data[segment.key] ?? '')).join('');
}

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
