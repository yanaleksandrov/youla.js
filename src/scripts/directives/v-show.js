import { directive } from '../directives';

directive('show', (el, output, attribute, component) => {
  el.style.display = output ? 'block' : 'none'
});
