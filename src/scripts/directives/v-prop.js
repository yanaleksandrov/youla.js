import { directive } from '../directives';
import { updateAttribute, getNextModifier } from '../helpers';
import { storage, isStorageModifier, getStorageType, computeExpires } from '../storage';

directive('prop', (el, output, attribute, component) => {
  updateAttribute(el, 'value', output);

  // update storage if value changed
  if (isStorageModifier(attribute.modifiers)) {
    const type   = getStorageType(attribute.modifiers);
    const expire = getNextModifier(attribute.modifiers, type);

    if (output) {
      storage.set(attribute.expression, output, type,{expires: computeExpires(expire), path: '/', secure: true});
    } else {
      storage.set(attribute.expression, null, type, {expires: new Date(), path: '/'})
    }
  }
});
