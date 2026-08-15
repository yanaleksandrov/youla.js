import { directive } from '../directives';

directive('text', (el, output, attribute, component) => {
  output = output ?? '';

  // textContent is layout-independent (unlike innerText, which forces a
  // reflow and varies across browsers for hidden elements).
  if (el._x_text === output) {
    return;
  }

  el._x_text = output;
  el.textContent = output;
});
