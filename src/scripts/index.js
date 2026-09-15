import Component from './component';
import { domReady, hasDirective } from './dom';
import { debounce, pulsate } from './timing';
import { forceRefresh, reactive } from './reactivity';
import { createEvent } from './events';
import { directive } from './directives';
import { method } from './methods';
import { data } from './data';
import { variable } from './variables';

export const Youla = {
  data,
  debounce,
  directive,
  forceRefresh,
  method,
  pulsate,
  reactive,
  variable,

  /**
   * Boots Youla.js: waits for the DOM to be ready, then fires the `youla:init` event (the hook
   * user code uses to register directives/methods/data-providers) before discovering and
   * initializing every `u-data` element on the page and watching for components added later.
   *
   * Firing the event only once the DOM is ready — rather than immediately — means every plain
   * `<script>` on the page has already run by then, so it doesn't matter whether a script
   * registering a `youla:init` listener is included before or after this one.
   *
   * @returns {Promise<void>}
   */
  start: async function () {
    await domReady();

    document.dispatchEvent(createEvent('youla:init'));

    this.componentDiscover(el => this.componentInitialize(el));

    this.componentWatch(el => this.componentInitialize(el));
  },

  /**
   * Finds every element already in the document carrying `u-data` (in any
   * modified form, e.g. `u-data.local`) and invokes `callback` for each.
   *
   * @param {Function} callback - Called once per discovered element.
   * @returns {void}
   */
  componentDiscover: callback => {
    Array.from(document.querySelectorAll('*')).filter(el => hasDirective(el, 'u-data')).forEach(callback)
  },

  /**
   * Watches `document.body` for elements added after the initial page load and invokes `callback`
   * for any new element carrying `u-data`, including a `u-data` nested inside an added subtree
   * (e.g. `u-each`'s clones), not just the subtree's own root.
   *
   * @param {Function} callback - Called once per newly-added `u-data` element, in document order.
   * @returns {void}
   */
  componentWatch: callback => {
    let observer = new MutationObserver(mutations =>
      mutations.forEach(mutation =>
        Array.from(mutation.addedNodes)
          .filter(node => node.nodeType === 1)
          .forEach(node => {
            const descendants = Array.from(node.querySelectorAll('*')).filter(el => hasDirective(el, 'u-data'));
            const found       = hasDirective(node, 'u-data') ? [node, ...descendants] : descendants;

            // "!el.__x" guards against acting twice on an element reported in more than one mutation.
            found.filter(el => !el.__x).forEach(callback);
          })
      )
    );

    // "attributes" is deliberately omitted: the callback only looks at "mutation.addedNodes", so watching attribute mutations too would generate a MutationRecord for every reactive attribute write on the page for no benefit.
    observer.observe(
      document.querySelector('body'),
      {
        childList: true,
        subtree: true,
      }
    )
  },

  /**
   * Creates a `Component` instance for `el` and stashes it on `el.__x`.
   *
   * @param {HTMLElement} el - The root element carrying `u-data`.
   * @returns {void}
   */
  componentInitialize: el => {
    el.__x = new Component(el)
  }
}
