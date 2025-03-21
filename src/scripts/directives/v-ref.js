import { directive } from '../directives';

directive('ref', (el, expression, attribute, x, component) => {
  console.log(el)
  console.log(expression)
  console.log(attribute)
  console.log(component)
});
