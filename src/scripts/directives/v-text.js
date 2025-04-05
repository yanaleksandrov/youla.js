import { directive } from '../directives';

directive('text', (el, output, attribute, component) => {
  el.innerText = output;
});
