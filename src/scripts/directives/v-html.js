import { directive } from '../directives';

directive('html', (el, output, attribute, component) => {
  output = output ?? '';

  // Skip elements whose markup didn't actually change, so unrelated refreshes
  // don't tear down and rebuild content that's holding focus, playing media, etc.
  // Cache the raw input rather than comparing against el.innerHTML, since the
  // browser can re-serialize markup differently than it was written.
  if (el._x_html === output) {
    return;
  }

  el._x_html = output;
  el.innerHTML = output;
});
