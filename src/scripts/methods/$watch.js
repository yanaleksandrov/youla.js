import { method } from '../methods';

/**
 * Registers `$watch(path, callback)`, callable from any expression. Calls `callback(value, oldValue)`
 * whenever the component data at `path` changes.
 *
 * @param {Event} e - The triggering event (unused directly; part of every method's call signature).
 * @param {HTMLElement} el - The bound element (unused).
 * @param {Component} component - The component whose data is watched.
 * @returns {Function} `(path: string|Function, callback: Function) => Function`, returning a function that stops watching.
 */
method('watch', (e, el, component) => (path, callback) => component.watch(path, callback));
