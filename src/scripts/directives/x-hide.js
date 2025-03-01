import { directive } from '../directives';

directive('hide', (el, expression, attribute, x, component) => {
  el.style.display = 'none';
  el.removeAttribute('x-hide');
});
