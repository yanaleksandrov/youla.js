import { method } from '../methods';
import { createEvent } from '../events';

/**
 * Registers `$dispatch(name, detail)`, callable from any expression. Dispatches a bubbling
 * `CustomEvent` from the bound element, so other components further up the DOM can react to it
 * with `@cart:updated="..."` without direct coupling.
 *
 * @param {Event} e - The triggering event (unused directly; part of every method's call signature).
 * @param {HTMLElement} el - The element the event is dispatched from.
 * @returns {Function} `(name: string, detail?: Object) => void`
 */
method('dispatch', (e, el) => (name, detail = {}) => {
  el.dispatchEvent(createEvent(name, detail));
});
