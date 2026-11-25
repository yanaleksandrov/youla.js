import Component from './component';
import { closestDirective, domReady, hasDirective } from './dom';
import { debounce, pulsate } from './timing';
import { forceRefresh, reactive } from './reactivity';
import { createEvent } from './events';
import { directive } from './directives';
import { method } from './methods';
import { data } from './data';
import { resolve, variable } from './variables';
import { storage } from './storage';

export const Youla = {
  data,
  debounce,
  directive,
  forceRefresh,
  method,
  pulsate,
  reactive,
  resolve,
  storage,
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
   * Returns the component an element belongs to: the nearest `u-data` at or above it.
   *
   * @param {Element} el - Any element.
   * @returns {Component|null}
   */
  component: el => (el && closestDirective(el, 'u-data')?.__x) || null,

  /**
   * Watches `document.body` for added markup: calls `callback` for every new `u-data` element, and
   * initializes other added elements as part of the component they were inserted into.
   *
   * @param {Function} callback - Called once per newly-added `u-data` element, in document order.
   * @returns {void}
   */
  componentWatch(callback) {
    const observer = new MutationObserver(mutations => {
      const added = [];

      mutations.forEach(mutation => mutation.addedNodes.forEach(node => node.nodeType === 1 && added.push(node)));

      // New components go first, so markup inside them is already initialized by its own component below.
      added.forEach(node => {
        const descendants = Array.from(node.querySelectorAll('*')).filter(el => hasDirective(el, 'u-data'));
        const found       = hasDirective(node, 'u-data') ? [node, ...descendants] : descendants;

        // "!el.__x" guards against acting twice on an element reported in more than one mutation.
        found.filter(el => !el.__x).forEach(callback);
      });

      added.forEach(node => {
        // Initialized nodes cover markup Youla inserted itself during a render, and nested nodes already reached through their added ancestor.
        if (node.__x_initialized || node.__x_each_clone || !node.isConnected || hasDirective(node, 'u-data')) {
          return;
        }

        // A "u-each" template's content is rendered per clone, never in place.
        if (node.parentElement?.closest('[u-each], template')) {
          return;
        }

        this.component(node.parentElement)?.initialize(node);
      });
    });

    // "attributes" is deliberately omitted: only added nodes matter, and watching attributes would report every reactive attribute write.
    observer.observe(document.body, { childList: true, subtree: true });
  },

  /**
   * Creates a `Component` instance for `el` (stashed on `el.__x`); an error is logged
   * instead of thrown, so one broken component doesn't stop the rest from initializing.
   *
   * @param {HTMLElement} el - The root element carrying `u-data`.
   * @returns {void}
   */
  componentInitialize: el => {
    try {
      new Component(el);
    } catch (error) {
      delete el.__x;
      console.error('Youla.js: failed to initialize component', el, error);
    }
  }
}
