import { directive } from '../../../scripts/directives';
import dragula from 'dragula';

let dragElementKey = null;
directive('sort', (el, expression, attribute, x, component) => {
  const drake = dragula([el]);

  drake.on('drag', (el, source) => {
    let index = [...source.children].filter(item => item.offsetParent !== null).indexOf(el);
    if (index) {
      [dragElementKey] = Object.entries(expression)[index];
    }
  });

  let newObj = Object.defineProperties({}, Object.getOwnPropertyDescriptors(expression));
  drake.on('drop', (element, target, source, afterElement) => {
    if (dragElementKey) {
      console.log('Элемент перемещён:', element);
      console.log('Источник:', source);
      console.log('Цель:', target);
      console.log('Сестринские:', afterElement);
      console.log(dragElementKey)
      if (afterElement) {
        let index = [...source.children].filter(item => item.offsetParent !== null).indexOf(el);
      } else {
        // Извлекаем значение по ключу
        const valueToMove = newObj[dragElementKey];

        // Удаляем элемент
        delete newObj[dragElementKey];

        // Добавляем его в конец
        newObj[dragElementKey] = valueToMove;

        console.log(newObj)
        component.data[attribute.expression] = newObj;

        console.log(component.data[attribute.expression])
      }
    }
  });
});


export class Dragon {
  constructor(querySelector) {
    this.dragElement = null;

    // Use forEach directly on the NodeList without spreading into an array
    document.querySelectorAll(querySelector).forEach(element => {
      element.setAttribute('draggable', 'true');
      this.addHandlers(element); // Removed 'this' as it's already captured in closure
    });

    return this;
  }

  handleDragStart(e) {
    const instance = e.target;
    this.dragElement = instance;
    this.dragElementBounds = instance.getBoundingClientRect();

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', instance.outerHTML);

    instance.classList.add('sb-dragging-start');
  }

  handleDragOver(e) {
    e.preventDefault(); // Allow drop
    e.target.classList.add('sb-dragging-over');
    e.dataTransfer.dropEffect = 'move';
  }

  handleDragLeave(e) {
    e.target.classList.remove('sb-dragging-over');
  }

  handleDrop(e) {
    e.stopPropagation();

    if (!this.dragElement || this.dragElement === e.target) return; // Avoid moving the same element

    const target = e.target;
    target.parentNode.removeChild(this.dragElement);

    // Determine the correct position for dropping
    const targetBounds = target.getBoundingClientRect();
    if (this.dragElementBounds.top > targetBounds.top) {
      target.insertAdjacentElement('beforebegin', this.dragElement);
    } else {
      target.insertAdjacentElement('afterend', this.dragElement);
    }

    this.addHandlers(target.previousSibling); // Add handlers to the moved element
    target.classList.remove('sb-dragging-start', 'sb-dragging-over');
  }

  handleDragEnd(e) {
    e.target.classList.remove('sb-dragging-start', 'sb-dragging-over');
  }

  addHandlers(element) {
    if (element) {
      for (let [event, callback] of Object.entries({
        'dragstart': function(event) {this.handleDragStart(event, this)},
        'dragover': function(event) {instance.handleDragOver(event, this)},
        'dragleave': function(event) {instance.handleDragLeave(event, this)},
        'drop': function(event) {instance.handleDrop(event, this)},
        'dragend': function(event) {instance.handleDragEnd(event, this)},
      })) {
        element.addEventListener(event, callback, false);
      }
    }
  }
}
