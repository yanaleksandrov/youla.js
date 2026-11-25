import { method } from '../methods';
import { cleanupOnDisconnect } from '../component';

/**
 * Registers `$on(target, event, handler, options)`: adds a listener to any event target that is removed
 * automatically once the component's root leaves the DOM.
 *
 * @returns {Function} `(target, event, handler, options?) => Function`, returning a function that removes the listener.
 */
method('on', (e, el, component) => (target, event, handler, options) => {
  const off = () => target.removeEventListener(event, handler, options);

  target.addEventListener(event, handler, options);
  cleanupOnDisconnect(component.root, off);

  return off;
});
