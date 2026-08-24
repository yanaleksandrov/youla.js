import { directive } from '../directives';
import { getNextModifier } from '../events';
import { updateAttribute } from '../attributes';
import { storage, isStorageModifier, getStorageType, computeExpires } from '../storage';

/**
 * Writes the bound expression's value onto the element as its form value — the write side of
 * v-prop's two-way binding; the read side is handled by Component#attachListener. When `.local`
 * or `.cookie` is present, also persists the value so it survives a page reload.
 *
 * @param {HTMLElement} el
 * @param {*} output - the current value of the bound property.
 * @param {object} attribute - the parsed attribute descriptor (expression is the property path, e.g. "user.name").
 * @param {Component} component - the owning component instance.
 */
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
