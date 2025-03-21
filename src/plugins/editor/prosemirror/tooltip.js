import { Plugin } from "prosemirror-state";
import { setBlockType, toggleMark, wrapIn } from "prosemirror-commands";
import { schema } from "prosemirror-schema-basic";
import { redo, undo } from "prosemirror-history";
import { inlineTools, blockTools, titleTools } from "./tools";

class SelectionSizeTooltip {
  constructor(view) {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip';
    view.dom.parentNode.appendChild(this.tooltip);

    this.update(view, null);

    // Функция для выполнения команд
    const executeCommand = (command) => {
      const { state, dispatch } = view;
      if (command(state, dispatch)) {
        view.focus();
      }
    };

    this.tooltip.addEventListener('click', event => {
      let btn = event.target.closest('[data-btn]');
      if (btn) {
        handleButtonClick(btn.getAttribute('data-btn'), executeCommand);
      }
    });

    let tooltipHTML = '';

    Object.keys(titleTools).forEach(toolKey => {
      const tool = titleTools[toolKey];

      if (typeof tool === 'object' && !tool.icon) {
        const groupHTML = Object.keys(tool).map(subToolKey => {
          return `<button class="tooltip-btn" data-btn="${subToolKey}" title="${tool[subToolKey].title}"><i class="${tool[subToolKey].icon}"></i></button>`;
        }).join('');

        tooltipHTML += `<div class="tooltip-group">${groupHTML}</div>`;
      } else {
        tooltipHTML += `<div class="tooltip-group"><button class="tooltip-btn" data-btn="${toolKey}" title="${tool.title}"><i class="${tool.icon}"></i></button></div>`;
      }
    });

    this.tooltip.insertAdjacentHTML("beforeend", tooltipHTML);
  }

  update(view, lastState) {
    let state = view.state
    // Don't do anything if the document/selection didn't change
    if (lastState && lastState.doc.eq(state.doc) && lastState.selection.eq(state.selection)) {
      return;
    }

    // Hide the tooltip if the selection is empty
    if (state.selection.empty) {
      this.tooltip.style.display = "none"
      return
    }

    // Otherwise, reposition it and update its content
    this.tooltip.style.display = ""
    let {from, to} = state.selection
    // These are in screen coordinates
    let start = view.coordsAtPos(from), end = view.coordsAtPos(to)
    // The box in which the tooltip is positioned, to use as base
    let box = this.tooltip.offsetParent.getBoundingClientRect()
    // Find a center-ish x position from the selection endpoints (when
    // crossing lines, end may be more to the left)
    let left = Math.max((start.left + end.left) / 2, start.left + 3)
    this.tooltip.style.left = (left - box.left) + "px"
    this.tooltip.style.bottom = (box.bottom - start.top) + "px"
  }
  destroy() {
    this.tooltip.remove()
  }
}

export function tooltip() {
  return new Plugin({
    view(editorView) {
      return new SelectionSizeTooltip(editorView);
    }
  });
}

const handleButtonClick = (btn, executeCommand) => {
  console.log()
  switch (btn) {
    case "bold":
      executeCommand(toggleMark(schema.marks.strong));
      break;
    case "italic":
      executeCommand(toggleMark(schema.marks.em));
      break;
    case "underline":
      executeCommand(toggleMark(schema.marks.underline));
      break;
    case "strike-through":
      executeCommand(toggleMark(schema.marks.strike_through));
      break;
    case "heading":
      executeCommand(setBlockType(schema.nodes.heading, { level: 1 }));
      break;
    case "paragraph":
      executeCommand(setBlockType(schema.nodes.paragraph));
      break;
    case "undo":
      executeCommand(undo);
      break;
    case "redo":
      executeCommand(redo);
      break;
    case "code-block":
      executeCommand(setBlockType(schema.nodes.code_block));
      break;
    case "bullet-list":
      executeCommand(wrapIn(schema.nodes.bullet_list));
      break;
    case "ordered-list":
      executeCommand(wrapIn(schema.nodes.ordered_list));
      break;
    case "align-left":
      executeCommand(setBlockType(schema.nodes.paragraph, { align: 'left' }));
      break;
    case "align-center":
      executeCommand(setBlockType(schema.nodes.paragraph, { align: 'center' }));
      break;
    case "align-right":
      executeCommand(setBlockType(schema.nodes.paragraph, { align: 'right' }));
      break;
    default:
      console.log(`Неизвестная команда: ${btn}`);
  }
};