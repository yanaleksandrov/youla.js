import { directive } from '../../../scripts/directives';

directive('sort', (el, expression, attribute) => {
  if (!attribute.modifiers.includes('item')) {
    const drake = new Dragon(el, {
      dragEnd: (element) => {
        console.log(el)
        console.log(element)
      },
    });
  }
});

class Dragon {
  constructor(element, options) {
    if (!element) {
      return;
    }

    this.element = null;
    this.options = {
      dragStart: (element) => {},
      dragOver: (element) => {},
      dragEnd: (element) => {},
      startClass: 'gu-start',
      transitClass: 'gu-transit',
      ...options
    };

    element.querySelectorAll('[v-sort\\.item]').forEach(item => {
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

      options.dragStart(element);
    }
  }

  handleDragOver(e) {
    e.preventDefault();

    const target = e.currentTarget;

    let {element, options} = this;

    if (element && target !== element) {
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

      options.dragOver(element);
    }
  }

  handleDragEnd() {
    let {element, options} = this;

    options.dragEnd(element);

    element.classList.remove(options.startClass, options.transitClass);
    element.removeAttribute('draggable');
    this.element = null;
  }
}