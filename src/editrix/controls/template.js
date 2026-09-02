/**
 * Clones a <template>'s content by id — every child, for a multi-root or general-shape template.
 */
export function cloneTemplateFragment(id) {
  const template = document.getElementById(id);

  if (!template) {
    throw new Error(`Youla.js: no <template id="${id}"> found — is its control/index.html required from view/editrix.html?`);
  }
  return template.content.cloneNode(true);
}

/**
 * Clones a single-root <template>'s content by id — just that one root element, not a fragment.
 */
export function cloneTemplateElement(id) {
  const template = document.getElementById(id);

  if (!template) {
    throw new Error(`Youla.js: no <template id="${id}"> found — is its control/index.html required from view/editrix.html?`);
  }
  return template.content.firstElementChild.cloneNode(true);
}
