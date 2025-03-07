import Component from './component';
import { domReady } from './dom';
import { extend } from './extensions';

export const x = {
  directives: {},
  methods: {},

  start: async function () {
    await domReady()

    this.discoverComponents(el => this.initializeElement(el))
    this.listenUninitializedComponentsAtRunTime(el => this.initializeElement(el))
  },

  extend(...args) {
    extend(args);
  },

  discoverComponents: callback => {
    Array.from(document.querySelectorAll('[v-data]')).forEach(callback)
  },

  listenUninitializedComponentsAtRunTime: callback => {
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

  initializeElement: el => {
    el.__x = new Component(el)
  }
}
