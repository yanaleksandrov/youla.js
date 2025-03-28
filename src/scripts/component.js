import { debounce, getAttributes, saferEval, updateAttribute, eventCreate, getNextModifier } from './utils';
import { fetchProp, generateExpressionForProp } from './props';
import { store } from './store';
import { domWalk } from './dom';
import { injectDataProviders } from './data';

export default class Component {
  constructor(el) {
    document.dispatchEvent(
      eventCreate('x:init', {x: this})
    );

    let dataProviderContext = {};
    injectDataProviders(dataProviderContext);

    this.root    = el;
    this.rawData = saferEval(el.getAttribute('v-data') || '{}', dataProviderContext);
    this.rawData = fetchProp(el, this.rawData);
    this.data    = this.wrapDataInObservable(this.rawData);

    this.initialize(el, this.data);
  }

  store(name, value) {
    return store(name, value);
  }

  evaluate(expression, additionalHelperVariables) {
    let deps = []

    const proxiedData = new Proxy(this.data, {
      get: (object, prop) => (deps.push(prop), object[prop])
    });

    const output = saferEval(expression, proxiedData, additionalHelperVariables);

    return {output, deps};
  }

  wrapDataInObservable(data) {
    this.concernedData = [];

    return new Proxy(data, {
      set: (obj, prop, value) => {
        if (Reflect.set(obj, prop, value) && !this.concernedData.includes(prop)) {
          this.concernedData.push(prop);
          this.refresh();
        }
        return true;
      }
    });
  }

  initialize(root, data, additionalHelperVariables) {
    const self = this;

    domWalk(root, el => getAttributes(el).forEach(attribute => {
      let {directive, event, expression, modifiers} = attribute;

      // init events
      if (event) {
        self.registerListener(el, event, modifiers, expression);
      }

      // init props
      if (directive === 'v-prop') {
        // If the element we are binding to is a select, a radio, or checkbox we'll listen for the change event instead of the "input" event.
        let event = ['select-multiple', 'select', 'checkbox', 'radio'].includes(el.type) || modifiers.includes('lazy')
          ? 'change'
          : 'input';

        self.registerListener(el, event, modifiers, generateExpressionForProp(el, data, attribute));

        let { output } = self.evaluate(expression, additionalHelperVariables);
        updateAttribute(el, 'value', output);
      }

      // init directives
      if (directive in x.directives) {
        let output = expression;
        if (directive !== 'v-each') {
          try {
            ({ output } = self.evaluate(expression, additionalHelperVariables));
          } catch (error) {}
        }
        x.directives[directive](el, output, attribute, x, self);
      }
    }));
  }

  refresh() {
    const self = this;

    // use debounce for .outside modificator work
    // TODO: check, maybe this problem can solve with other solution
    debounce(() => {
      domWalk(self.root, el => getAttributes(el).forEach(attribute => {
        let {directive, expression} = attribute;

        if (directive in x.directives) {
          let output = expression, deps = [];
          if (directive !== 'v-each') {
            try {
              ({ output, deps } = self.evaluate(expression));
            } catch (error) {}
          } else {
            [, deps] = expression.split(' in ');
          }

          if (self.concernedData.filter(i => deps.includes(i)).length > 0) {
            x.directives[directive](el, output, attribute, x, self);
          }
        }
      }));

      self.concernedData = [];
    }, 0)()
  }

  registerListener(el, event, modifiers, expression) {
    // helper allows to add functionality to the listener's handler more flexibly in a "middleware" style.
    const wrapHandler = (callback, wrapper) => e => wrapper(callback, e);

    let target  = el;
    let options = {};
    let handler = e => this.runListenerHandler(expression, e, el);

    if (modifiers.includes('window')) {
      target = window;
    }

    if (modifiers.includes('document')) {
      target = document;
    }

    if (modifiers.includes('passive')) {
      options.passive = true;
    }

    if (modifiers.includes('capture')) {
      options.capture = true;
    }

    // delay an event for a certain time
    if (modifiers.includes('delay')) {
      handler = debounce(handler, Number(getNextModifier(modifiers, 'delay').split('ms')[0]) || 250);
    }

    if (modifiers.includes('prevent')) {
      handler = wrapHandler(handler, (next, e) => { e.preventDefault(); next(e); });
    }

    // stopping event propagation in DOM.
    if (modifiers.includes('stop')) {
      handler = wrapHandler(handler, (next, e) => { e.stopPropagation(); next(e); });
    }

    // event outside of element
    if (modifiers.includes('outside')) {
      target = document;

      handler = wrapHandler(handler, (next, e) => {
        // Don't do anything if the click came form the element or within it.
        if (el.contains(e.target)) {
          return;
        }

        // Don't do anything if this element isn't currently visible.
        if (el.offsetWidth < 1 && el.offsetHeight < 1) {
          return;
        }

        if (e.target.isConnected === false) {
          return;
        }

        next(e);
      });
    }

    // one time run event
    if (modifiers.includes('once')) {
      options.once = true;
    }

    if (event === 'load') {
      handler(eventCreate(event,{}));
    }

    if (event === 'intersect') {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => {
        if (entry.isIntersecting) {
          handler(entry);

          if (modifiers.includes('once')) {
            observer.disconnect();
          }
        }
      }));
      observer.observe(el);
    }

    target.addEventListener(event, handler, options);
  }

  runListenerHandler(expression, e, target) {
    const methods = {};
    Object.keys(x.methods).forEach(key => {
      methods[key] = x.methods[key](e, target, this);
    });

    let data = {}, el = target;
    while (el && !(data = el.__x_for_data)) {
      el = el.parentElement;
    }

    saferEval(expression, this.data, {
      '$el': target,
      '$event': e,
      '$refs': this.getRefsProxy(),
      '$root': this.root,
      ...methods,
      ...data
    }, true);
  }

  getRefsProxy() {
    let self = this

    // One of the goals of this project is to not hold elements in memory, but rather re-evaluate
    // the DOM when the system needs something from it. This way, the framework is flexible and
    // friendly to outside DOM changes from libraries like Vue.
    // For this reason, I'm using an "on-demand" proxy to fake a "$refs" object.
    return new Proxy({}, {
      get(object, property) {
        let ref

        // We can't just query the DOM because it's hard to filter out refs in nested components.
        domWalk(self.root, el => (el.getAttribute('v-ref') === property ? (ref = el) : null));

        return ref
      }
    })
  }
}
