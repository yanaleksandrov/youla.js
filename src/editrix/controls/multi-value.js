/**
 * "Multi-value" controls — a setting whose value is itself an object with a few named parts
 * (Elementor's url/box_shadow controls work the same way). No wrapper factory of their
 * own here: a compound control's wrapper is just `field(name, title, tooltip, { type: 'url', ... })`
 * like any other, and its parts are base.js's part()/partNumber()/partSwitch().
 *
 * Value shapes, for reference:
 *   url: { url: '', is_external: false, nofollow: false }
 */
export function createMultiValueControls() {
  return {};
}
