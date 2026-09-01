/**
 * Runs "mutate" (a synchronous DOM reorder — e.g. insertBefore) and smoothly animates every
 * affected child from its old screen position to its new one, via the FLIP technique: record
 * every child's rect, mutate, then for whichever ones actually moved, jump them back to their old
 * spot with a transform (no transition) and release it on the next frame so the browser's own
 * "transition" (declared once, in CSS, on whatever item class this is) animates it home. A CSS
 * Grid/Flexbox reflow isn't transitionable on its own — an item just snaps to its new cell the
 * instant the DOM changes — this is what actually makes that snap read as a smooth slide.
 *
 * Generic on purpose: works for any reorderable list of siblings — youla-editrix.js's own
 * sortable() (gallery thumbnails, toolbox.html) and controls/repeater.js's own repeaterItemRoot()
 * both call this rather than reordering the DOM directly.
 *
 * @param {HTMLElement} container - The parent whose children are being reordered.
 * @param {Function} mutate - Performs the actual DOM reorder synchronously.
 */
export function animateReorder(container, mutate) {
  const children = [...container.children];
  const firstRects = new Map(children.map((el) => [el, el.getBoundingClientRect()]));

  mutate();

  children.forEach((el) => {
    const first = firstRects.get(el);
    const last = el.getBoundingClientRect();
    const dx = first.left - last.left;
    const dy = first.top - last.top;

    if (!dx && !dy) {
      return;
    }

    el.style.transition = 'none';
    el.style.transform = `translate(${dx}px, ${dy}px)`;

    requestAnimationFrame(() => {
      el.style.transition = '';
      el.style.transform = '';
    });
  });
}
