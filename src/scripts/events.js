/**
 * Creates a bubbling, cancelable CustomEvent, pre-configured to pass through shadow DOM boundaries.
 *
 * @param {string} eventName - The event's type/name.
 * @param {object} [detail] - Data exposed on the event's "detail" property.
 * @returns {CustomEvent} The created event, ready to dispatch.
 */
export function createEvent(eventName, detail = {}) {
  return new CustomEvent(eventName, {
    detail,
    bubbles: true,
    // Allows events to pass the shadow DOM barrier.
    composed: true,
    cancelable: true,
  })
}

/**
 * Reads the modifier that immediately follows a given one — used for modifiers that take an
 * argument via the next segment (e.g. the "250ms" in ".delay.250ms").
 *
 * @param {string[]} modifiers - The attribute's modifier list.
 * @param {string} modifierAfter - The modifier whose following value should be read.
 * @param {string} [defaultValue] - Returned when "modifierAfter" isn't present, or has nothing after it.
 * @returns {string} The modifier found right after "modifierAfter", or "defaultValue".
 */
export function getNextModifier(modifiers, modifierAfter, defaultValue = '') {
  const index = modifiers.indexOf(modifierAfter);

  // "indexOf" returning -1 must not silently read "modifiers[0]" via "-1 + 1" when "modifierAfter" isn't present at all.
  return index === -1 ? defaultValue : (modifiers[index + 1] || defaultValue);
}

// Key names/combos for filtering "$event.key" via modifiers, e.g. "@keydown.enter" or "@keyup.ctrl.s".
const KEY_ALIASES = {
  enter: 'Enter', esc: 'Escape', escape: 'Escape', tab: 'Tab', space: ' ',
  up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight',
  delete: 'Delete', backspace: 'Backspace',
};

const SYSTEM_MODIFIER_KEYS = { ctrl: 'ctrlKey', alt: 'altKey', shift: 'shiftKey', meta: 'metaKey' };

// Behavior modifiers Component#attachListener handles directly; anything else is treated as a key filter.
const BEHAVIOR_MODIFIERS = new Set(['window', 'document', 'passive', 'capture', 'delay', 'prevent', 'stop', 'outside', 'once', 'lazy', 'form', 'self']);

// Edge checks for "@scroll.top" and the like; "offset(size)" gives the edge zone in px for the scroll area's size on that axis.
// In RTL "scrollLeft" runs from 0 down to -max, so left/right flip their bounds.
export const SCROLL_EDGES = {
  top: (el, offset) => el.scrollTop <= offset(el.clientHeight),
  bottom: (el, offset) => el.scrollTop + el.clientHeight >= el.scrollHeight - offset(el.clientHeight),
  left: (el, offset, rtl) => el.scrollLeft <= (rtl ? el.clientWidth - el.scrollWidth : 0) + offset(el.clientWidth),
  right: (el, offset, rtl) => el.scrollLeft >= (rtl ? 0 : el.scrollWidth - el.clientWidth) - offset(el.clientWidth),
};

export const SCROLL_EDGE_GROUPS = {
  block: ['top', 'bottom'],
  inline: ['left', 'right'],
};

export const SCROLL_OFFSET_MODIFIER = /^(\d+)(px|%)$/;

/**
 * Checks whether a modifier is a key filter (e.g. "enter", "ctrl", "s") rather than one of
 * Component#attachListener's own behavior modifiers (".prevent", ".delay.250ms", ".200px", etc.).
 *
 * @param {string} modifier - A single modifier segment.
 * @returns {boolean} True if the modifier should be treated as a key filter.
 */
export function isKeyModifier(modifier) {
  return !BEHAVIOR_MODIFIERS.has(modifier) && !/^\d+(m?s|px|%)$/.test(modifier);
}

/**
 * Checks a fired event against an attribute's key/system modifiers (e.g. ".enter", ".ctrl.s").
 *
 * @param {KeyboardEvent} e - The event to check.
 * @param {string[]} modifiers - The attribute's full modifier list.
 * @returns {boolean} True if the element has no key filter at all, or "e" matches every one it has.
 */
export function matchesKeyModifiers(e, modifiers) {
  const keyModifiers = modifiers.filter(isKeyModifier);

  return keyModifiers.every(modifier => {
    if (modifier in SYSTEM_MODIFIER_KEYS) {
      return e[SYSTEM_MODIFIER_KEYS[modifier]] === true;
    }

    const expected = KEY_ALIASES[modifier] || modifier;

    if (typeof e.key === 'string' && e.key.toLowerCase() === expected.toLowerCase()) {
      return true;
    }

    // "e.key" reflects the active keyboard layout (e.g. physical "S" reports "ы" on a Cyrillic layout), so a single letter/digit modifier is also checked against "e.code", which names the physical key regardless of layout.
    const expectedCode = /^[a-z]$/i.test(modifier) ? `Key${modifier.toUpperCase()}`
      : /^[0-9]$/.test(modifier) ? `Digit${modifier}`
      : modifier === 'space' ? 'Space'
      : expected;

    return typeof e.code === 'string' && e.code === expectedCode;
  });
}
