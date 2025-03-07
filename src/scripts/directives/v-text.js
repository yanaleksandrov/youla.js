import { directive } from '../directives';

directive('text', (el, expression, attribute, x, component) => {
  el.innerText = expression;
});
