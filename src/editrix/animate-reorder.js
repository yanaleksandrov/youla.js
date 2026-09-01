/**
 * Runs "mutate" (a synchronous DOM reorder) and animates every affected child from its old
 * position to its new one via the FLIP technique — a CSS Grid/Flexbox reflow isn't transitionable
 * on its own, so this makes the snap read as a smooth slide.
 *
 * @param {HTMLElement} container - Parent whose children are being reordered.
 * @param {Function} mutate - Performs the actual DOM reorder synchronously.
 * @param {HTMLElement} [exclude] - Child to skip (e.g. the drag source, which already has its own transform).
 */
export function animateReorder(container, mutate, exclude) {
  const children = [...container.children].filter((el) => el !== exclude);
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
