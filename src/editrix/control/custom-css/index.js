// The "custom-css" control — a lightweight, dependency-free CSS editor for the toolbox's Advanced
// section: a line-number gutter (customCssGutter(), pure-CSS counters — see custom-css.scss) next
// to a transparent <textarea> layered exactly over a <pre><code> that mirrors its text live,
// as you type, through a small hand-rolled CSS highlighter (highlightCss() below) — chosen over
// pulling in a real code-editor library since the only language this ever edits is CSS. Its value
// uses "selector" as a placeholder for this block's own root element, same convention as
// Elementor's own Custom CSS — the placeholder is swapped for a real selector and injected as a
// <style> tag by youla-editrix.js's syncCustomCss() (called from container()'s own ':style'
// binding, since that's the reactive spot that already reruns whenever this block's settings
// change).
// "name" comes from the closest ".editrix-field" wrapper's own "data-name".

import { fieldName } from '../../controls/base';

// Auto-closed on typing the opener; typing the very same closer while it's already sitting right
// under the cursor just moves past it instead of doubling it up (checked via CLOSERS below).
const PAIRS = {
  '{': '}', '(': ')', '[': ']', '"': '"', "'": "'",
};
const CLOSERS = new Set(Object.values(PAIRS));

// One tab stop, both for the Tab key itself and for auto-indenting a new line (below).
const INDENT = '  ';

/**
 * How many "{"s outnumber "}"s in "text" — a simple brace count (not full CSS parsing, same
 * lightweight-not-a-parser spirit as highlightCss() below), used to pick a new line's own indent.
 *
 * @param {string} text
 * @returns {number}
 */
function braceDepth(text) {
  return Math.max(0, (text.match(/\{/g) || []).length - (text.match(/\}/g) || []).length);
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * A small hand-rolled CSS tokenizer — not a full parser, just enough to color comments, strings,
 * at-rules, hex colors, numbers/units, and — tracked via brace depth, so a pseudo-class like
 * "selector:hover" isn't mistaken for a "selector: value" declaration — property names/values vs.
 * plain selector text.
 *
 * @param {string} code
 * @returns {string} HTML, safe to assign via v-html — every token is already escaped.
 */
function highlightCss(code) {
  const out = [];
  let i = 0;
  let depth = 0;
  let atPropertyStart = true;

  const push = (text, cls) => {
    out.push(cls ? `<span class="editrix-code-${cls}">${escapeHtml(text)}</span>` : escapeHtml(text));
  };

  while (i < code.length) {
    const rest = code.slice(i);
    const ch = rest[0];

    const comment = rest.match(/^\/\*[\s\S]*?(?:\*\/|$)/);
    if (comment) {
      push(comment[0], 'comment');
      i += comment[0].length;
      continue;
    }

    const string = rest.match(/^"(?:[^"\\]|\\.)*"|^'(?:[^'\\]|\\.)*'/);
    if (string) {
      push(string[0], 'string');
      i += string[0].length;
      continue;
    }

    if (ch === '{' || ch === '}' || ch === ';' || ch === ':') {
      if (ch === '{') {
        depth += 1;
        atPropertyStart = true;
      } else if (ch === '}') {
        depth = Math.max(0, depth - 1);
        atPropertyStart = true;
      } else if (ch === ';') {
        atPropertyStart = true;
      } else {
        atPropertyStart = false;
      }
      push(ch, 'punct');
      i += 1;
      continue;
    }

    if (depth > 0 && atPropertyStart) {
      const property = rest.match(/^(--[\w-]+|[\w-]+)/);
      if (property) {
        push(property[0], 'property');
        i += property[0].length;
        continue;
      }
    }

    const atrule = rest.match(/^@[\w-]+/);
    if (atrule) {
      push(atrule[0], 'atrule');
      i += atrule[0].length;
      continue;
    }

    if (depth > 0) {
      const color = rest.match(/^#[0-9a-f]{3,8}\b/i);
      if (color) {
        push(color[0], 'color');
        i += color[0].length;
        continue;
      }
    }

    const number = rest.match(/^-?\d*\.?\d+[a-z%]*/i);
    if (number) {
      push(number[0], 'number');
      i += number[0].length;
      continue;
    }

    if (depth > 0) {
      const value = rest.match(/^[a-z-][\w-]*/i);
      if (value) {
        push(value[0], 'value');
        i += value[0].length;
        continue;
      }
    }

    if (depth === 0) {
      const selector = rest.match(/^[^{}/"'@]+/);
      if (selector) {
        push(selector[0], 'selector');
        i += selector[0].length;
        continue;
      }
    }

    push(ch, null);
    i += 1;
  }

  return out.join('');
}

export function createCustomCssControl() {
  return {
    /**
     * v-bind="e.customCssEditor()" on the <textarea> itself — value/typing, plus a couple of
     * plain-code-editor conveniences: Tab indents instead of moving focus; brackets/quotes
     * auto-close (typing one already sitting under the cursor just moves past it); and Enter
     * indents the new line to match its own brace depth (braceDepth() above), dedenting again on
     * a "}" that closes an otherwise-still-blank line.
     *
     * The textarea's own text stays transparent throughout (custom-css.scss), with the colored
     * <pre> mirror showing through it live, as you type — every metric that affects where a
     * glyph lands (font-size, line-height, padding, border-width, box-sizing) is declared once in
     * custom-css.scss and shared verbatim between the two, since that's what keeps the real caret
     * lined up with the highlighted text under it.
     */
    customCssEditor() {
      return {
        ':value'() {
          return this.getValue(fieldName(this.$el)) ?? '';
        },
        '@input'(e) {
          this.setValue(fieldName(this.$el), e.target.value);
        },
        // Mirrors scroll position onto the highlighted <pre> and the line-number gutter, since
        // neither is the element the user is actually scrolling.
        '@scroll'() {
          const wrapper = this.$el.closest('.editrix-code');
          const highlight = wrapper?.querySelector('.editrix-code__highlight');
          const gutter = wrapper?.querySelector('.editrix-code__gutter');

          if (highlight) {
            highlight.scrollTop = this.$el.scrollTop;
            highlight.scrollLeft = this.$el.scrollLeft;
          }
          if (gutter) {
            gutter.scrollTop = this.$el.scrollTop;
          }
        },
        '@keydown'(e) {
          const el = this.$el;
          const name = fieldName(el);
          const { selectionStart: start, selectionEnd: end, value } = el;

          if (e.key === 'Tab') {
            e.preventDefault();
            el.value = `${value.slice(0, start)}${INDENT}${value.slice(end)}`;
            el.selectionStart = start + INDENT.length;
            el.selectionEnd = start + INDENT.length;
            this.setValue(name, el.value);
            return;
          }

          // Auto-indents the new line to match how deep it sits inside "{ }" — a property line
          // gets one tab per enclosing rule. Pressing Enter right where "{" just auto-closed into
          // "{|}" (PAIRS below) splits it across three lines instead of one, cursor landing on its
          // own indented middle line, same as a real code editor.
          if (e.key === 'Enter') {
            e.preventDefault();
            const before = value.slice(0, start);
            const after = value.slice(end);
            const indent = INDENT.repeat(braceDepth(before));

            if (before.endsWith('{') && after.startsWith('}')) {
              const outdent = INDENT.repeat(Math.max(0, braceDepth(before) - 1));
              el.value = `${before}\n${indent}\n${outdent}${after}`;
              const pos = start + 1 + indent.length;
              el.selectionStart = pos;
              el.selectionEnd = pos;
            } else {
              el.value = `${before}\n${indent}${after}`;
              const pos = start + 1 + indent.length;
              el.selectionStart = pos;
              el.selectionEnd = pos;
            }
            this.setValue(name, el.value);
            return;
          }

          // Dedents one tab stop when "}" closes a line that's otherwise still blank, so the
          // brace lines up with the rule it closes rather than sitting under its own properties.
          if (e.key === '}' && start === end) {
            const lineStart = value.lastIndexOf('\n', start - 1) + 1;
            const linePrefix = value.slice(lineStart, start);

            if (linePrefix && /^\s+$/.test(linePrefix)) {
              e.preventDefault();
              const outdent = INDENT.repeat(Math.max(0, braceDepth(value.slice(0, lineStart)) - 1));
              const before = value.slice(0, lineStart);
              el.value = `${before}${outdent}}${value.slice(start)}`;
              const pos = lineStart + outdent.length + 1;
              el.selectionStart = pos;
              el.selectionEnd = pos;
              this.setValue(name, el.value);
              return;
            }
          }

          if (start === end && CLOSERS.has(e.key) && value[start] === e.key) {
            e.preventDefault();
            el.selectionStart = start + 1;
            el.selectionEnd = start + 1;
            return;
          }

          if (PAIRS[e.key] && start === end) {
            e.preventDefault();
            el.value = `${value.slice(0, start)}${e.key}${PAIRS[e.key]}${value.slice(end)}`;
            el.selectionStart = start + 1;
            el.selectionEnd = start + 1;
            this.setValue(name, el.value);
          }
        },
      };
    },

    /**
     * v-bind="e.customCssHighlight()" on the <code> mirror sitting behind the textarea.
     */
    customCssHighlight() {
      return {
        'v-html'() {
          return highlightCss(this.getValue(fieldName(this.$el)) ?? '');
        },
      };
    },

    /**
     * v-bind="e.customCssGutter()" on the line-number gutter's own <code> — one empty
     * ".editrix-code-line" per line, so custom-css.scss's own "counter-increment"/"counter()" does
     * the actual numbering; this only has to get the *count* right; open-ended
     * ("no third-party library") but the digits themselves are pure CSS.
     */
    customCssGutter() {
      return {
        'v-html'() {
          const lineCount = (this.getValue(fieldName(this.$el)) ?? '').split('\n').length;
          return '<div class="editrix-code-line"></div>'.repeat(lineCount);
        },
      };
    },
  };
}
