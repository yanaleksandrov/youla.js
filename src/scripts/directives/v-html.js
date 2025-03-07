import { directive } from '../directives';

directive('html', (el, expression, attribute, x, component) => {
  el.innerHTML = expression;
});
