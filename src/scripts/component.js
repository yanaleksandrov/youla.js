import { debounce, getAttributes, saferEval, updateAttribute, eventCreate, getNextModifier } from './utils';
import { fetchProps, generateExpressionForProp } from './props';
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
    //console.log(dataProviderContext)

    this.root    = el;
    this.rawData = saferEval(el.getAttribute('x-data') || '{}', dataProviderContext);
    this.rawData = fetchProps(el, this.rawData);
    this.data    = this.wrapDataInObservable(this.rawData);

    this.initialize(el, this.data)
  }

  store(name, value) {
    return store(name, value);
  }

  evaluate(expression, additionalHelperVariables) {
    let affectedDataKeys = []

    const proxiedData = new Proxy(this.data, {
      get(object, prop) {
        affectedDataKeys.push(prop)

        return object[prop]
      }
    })

    const result = saferEval(expression, proxiedData, additionalHelperVariables)

    return {
      output: result,
      deps: affectedDataKeys
    }
  }

  wrapDataInObservable(data) {
    let self = this

    self.concernedData = []
    return new Proxy(data, {
      set(obj, property, value) {
        const setWasSuccessful = Reflect.set(obj, property, value)

        if (self.concernedData.indexOf(property) === -1) {
          self.concernedData.push(property)
        }

        self.refresh()

        return setWasSuccessful
      }
    })
  }

  initialize(root, data, additionalHelperVariables) {
    const self = this;

    domWalk(root, el => getAttributes(el).forEach(attribute => {
      let {directive, event, expression, modifiers, prop} = attribute;

      // init events
      if (event) {
        self.registerListener(el, event, modifiers, expression);
      }

      // init props
      if (prop) {
        // If the element we are binding to is a select, a radio, or checkbox
        // we'll listen for the change event instead of the "input" event.
        let event = ['select-multiple', 'select', 'checkbox', 'radio'].includes(el.type) || modifiers.includes('lazy') ? 'change' : 'input';

        self.registerListener(
          el,
          event,
          modifiers,
          generateExpressionForProp(el, data, prop, modifiers)
        );

        let { output } = self.evaluate(prop, additionalHelperVariables)
        updateAttribute(el, 'value', output)
      }

      // init directives
      if (directive in x.directives) {
        let output = expression;
        if (directive !== 'x-each') {
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
    debounce(() => {
      domWalk(self.root, el => getAttributes(el).forEach(attribute => {
        let {directive, expression, prop} = attribute;

        if (prop) {
          let { output, deps } = self.evaluate(prop)
          if (self.concernedData.filter(i => deps.includes(i)).length > 0) {
            updateAttribute(el, 'value', output);

            document.dispatchEvent(
              eventCreate('x:refreshed', {attribute, output})
            );
          }
        }

        if (directive in x.directives) {
          let output = expression,
            deps   = [];
          if (directive !== 'x-each') {
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

      self.concernedData = []
    }, 0)()
  }

  registerListener(el, event, modifiers, expression) {
    const observers = {};

    // Helper for remove exist observer from element
    const removeIntersectionObserver = element => (observers[element]?.unobserve(element), delete observers[element]);

    // Helper allows to add functionality to the listener's handler more flexibly in a "middleware" style.
    const wrapHandler = (callback, wrapper) => e => wrapper(callback, e);

    let target  = el;
    let options = {};
    let handler = e => this.runListenerHandler(expression, e);

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
        if (el.contains(e.target)) return;

        // Don't do anything if this element isn't currently visible.
        if (el.offsetWidth < 1 && el.offsetHeight < 1) return;

        if (e.target.isConnected === false) return;

        next(e);
      })
    }

    // one time run event
    if (modifiers.includes('once')) {
      options.once = true;

      handler = wrapHandler(handler, (next, e) => {
        next(e);

        if (e instanceof IntersectionObserverEntry) {
          removeIntersectionObserver(e.target);
        }
      })
    }

    if (event === 'load') {
      handler(eventCreate(event,{}));
    }

    if (event === 'intersect') {
      const observer = new IntersectionObserver(entries => entries.forEach(entry => entry.isIntersecting && handler(entry)));
      if (!observers[el]) {
        observers[el] = observer;
      }
      observer.observe(el);
    }

    target.addEventListener(event, handler, options);
  }

  runListenerHandler(expression, e) {
    const methods = {};
    Object.keys(x.methods).forEach(key => {
      methods[key] = x.methods[key](e, e.target, this);
    });

    let data = {}, el = e.target;
    while (el && !(data = el.__x_for_data)) {
      el = el.parentElement;
    }

    saferEval(expression, this.data, {
      ...{
        '$el': e.target,
        '$event': e,
        '$refs': this.getRefsProxy(),
        '$root': this.root,
      },
      ...methods,
      ...data
    }, true)
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
        domWalk(self.root, el => (el.getAttribute('x-ref') === property ? (ref = el) : null));
        // domWalk(self.root, el => {
        //   if (el.hasAttribute('x-ref') && el.getAttribute('x-ref') === property) {
        //     ref = el
        //   }
        // })

        return ref
      }
    })
  }
}
