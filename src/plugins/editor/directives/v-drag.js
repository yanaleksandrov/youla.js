import { directive } from '../../../scripts/directives';

let dragElement           = null,
    dragElementStartIndex = null,
    dragElementOverIndex  = null,
    dragElementBounds     = null;

let draggingStartClass  = 'editrix-dragging-start',
    draggingOverClass   = 'editrix-dragging-over',
    draggingTopClass    = 'editrix-dragging-top',
    draggingBottomClass = 'editrix-dragging-bottom';

directive('drag', (el, expression, attribute, x, component) => {
  el.draggable    = true;
  el.__x_block_id = attribute.expression;

  if (typeof component.data.blocks === 'undefined') {
    component.data.blocks = [];
  }

  if (el.__x_block_id === '') {
    component.data.blocks.push(el);
  }

  for (let [event, callback] of Object.entries({
    'dragstart': handleDragStart,
    'dragover': handleDragOver,
    'dragleave': handleDragLeave,
    'drop': handleDrop,
    'dragend': handleDragEnd,
    'mouseenter': handleMouseEnter,
    'mouseleave': handleMouseLeave,
    'click': handleClick,
    'contextmenu': handleContextMenu,
  })) {
    el.addEventListener(event, callback, false);
  }

  /**
   * Drag start
   *
   * @param e
   */
  function handleDragStart(e) {
    let element = el;
    if (el.__x_block_id !== '') {
      element = document.createElement('div');

      element.classList.add('editrix-container');
      element.setAttribute('x-drag', '');

      element.draggable           = true;
      element.innerHTML           = getTpl(el.__x_block_id);
      element.__x_block_id        = '';
      element.__x_parent_block_id = el.__x_block_id;

      element.addEventListener('mouseenter', handleMouseEnter);
      element.addEventListener('mouseleave', handleMouseLeave);
    }

    dragElement           = element;
    dragElementStartIndex = component.data.blocks.indexOf(element);
    dragElementBounds     = element.getBoundingClientRect();

    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/html', element.outerHTML);

    element.classList.add(draggingStartClass);
  }

  /**
   * Drag move
   *
   * @param e
   * @returns {boolean}
   */
  function handleDragOver(e) {
    if (e.preventDefault) {
      e.preventDefault(); // Necessary. Allows us to drop.
    }

    el.classList.add(draggingOverClass);

    dragElementOverIndex = component.data.blocks.indexOf(el);

    e.dataTransfer.dropEffect = 'move'; // See the section on the DataTransfer object.

    if (dragElementStartIndex !== null && dragElementOverIndex !== null) {
      el.classList.toggle(draggingTopClass, dragElementStartIndex > dragElementOverIndex);
      el.classList.toggle(draggingBottomClass, dragElementStartIndex < dragElementOverIndex);
    }

    return false;
  }

  /**
   * Drag leave
   *
   * @param e
   */
  function handleDragLeave(e) {
    el.classList.remove(draggingOverClass, draggingTopClass, draggingBottomClass);
  }

  /**
   * Drag drop
   *
   * @param e
   * @returns {boolean}
   */
  function handleDrop(e) {
    if (e.stopPropagation) {
      e.stopPropagation();
    }

    if (dragElement !== null) {
      if (dragElement !== el) {
        dragElement.parentNode?.removeChild(dragElement);
        const { top } = el.getBoundingClientRect();

        el.insertAdjacentElement(dragElementBounds.top > top ? 'beforebegin' : 'afterend', dragElement);

        if (dragElement.__x_parent_block_id !== '') {
          addBlockAtIndex(
            component.data.blocks,
            dragElementOverIndex,
            dragElement,
            dragElementBounds.top > top
          );
          dragElement.__x_parent_block_id = '';
        }
        console.log(component.data.blocks)
      }

      const classesToRemove = [draggingStartClass, draggingOverClass, draggingTopClass, draggingBottomClass];

      el.classList.remove(...classesToRemove);
      dragElement.classList.remove(...classesToRemove);
    }
    return false;
  }

  /**
   * Drag end
   *
   * @param e
   */
  function handleDragEnd(e) {
    el.classList.remove(draggingStartClass, draggingOverClass);
  }

  /**
   * Mouse over to draggable element
   *
   * @param e
   */
  function handleMouseEnter({target}) {
    if (target.__x_block_id === '') {
      let tools = target.querySelector('.editrix-container-tools');
      if (!tools) {
        target.insertAdjacentHTML('afterbegin', `
        <ul class="editrix-container-tools">
          <li class="editrix-container-tools-item" title="Edit Container">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256">
              <path d="M76 92a16 16 0 1 1-16-16 16 16 0 0 1 16 16Zm52-16a16 16 0 1 0 16 16 16 16 0 0 0-16-16Zm68 32a16 16 0 1 0-16-16 16 16 0 0 0 16 16ZM60 148a16 16 0 1 0 16 16 16 16 0 0 0-16-16Zm68 0a16 16 0 1 0 16 16 16 16 0 0 0-16-16Zm68 0a16 16 0 1 0 16 16 16 16 0 0 0-16-16Z"/>
            </svg>
          </li>
          <li class="editrix-container-tools-item" title="Delete Container">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 256 256">
              <path d="M208 192a12 12 0 0 1-17 17l-63-64-64 63a12 12 0 0 1-17-17l64-63-63-64a12 12 0 0 1 17-17l63 64 64-64a12 12 0 0 1 17 17l-64 64Z"/>
            </svg>
          </li>
        </ul>
        `);
      }
    }
  }

  /**
   * Mouse out from draggable element
   *
   * @param e
   */
  function handleMouseLeave({target}) {
    if (target.__x_block_id === '') {
      let tools = target.querySelector('.editrix-container-tools');
      if (tools) {
        tools.remove();
      }
    }
  }

  function handleClick() {
    if (el.__x_block_id === '') {
      component.data.section = 'content';
    }
  }

  function handleContextMenu(e) {
    e.preventDefault();
    component.data.section = 'blocks';
  }
});

/**
 * Gets the tpl.
 *
 * @param  {string}  element  The element
 * @return {string}  The tpl.
 */
const getTpl = (element) => {
  let tpl = {
    'editrix-text': '<h1>I am text</h1>',
    'editrix-button': '<button type="button">Submit Now!</button>'
  }

  return tpl[element];
}

/**
 * Adds a new element before or after the specified index in an array.
 *
 * @param {Array} array - The source array.
 * @param {number} index - The index before or after which to add the element.
 * @param {*} element - The new element to add to the array.
 * @param {boolean} insertAfter - A flag indicating whether to add the element after the specified index. If false, the element will be added before the index.
 * @returns {void}
 */
const addBlockAtIndex = (array, index, element, insertAfter) => {
  // check if the index is within the array bounds
  if (index >= 0 && index < array.length) {
    // calculate the insert index based on whether to insert after or before the specified index
    array.splice(insertAfter ? index + 1 : index, 0, element);
  } else {
    // if the index is out of bounds, simply add the element to the end
    array.push(element);
  }
}