export function domReady() {
  return new Promise(resolve => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', resolve)
    } else {
      resolve()
    }
  })
}

export function domWalk(el, callback) {
  callback(el);

  let node = el.firstElementChild;

  while (node) {
    if (node.hasAttribute('v-data')) {
      return;
    }

    domWalk(node, callback);

    node = node.nextElementSibling;
  }
}
