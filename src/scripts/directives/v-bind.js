import { directive } from '../directives';
import { updateAttribute } from '../helpers';

directive('bind', (el, output, attribute, component) => {
  const { name, modifiers } = attribute;

  if (name === 'v-bind') {
    Object.entries(output).forEach(([key, value]) => {
      if (key.startsWith('@')) {

        component.registerListener(el, key.replace('@', ''), modifiers, value);
      }
    });
  } else {
    updateAttribute(el, name.replace(':', ''), output);
  }
});
