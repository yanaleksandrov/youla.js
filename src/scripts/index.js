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
   * Boots Youla.js: fires the `youla:init` event (the hook user code uses to register
   * directives/methods/data-providers), waits for the DOM to be ready, then discovers and
   * initializes every `v-data` element on the page before watching for components added later.
   *
   * @returns {Promise<void>}
   */
  start: async function () {
    document.dispatchEvent(createEvent('youla:init'));

    await domReady();

    this.componentDiscover(el => this.componentInitialize(el));

    this.componentWatch(el => this.componentInitialize(el));
  },

  /**
   * Finds every element already in the document carrying `v-data` (in any
   * modified form, e.g. `v-data.local`) and invokes `callback` for each.
   *
   * @param {Function} callback - Called once per discovered element.
   * @returns {void}
   */
  componentDiscover: callback => {
    Array.from(document.querySelectorAll('*')).filter(el => hasDirective(el, 'v-data')).forEach(callback)
  },

  /**
   * Watches `document.body` for elements added after the initial page load
   * (e.g. markup injected via AJAX) and invokes `callback` for any new
   * element carrying `v-data`, so it gets initialized automatically.
   *
   * @param {Function} callback - Called once per newly-added `v-data` element.
   * @returns {void}
   */
  componentWatch: callback => {
    let observer = new MutationObserver(mutations =>
      mutations.forEach(mutation =>
        Array.from(mutation.addedNodes)
          .filter(node => node.nodeType === 1 && hasDirective(node, 'v-data'))
          .forEach(callback)
      )
    );

    observer.observe(
      document.querySelector('body'),
      {
        childList: true,
        attributes: true,
        subtree: true,
      }
    )
  },

  /**
   * Creates a `Component` instance for `el` and stashes it on `el.__x`.
   *
   * @param {HTMLElement} el - The root element carrying `v-data`.
   * @returns {void}
   */
  componentInitialize: el => {
    el.__x = new Component(el)
  }
}
