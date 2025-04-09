import { directive } from '../directives';

directive('html', (el, output, attribute, component) => {
  el.innerHTML = output;
});
