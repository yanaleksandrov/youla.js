import { directive } from '../directives';
import { updateAttribute } from '../helpers';

directive('bind', (el, output, attribute, component) => {
  const {name} = attribute;

  console.log(el)
  console.log(output)
  console.log(component.data)

  if (name === ':attributes' && typeof output === 'object') {
    Object.entries(output).forEach(([key, value]) => updateAttribute(el, key, value));
  } else {
    updateAttribute(el, name.replace(':', ''), output);
  }
});
