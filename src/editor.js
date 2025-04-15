import './plugins/editor/directives/v-editor';
import './plugins/editor/directives/v-drag';
import './plugins/editor/directives/v-sort';

import {DragInput} from './plugins/editor/drag-input';

let buttons = document.querySelectorAll('.editrix-inputs-btn');
buttons.forEach(button => new DragInput(button, button.nextElementSibling))