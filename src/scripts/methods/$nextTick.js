import { method } from '../methods';

/**
 * Registers `$nextTick(callback?)`: waits until the component's pending changes are applied to the DOM.
 *
 * @returns {Function} `(callback?: Function) => Promise<void>`
 */
method('nextTick', (e, el, component) => callback => component.nextTick(callback));
