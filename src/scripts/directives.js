import { register } from './registry';

let directives = {}

/**
 * Registers a directive under `u-${name}` (e.g. `directive('text', ...)` registers `u-text`), so
 * Component dispatches `callback` whenever an element carries that attribute — once at mount
 * (Component#initialize()), and again on every later refresh() whose tracked dependencies
 * changed, or unconditionally on a forced refresh.
 *
 * A directive that does one-time DOM/widget setup (attach a listener, construct a third-party
 * widget) MUST guard against running that setup twice — check a flag on the element (e.g.
 * `if (el._x_yourName) return; el._x_yourName = true;`, or store the constructed instance itself
 * there so a later call can update it instead of re-creating it). Skipping this guard is a real,
 * production-hit bug class here: a directive that re-attaches a listener or re-constructs a
 * widget on every refresh leaks a duplicate one every single time, and it's silent — nothing
 * throws, nothing looks wrong until memory/DOM nodes/listeners have piled up. See u-mask,
 * u-ranger, u-filler, u-pickadate, u-tooltip, u-select for the pattern.
 *
 * @param {string} name - The directive's name, without the `u-` prefix.
 * @param {Function} callback - Implementation, called as `(el, output, attribute, component)`.
 * @returns {void}
 */
export function directive(name, callback) {
  register('directive', directives, `u-${name}`, callback);
}

/**
 * Looks up a registered directive's implementation by its full name (e.g. "u-text"), so
 * callers never need to reach into the directive registry directly.
 *
 * @param {string} name - The directive's full name, including the `u-` prefix.
 * @returns {Function|undefined} The directive's implementation, or undefined if none is registered.
 */
export function getDirective(name) {
  return directives[name];
}
