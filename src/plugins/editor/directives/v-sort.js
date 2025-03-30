import { directive } from '../../../scripts/directives';

directive('sort', (el, expression, attribute, x, component) => {
  if (!attribute.modifiers.includes('item')) {
    const drake = new Dragon(el, {
      dragEnd: (obj, element, fromIndex, toIndex) => {
        expression = obj.moveElement(expression, fromIndex, toIndex);
        //console.log(obj)
        console.log(expression)

        //component.data.thumbnails = expression;
      },
      remove: (removeIndex, removeNode) => {
        expression.splice(removeIndex, 1);

        console.log(removeNode)
        //component.data.thumbnails = expression;
        //console.log(expression)
      },
    });
  }
});

class Dragon {
  constructor(element, options) {
    if (!element) {
      return;
    }

    this.wrapper = element;
    this.element = null;
    this.options = {
      dragStart: () => {},
      dragOver: () => {},
      dragEnd: () => {},
      remove: () => {},
      startClass: 'gu-start',
      transitClass: 'gu-transit',
      ...options
    };

    /**
     * Add handlers for every item of sort wrapper.
     */
    Array.from(element.children).forEach(item => {
      const eventMap = {
        mousedown: this.handleStart.bind(this),
        mouseup: this.handleEnd.bind(this),
        dragstart: this.handleDragStart.bind(this),
        dragover: this.handleDragOver.bind(this),
        dragend: this.handleDragEnd.bind(this),
      };

      Object.entries(eventMap).forEach(([event, handler]) => {
        item.addEventListener(event, handler, false);
      });
    });

    this.updateIndexes();

    /**
     * Watch removing items.
     *
     * @type {MutationObserver}
     */
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.removedNodes.forEach(removeNode => {
        const removeIndex = parseInt(removeNode.dataset.index, 10);

        this.options.remove(removeIndex, removeNode);

        this.updateIndexes();
      }));
    });

    observer.observe(element, { childList: true, subtree: true });
  }

  handleStart(e) {
    e.currentTarget.classList.add(this.options.startClass);
  }

  handleEnd(e) {
    e.currentTarget.classList.remove(this.options.startClass);
  }

  handleDragStart(e) {
    this.element = e.currentTarget;

    let {element, options} = this;

    if (element) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/html', element.outerHTML);

      element.classList.add(options.transitClass);
      element.setAttribute('draggable', 'true');

      element.dataset.fromIndex = String(Array.prototype.indexOf.call(element.parentNode.children, element));

      options.dragStart(this, element);
    }
  }

  handleDragOver(e) {
    e.preventDefault();

    const target = e.currentTarget;

    let {element, options} = this;

    if (element && target !== element) {
      const fromIndex   = parseInt(element.dataset.fromIndex, 10);
      const siblings   = Array.from(target.parentNode.children);
      const dragIndex   = siblings.indexOf(element);
      const targetIndex = siblings.indexOf(target);

      const direction = dragIndex > targetIndex ? 'beforebegin' : 'afterend';

      // Сбрасываем все трансформации после вставки
      // target.style.transform = direction === 'beforebegin' ? 'translateX(calc(100% + 0.25rem))' : 'translateX(calc(-100% - 0.25rem))';
      // element.style.transform = direction === 'beforebegin' ? 'translateX(calc(-100% - 0.25rem))' : 'translateX(calc(100% + 0.25rem))';
      // setTimeout(() => {
      //   target.style.transform = '';
      //
      //   element.style.transform = '';
      // }, 250);

      target.insertAdjacentElement(direction, element);

      options.dragOver(this, element, fromIndex);
    }
  }

  handleDragEnd() {
    let {element, options} = this;

    const fromIndex = parseInt(element.dataset.fromIndex, 10);
    const toIndex   = Array.prototype.indexOf.call(element.parentNode.children, element);

    options.dragEnd(this, element, fromIndex, toIndex);

    element.classList.remove(options.startClass, options.transitClass);
    element.removeAttribute('draggable');

    this.element = null;

    this.updateIndexes();
  }

  moveElement(arr, fromIndex, toIndex) {
    // return the array unchanged if the indexes are incorrect
    if (fromIndex < 0 || fromIndex >= arr.length || toIndex < 0 || toIndex >= arr.length) {
      return arr;
    }

    const [movedItem] = arr.splice(fromIndex, 1);

    arr.splice(toIndex, 0, movedItem);

    return arr;
  }

  updateIndexes() {
    Array.from(this.wrapper.children).forEach((item, i) => item.dataset.index = String(i));
  }
}