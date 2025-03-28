import { directive } from '../directives';
import { eventCreate, updateAttribute } from '../utils';

directive('prop', (el, expression, attribute, x, component) => {
  updateAttribute(el, 'value', expression);

  document.dispatchEvent(
    eventCreate('x:refreshed', {attribute, expression})
  );
});