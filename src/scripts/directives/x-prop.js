import { directive } from '../directives';

directive('prop', (el, expression, attribute, x, component) => {
  el.innerText = expression;
});
