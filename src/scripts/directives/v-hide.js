import { directive } from '../directives';

directive('hide', (el, output, attribute, component) => {
  el.style.display = output ? 'block' : 'none'
});
