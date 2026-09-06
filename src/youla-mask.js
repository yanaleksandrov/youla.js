/**
 * A from-scratch, trimmed reimplementation of vanilla-text-mask's masking algorithm
 * (github.com/text-mask/text-mask), so u-mask needs no external script tag or npm dependency.
 * Given an array of literal characters and RegExp "slots", it conforms whatever's typed to that
 * shape and keeps the caret past the last character it actually accepted.
 *
 * Only what u-mask actually exercises survived the port: a single `mask`, and "guide" always off
 * (unfilled slots are never shown as trailing placeholder characters). The upstream library's
 * caret traps, pipes, keepCharPositions and IE-era fallbacks were all untested dead code here, so
 * they didn't come along.
 */
class TextMask {
  // Internal stand-in for a RegExp "slot" in the built placeholder template; a mask literal can't
  // use it too, or the algorithm couldn't tell a real "_" apart from an open slot (see buildPlaceholder).
  static PLACEHOLDER = '_';

  static IS_ANDROID = /Android/i.test(navigator.userAgent);

  /**
   * @param {HTMLInputElement} el
   * @param {(string|RegExp)[]|(rawValue: string) => (string|RegExp)[]} mask - one entry per
   *   position (a RegExp "slot", or a literal character), or a function returning one, called
   *   fresh on every keystroke — needed by a self-limiting slot (buildMaskTokens' `H`/`i`/`D`/`M`)
   *   whose accepted range depends on the digit already typed before it.
   */
  constructor(el, mask) {
    this.el = el;
    this.resolveMask = typeof mask === 'function' ? mask : () => mask;
    this.previousValue = '';
    this.previousPlaceholder = '';

    this.onInput = () => this.update(el.value);
    el.addEventListener('input', this.onInput);

    this.update(el.value);
  }

  destroy() {
    this.el.removeEventListener('input', this.onInput);
  }

  /** Re-conforms "rawValue" (the field's own current value by default) and writes it back. */
  update(rawValue = this.el.value) {
    if (rawValue === this.previousValue) {
      return;
    }

    const { previousValue, previousPlaceholder } = this;
    const { selectionEnd: caretPosition } = this.el;

    const mask = this.resolveMask(rawValue);
    const placeholder = TextMask.buildPlaceholder(mask);

    const conformedValue = TextMask.conform(rawValue, mask, placeholder, previousValue, caretPosition);
    const adjustedCaretPosition = TextMask.adjustCaretPosition({
      previousValue, previousPlaceholder, conformedValue, placeholder, rawValue, caretPosition,
    });

    this.previousValue = conformedValue;
    this.previousPlaceholder = placeholder;

    if (this.el.value === conformedValue) {
      return;
    }

    this.el.value = conformedValue;
    TextMask.setCaretPosition(this.el, adjustedCaretPosition);
  }

  /** "_H:__" style template: one PLACEHOLDER per RegExp slot, the mask's own literals elsewhere. */
  static buildPlaceholder(mask) {
    if (mask.includes(TextMask.PLACEHOLDER)) {
      throw new Error(`Youla.js: a u-mask pattern can't contain a literal "${TextMask.PLACEHOLDER}" — it's the placeholder character used internally.`);
    }
    return mask.map((token) => (token instanceof RegExp ? TextMask.PLACEHOLDER : token)).join('');
  }

  /**
   * Fits "rawValue" into "mask": a character that just retypes a literal already fixed at that
   * position is dropped (so typing straight through a fixed "-" separator doesn't duplicate it),
   * then each remaining character is tried, in order, against the next open slot's RegExp — a
   * rejected character is discarded and the next one tried against that same slot. Trims back to
   * the last slot actually filled once characters are deleted (no trailing placeholder shown).
   */
  static conform(rawValue, mask, placeholder, previousValue, caretPosition) {
    const { PLACEHOLDER } = TextMask;
    const editLength = rawValue.length - previousValue.length;
    const isAddition = editLength > 0;
    const indexOfFirstChange = caretPosition + (isAddition ? -editLength : 0);

    const rawChars = rawValue.split('');
    for (let i = rawValue.length - 1; i >= 0; i--) {
      const shouldOffset = i >= indexOfFirstChange && previousValue.length === mask.length;
      if (rawChars[i] === placeholder[shouldOffset ? i - editLength : i]) {
        rawChars.splice(i, 1);
      }
    }

    let conformedValue = '';
    placeholderLoop: for (let i = 0; i < placeholder.length; i++) {
      if (placeholder[i] !== PLACEHOLDER) {
        conformedValue += placeholder[i];
        continue;
      }

      while (rawChars.length > 0) {
        const rawChar = rawChars.shift();
        if (mask[i].test(rawChar)) {
          conformedValue += rawChar;
          continue placeholderLoop;
        }
      }
      break;
    }

    if (!isAddition) {
      let lastFilledSlot = -1;
      for (let i = 0; i < conformedValue.length; i++) {
        if (placeholder[i] === PLACEHOLDER) {
          lastFilledSlot = i;
        }
      }
      conformedValue = conformedValue.slice(0, lastFilledSlot + 1);
    }

    return conformedValue;
  }

  /**
   * Finds where the caret should land after a conform() pass: past the newly-accepted character
   * on insertion (skipping over any literal that immediately follows it), or at the boundary a
   * deletion leaves behind — tracking the actual typed character through the diff so a rejected
   * one (which never made it into "conformedValue") doesn't throw the position off.
   */
  static adjustCaretPosition({ previousValue = '', previousPlaceholder = '', caretPosition = 0, conformedValue, rawValue, placeholder }) {
    const { PLACEHOLDER } = TextMask;

    if (caretPosition === 0 || !rawValue.length) {
      return 0;
    }

    const editLength = rawValue.length - previousValue.length;
    const isAddition = editLength > 0;
    const isFirstRawValue = previousValue.length === 0;
    const isPartialMultiCharEdit = editLength > 1 && !isAddition && !isFirstRawValue;
    if (isPartialMultiCharEdit) {
      return caretPosition;
    }

    const possiblyHasRejectedChar = isAddition && previousValue === conformedValue;
    let startingSearchIndex = 0;
    let trackRightCharacter;
    let targetChar;

    if (possiblyHasRejectedChar) {
      startingSearchIndex = caretPosition - editLength;
    } else {
      const normalizedConformedValue = conformedValue.toLowerCase();
      const normalizedRawValue = rawValue.toLowerCase();
      const leftHalfChars = normalizedRawValue.slice(0, caretPosition).split('');
      const intersection = leftHalfChars.filter((char) => normalizedConformedValue.includes(char));
      targetChar = intersection[intersection.length - 1];

      const previousLeftMaskChars = previousPlaceholder.slice(0, intersection.length).split('').filter((char) => char !== PLACEHOLDER).length;
      const leftMaskChars = placeholder.slice(0, intersection.length).split('').filter((char) => char !== PLACEHOLDER).length;
      const maskLengthChanged = leftMaskChars !== previousLeftMaskChars;
      const targetIsMaskMovingLeft = previousPlaceholder[intersection.length - 1] !== undefined
        && placeholder[intersection.length - 2] !== undefined
        && previousPlaceholder[intersection.length - 1] !== PLACEHOLDER
        && previousPlaceholder[intersection.length - 1] !== placeholder[intersection.length - 1]
        && previousPlaceholder[intersection.length - 1] === placeholder[intersection.length - 2];

      if (!isAddition && (maskLengthChanged || targetIsMaskMovingLeft) && previousLeftMaskChars > 0 && placeholder.includes(targetChar) && rawValue[caretPosition] !== undefined) {
        trackRightCharacter = true;
        targetChar = rawValue[caretPosition];
      }

      const countTargetCharInIntersection = intersection.filter((char) => char === targetChar).length;
      const countTargetCharInPlaceholder = placeholder.slice(0, placeholder.indexOf(PLACEHOLDER)).split('').filter((char, index) => (
        // Same character as "targetChar", but only where "rawValue" doesn't already carry it at this
        // index too — otherwise it's already counted in "countTargetCharInIntersection".
        char === targetChar && rawValue[index] !== char
      )).length;
      const requiredNumberOfMatches = countTargetCharInPlaceholder + countTargetCharInIntersection + (trackRightCharacter ? 1 : 0);

      let numberOfEncounteredMatches = 0;
      for (let i = 0; i < conformedValue.length; i++) {
        startingSearchIndex = i + 1;
        if (normalizedConformedValue[i] === targetChar) {
          numberOfEncounteredMatches++;
        }
        if (numberOfEncounteredMatches >= requiredNumberOfMatches) {
          break;
        }
      }
    }

    if (isAddition) {
      let lastPlaceholderChar = startingSearchIndex;
      for (let i = startingSearchIndex; i <= placeholder.length; i++) {
        if (placeholder[i] === PLACEHOLDER) {
          lastPlaceholderChar = i;
        }
        // Adding: the caret can sit at the next open slot, or at the placeholder's own end.
        if (placeholder[i] === PLACEHOLDER || i === placeholder.length) {
          return lastPlaceholderChar;
        }
      }
    } else if (trackRightCharacter) {
      for (let i = startingSearchIndex - 1; i >= 0; i--) {
        // "targetChar" should be in "conformedValue", since it was in "rawValue", just right of the caret.
        if (conformedValue[i] === targetChar || i === 0) {
          return i;
        }
      }
    } else {
      for (let i = startingSearchIndex; i >= 0; i--) {
        // Deleting: the caret can sit right before an open slot, or at the very start.
        if (placeholder[i - 1] === PLACEHOLDER || i === 0) {
          return i;
        }
      }
    }
  }

  static setCaretPosition(el, position) {
    if (document.activeElement !== el) {
      return;
    }

    const setSelection = () => el.setSelectionRange(position, position, 'none');

    // Android needs the selection change deferred a frame, or it's silently dropped mid-composition.
    TextMask.IS_ANDROID ? requestAnimationFrame(setSelection) : setSelection();
  }
}

document.addEventListener('youla:init', ()=> {

  // Strips characters a domain/subdomain can never contain, then fixes up label boundaries a plain
  // character filter can't express: no leading dot/hyphen, no label starting/ending in a hyphen
  // (dot-adjacent hyphens), and no empty label from a doubled-up dot.
  function sanitizeDomain(value) {
    return value
      .replace(/[^a-zA-Z0-9.-]/g, '')
      .replace(/^[.-]+/, '')
      .replace(/\.[.-]+/g, '.')
      .replace(/-+\./g, '.')
      .replace(/\.{2,}/g, '.');
  }

  // Applied when no pattern/regexp is given — restricts typing to characters valid for the field's own `type`.
  const TYPE_FILTERS = {
    tel: /[^ \-()+\d]/g,
    number: /[^.-\d]/g,
    color: /[^ a-zA-Z(),\d]/g,
    url: sanitizeDomain,
  };

  /**
   * Turns a mask pattern string into TextMask's array-of-(char|RegExp) tokens, given the field's
   * current raw value (self-limiting slots read the digit already typed before them, so this must
   * be re-run on every keystroke — see the resolver-function form of TextMask's "mask" param).
   * Each character is its own token: `H`/`i`/`D`/`M` are digit slots that self-limit (the first
   * digit narrows what the second accepts, e.g. an "H" of "2" only allows "0-3" next), `Y`/`0` are
   * plain digits, `{regexp}` embeds a custom character class, anything else is a literal.
   *
   * @see discussion //javascript.ru/forum/dom-window/82008-kak-preobrazovat-stroku-v-massiv.html
   */
  function buildMaskTokens(pattern, rawValue) {
    function limit(position, symbol, max) {
      let pos = position;

      max = max.toString();
      if (pattern.charAt(--pos) === symbol) {
        if (rawValue.charAt(pos) === max.charAt(0)) {
          return new RegExp('[0-' + max.charAt(1) + ']');
        }
        return /\d/;
      }
      return new RegExp('[0-' + max.charAt(0) + ']');
    }

    let position = -1;
    return pattern.match(/(\{[^}]+?\})|(.)/g).map((symbol) => {
      ++position;
      switch (symbol) {
        case 'i':
          return limit(position, symbol, 59);
        case 'H':
          return limit(position, symbol, 23);
        case 'D':
          return limit(position, symbol, 31);
        case 'M':
          return limit(position, symbol, 12);
        case 'Y': case '0':
          return /\d/;
        default:
          if (/\{[^}]+?\}/.test(symbol)) {
            return new RegExp(symbol.slice(1, -1));
          }
          return symbol;
      }
    });
  }

  /**
   * Restricts an `<input>`'s value:
   * - no expression (or an empty/falsy one): filters by the input's own `type` (tel/number/color).
   * - a RegExp: strips characters matching it, as they're typed.
   * - a non-empty string: a full text-mask pattern, applied via the vendored TextMask class
   *   above (see buildMaskTokens for its syntax).
   *
   * @since 1.0
   */
  Youla.directive('mask', (el, output) => {
    if (!(el instanceof HTMLInputElement)) {
      console.warn('Youla.js: "u-mask" requires an <input>.');
      return;
    }

    const mode = output instanceof RegExp ? 'regexp'
      : (typeof output === 'string' && output) ? 'pattern'
      : 'auto';

    // Same mode+value as last run (e.g. an unrelated reactive refresh) — leave the existing listener/mask alone.
    if (el._x_mask && el._x_mask.mode === mode && el._x_mask.output === output) {
      return;
    }

    el._x_mask?.destroy();

    if (mode === 'pattern') {
      const textMask = new TextMask(el, (rawValue) => buildMaskTokens(output, rawValue));
      el._x_mask = { mode, output, destroy: () => textMask.destroy() };
      return;
    }

    const filter = mode === 'regexp' ? output : TYPE_FILTERS[el.getAttribute('type')];
    if (!filter) {
      el._x_mask = { mode, output, destroy() {} };
      return;
    }

    const sanitize = typeof filter === 'function' ? filter : (value) => value.replace(filter, '');

    const onInput = () => {
      const filtered = sanitize(el.value);
      if (filtered !== el.value) {
        el.value = filtered;
      }
    };

    el.addEventListener('input', onInput);
    el._x_mask = { mode, output, destroy: () => el.removeEventListener('input', onInput) };
  });
});
