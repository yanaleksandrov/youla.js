import { directive } from '../directives';
import { updateAttribute, getNextModifier } from '../helpers';
import { storage, isStorageModifier, getStorageType, computeExpires } from '../storage';

directive('prop', (el, expression, attribute, x, component) => {
  updateAttribute(el, 'value', expression);

  // update storage if value changed
  if (isStorageModifier(attribute.modifiers)) {
    const type   = getStorageType(attribute.modifiers);
    const expire = getNextModifier(attribute.modifiers, type);

    if (expression) {
      storage.set(attribute.expression, expression, type,{expires: computeExpires(expire), path: '/', secure: true});
    } else {
      storage.set(attribute.expression, null, type, {expires: new Date(), path: '/'})
    }
  }
});
