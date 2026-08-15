import { directive } from '../directives';
import { getNextModifier, isFormField } from '../helpers';
import { updateAttribute } from '../attributes';
import { storage, isStorageModifier, getStorageType, computeExpires } from '../storage';

directive('prop', (el, output, attribute, component) => {
  // On anything other than a form field there's no value to bind — render
  // the output as the element's content instead, as text unless .html is set.
  if (!isFormField(el)) {
    output = output ?? '';

    if (attribute.modifiers.includes('html')) {
      // Cache the raw input rather than comparing against el.innerHTML, since the
      // browser can re-serialize markup differently than it was written.
      if (el._x_html === output) {
        return;
      }

      el._x_html = output;
      el.innerHTML = output;
    } else {
      // textContent is layout-independent (unlike innerText, which forces a
      // reflow and varies across browsers for hidden elements).
      if (el._x_text === output) {
        return;
      }

      el._x_text = output;
      el.textContent = output;
    }

    return;
  }

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
