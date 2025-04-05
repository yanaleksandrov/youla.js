import Component from './component';
import { debounce, domReady, eventCreate, pulsate } from './helpers';
import { directive } from './directives';
import { method } from './methods';
import { data } from './data';

export const Youla = {
  data,
  debounce,
  directive,
  directives: {},
  method,
  methods: {},
  pulsate,

  start: async function () {
    document.dispatchEvent(eventCreate('youla:init'));

    await domReady();

    this.componentDiscover(el => this.componentInitialize(el));

    this.componentListenUninitializedAtRunTime(el => this.componentInitialize(el));
  },

  componentDiscover: callback => {
    Array.from(document.querySelectorAll('[v-data]')).forEach(callback)
  },

  componentListenUninitializedAtRunTime: callback => {
    let observer = new MutationObserver(mutations =>
      mutations.forEach(mutation =>
        Array.from(mutation.addedNodes)
          .filter(node => node.nodeType === 1 && node.matches('[v-data]'))
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

  componentInitialize: el => {
    el.__x = new Component(el)
  }
}
