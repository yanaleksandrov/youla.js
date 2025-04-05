import { directive } from '../directives';
import { updateAttribute } from '../helpers';

directive('bind', (el, expression, {name}, x, component) => {
  if (name === ':attributes' && typeof expression === 'object') {
    Object.entries(expression).forEach(([key, value]) => updateAttribute(el, key, value));
  } else {
    updateAttribute(el, name.replace(':', ''), expression);
  }
});
