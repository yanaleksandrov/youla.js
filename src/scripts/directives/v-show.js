import { directive } from '../directives';

directive('show', (el, expression, attribute, x, component) => {
  el.style.display = expression ? 'block' : 'none'
});
