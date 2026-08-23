import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TooltipInstance, PLACEMENTS, TRIGGERS, computePosition } from './tooltip';

/**
 * Mirrors the `Youla.directive('tooltip', ...)` callback in ../youla-tooltip.js.
 */
function tooltipDirective(el, output, { modifiers, duration }) {
  const placement = modifiers.find(m => PLACEMENTS.includes(m)) || 'top';
  const trigger   = modifiers.find(m => TRIGGERS.includes(m)) || 'hover';

  const delay   = duration?.unit === 'ms' ? duration.value : 250;
  const content = output == null ? '' : String(output);

  const instance = el._x_tooltip;
  if (!instance) {
    el._x_tooltip = new TooltipInstance(el, content, placement, trigger, delay);
    return;
  }

  instance.updateContent(content);
  instance.updatePlacement(placement);
  instance.updateTrigger(trigger);
  instance.updateDelay(delay);
}

/**
 * jsdom never computes real layout, so these are 0 unless stubbed.
 */
function stubRect(el, rect) {
  el.getBoundingClientRect = () => ({ width: 0, height: 0, ...rect });
}

function stubSize(el, width, height) {
  Object.defineProperty(el, 'offsetWidth', { value: width, configurable: true });
  Object.defineProperty(el, 'offsetHeight', { value: height, configurable: true });
}

/**
 * Mirrors parseAttribute()'s "duration" extraction — a bare "<number><unit>" modifier.
 */
function attr(modifiers = []) {
  const match = modifiers.map(m => /^(\d+)([a-z]+)$/.exec(m)).find(Boolean);
  const duration = match ? { value: Number(match[1]), unit: match[2] } : null;
  return { modifiers, duration };
}

function mount(tag = 'div') {
  const el = document.createElement(tag);
  document.body.appendChild(el);
  return el;
}

/**
 * jsdom never fires "animationend" — waits past EXIT_FALLBACK instead.
 */
function flushExit() {
  return new Promise(resolve => setTimeout(resolve, 260));
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true });
});

afterEach(() => {
  // Closes any click-triggered tooltip left open, so its listeners don't linger.
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('computePosition', () => {
  const viewport = { width: 1000, height: 800 };
  const anchor   = { top: 300, bottom: 330, left: 400, right: 450, width: 50, height: 30 };
  const size     = { width: 100, height: 40 };

  it('places "top" above and horizontally centered on the anchor', () => {
    const { top, left, placement } = computePosition(anchor, size, 'top', viewport);
    expect(placement).toBe('top');
    expect(top).toBe(anchor.top - size.height - 8);
    expect(left).toBe(anchor.left + anchor.width / 2 - size.width / 2);
  });

  it('places "bottom" below the anchor', () => {
    const { top } = computePosition(anchor, size, 'bottom', viewport);
    expect(top).toBe(anchor.bottom + 8);
  });

  it('places "left" to the left of the anchor', () => {
    const { left } = computePosition(anchor, size, 'left', viewport);
    expect(left).toBe(anchor.left - size.width - 8);
  });

  it('places "right" to the right of the anchor', () => {
    const { left } = computePosition(anchor, size, 'right', viewport);
    expect(left).toBe(anchor.right + 8);
  });

  it('"auto" prefers the side with the most room when the anchor sits near the top edge', () => {
    const nearTop = { top: 5, bottom: 35, left: 400, right: 450, width: 50, height: 30 };
    const { placement } = computePosition(nearTop, size, 'auto', viewport);
    expect(placement).not.toBe('top');
  });

  it('"auto" prefers the side with the most room when the anchor sits near the left edge', () => {
    const nearLeft = { top: 300, bottom: 330, left: 2, right: 52, width: 50, height: 30 };
    const { placement } = computePosition(nearLeft, size, 'auto', viewport);
    expect(placement).not.toBe('left');
  });

  it('clamps horizontally so the tooltip never overflows the left edge', () => {
    const nearLeft = { top: 300, bottom: 330, left: 0, right: 10, width: 10, height: 30 };
    const { left } = computePosition(nearLeft, size, 'left', viewport);
    expect(left).toBeGreaterThanOrEqual(0);
  });

  it('clamps horizontally so the tooltip never overflows the right edge', () => {
    const nearRight = { top: 300, bottom: 330, left: 990, right: 1000, width: 10, height: 30 };
    const { left } = computePosition(nearRight, size, 'right', viewport);
    expect(left + size.width).toBeLessThanOrEqual(viewport.width);
  });

  it('clamps vertically so the tooltip never overflows the top edge', () => {
    const nearTop = { top: 0, bottom: 10, left: 400, right: 450, width: 50, height: 10 };
    const { top } = computePosition(nearTop, size, 'top', viewport);
    expect(top).toBeGreaterThanOrEqual(0);
  });

  it('clamps vertically so the tooltip never overflows the bottom edge', () => {
    const nearBottom = { top: 790, bottom: 800, left: 400, right: 450, width: 50, height: 10 };
    const { top } = computePosition(nearBottom, size, 'bottom', viewport);
    expect(top + size.height).toBeLessThanOrEqual(viewport.height);
  });

  it('stays within both edges near a corner', () => {
    const corner = { top: 2, bottom: 12, left: 2, right: 12, width: 10, height: 10 };
    const { top, left } = computePosition(corner, size, 'auto', viewport);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(left).toBeGreaterThanOrEqual(0);
    expect(top + size.height).toBeLessThanOrEqual(viewport.height);
    expect(left + size.width).toBeLessThanOrEqual(viewport.width);
  });
});

describe('tooltipDirective — mobile viewport', () => {
  afterEach(() => {
    delete window.visualViewport;
  });

  it('positions against window.innerWidth/innerHeight when there is no visualViewport', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr());
    const anchor = { top: 500, bottom: 520, left: 100, right: 150, width: 50, height: 20 };
    stubRect(el, anchor);
    stubSize(el._x_tooltip.tooltip, 80, 24);

    el._x_tooltip.show();

    const { top, left } = computePosition(anchor, { width: 80, height: 24 }, el._x_tooltip.placement, { width: 1024, height: 768 });
    expect(el._x_tooltip.tooltip.style.top).toBe(`${top}px`);
    expect(el._x_tooltip.tooltip.style.left).toBe(`${left}px`);
  });

  it('positions against window.visualViewport when present, e.g. with the iOS keyboard open', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr());
    // Within window height, but below the shrunk visual viewport (keyboard open).
    stubRect(el, { top: 500, bottom: 520, left: 100, right: 150, width: 50, height: 20 });
    stubSize(el._x_tooltip.tooltip, 80, 24);
    window.visualViewport = { width: 1024, height: 400 };

    el._x_tooltip.show();

    const { top, left } = computePosition(
      { top: 500, bottom: 520, left: 100, right: 150, width: 50, height: 20 },
      { width: 80, height: 24 },
      el._x_tooltip.placement,
      { width: 1024, height: 400 },
    );
    expect(el._x_tooltip.tooltip.style.top).toBe(`${top}px`);
    expect(el._x_tooltip.tooltip.style.left).toBe(`${left}px`);
  });
});

describe('tooltipDirective — basic lifecycle', () => {
  it('does not add anything to the DOM on init — only once shown', () => {
    const el = mount();
    tooltipDirective(el, 'Hello', attr());

    expect(document.querySelectorAll('.v-tooltip').length).toBe(0);

    el._x_tooltip.show();
    const tooltips = document.querySelectorAll('.v-tooltip');
    expect(tooltips.length).toBe(1);
    expect(tooltips[0].getAttribute('role')).toBe('tooltip');
  });

  it('does not create a duplicate element on repeated calls with the same value', () => {
    const el = mount();
    tooltipDirective(el, 'Hello', attr());
    tooltipDirective(el, 'Hello', attr());
    tooltipDirective(el, 'Hello', attr());
    el._x_tooltip.show();

    expect(document.querySelectorAll('.v-tooltip').length).toBe(1);
  });

  it('reuses the same tooltip DOM node across updates', () => {
    const el = mount();
    tooltipDirective(el, 'First', attr());
    const node = el._x_tooltip.tooltip;

    tooltipDirective(el, 'Second', attr());
    expect(el._x_tooltip.tooltip).toBe(node);
  });

  it('updates content in place without recreating the element', () => {
    const el = mount();
    tooltipDirective(el, 'First', attr());
    el._x_tooltip.show();

    tooltipDirective(el, 'Second', attr());

    expect(el._x_tooltip.tooltip.innerHTML).toBe('Second');
    expect(document.querySelectorAll('.v-tooltip').length).toBe(1);
  });

  it('supports empty content without throwing', () => {
    const el = mount();
    expect(() => tooltipDirective(el, '', attr())).not.toThrow();
    expect(el._x_tooltip.tooltip.innerHTML).toBe('');
  });

  it('never shows a tooltip with empty content', () => {
    const el = mount();
    tooltipDirective(el, '', attr());
    el._x_tooltip.show();
    expect(el._x_tooltip.visible).toBe(false);
    expect(document.body.contains(el._x_tooltip.tooltip)).toBe(false);
  });

  it('hides an already-visible tooltip when its content is cleared', () => {
    const el = mount();
    tooltipDirective(el, 'Hello', attr());
    el._x_tooltip.show();
    expect(el._x_tooltip.visible).toBe(true);

    tooltipDirective(el, '', attr());
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('keeps multiple tooltip instances independent', () => {
    const a = mount(), b = mount();
    tooltipDirective(a, 'A', attr());
    tooltipDirective(b, 'B', attr());

    a._x_tooltip.show();
    expect(a._x_tooltip.visible).toBe(true);
    expect(b._x_tooltip.visible).toBe(false);

    expect(document.body.contains(a._x_tooltip.tooltip)).toBe(true);
    expect(document.body.contains(b._x_tooltip.tooltip)).toBe(false);
  });
});

describe('tooltipDirective — DOM presence and bounce animation', () => {
  it('is appended to the DOM with the enter-bounce class when shown', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr());

    el._x_tooltip.show();

    const tooltip = el._x_tooltip.tooltip;
    expect(document.body.contains(tooltip)).toBe(true);
    expect(tooltip.classList.contains('v-tooltip--in')).toBe(true);
    expect(tooltip.classList.contains('v-tooltip--out')).toBe(false);
  });

  it('switches to the exit-bounce class immediately on hide, before removal', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr());
    el._x_tooltip.show();

    el._x_tooltip.hide();

    const tooltip = el._x_tooltip.tooltip;
    expect(document.body.contains(tooltip)).toBe(true);
    expect(tooltip.classList.contains('v-tooltip--out')).toBe(true);
    expect(tooltip.classList.contains('v-tooltip--in')).toBe(false);
  });

  it('is fully removed from the DOM once the exit animation completes', async () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr());
    el._x_tooltip.show();
    const tooltip = el._x_tooltip.tooltip;

    el._x_tooltip.hide();
    await flushExit();

    expect(document.body.contains(tooltip)).toBe(false);
    expect(tooltip.classList.contains('v-tooltip--out')).toBe(false);
  });

  it('cancels an in-flight exit and replays the enter animation if shown again quickly', async () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr());
    el._x_tooltip.show();
    const tooltip = el._x_tooltip.tooltip;

    el._x_tooltip.hide();
    expect(tooltip.classList.contains('v-tooltip--out')).toBe(true);

    el._x_tooltip.show();
    expect(tooltip.classList.contains('v-tooltip--out')).toBe(false);
    expect(tooltip.classList.contains('v-tooltip--in')).toBe(true);
    expect(document.body.contains(tooltip)).toBe(true);

    // The interrupted hide()'s fallback timer must not remove it later.
    await flushExit();
    expect(document.body.contains(tooltip)).toBe(true);
  });
});

describe('tooltipDirective — HTML content', () => {
  it('renders inline HTML as real DOM nodes, not escaped text', () => {
    const el = mount();
    tooltipDirective(el, '<strong>Title</strong><br><span>Description</span>', attr());

    const tooltip = el._x_tooltip.tooltip;
    expect(tooltip.querySelector('strong')?.textContent).toBe('Title');
    expect(tooltip.querySelector('br')).not.toBeNull();
    expect(tooltip.querySelector('span')?.textContent).toBe('Description');
    expect(tooltip.textContent).not.toContain('<strong>');
  });

  it('renders nested HTML', () => {
    const el = mount();
    tooltipDirective(el, '<div><em>a</em><span><strong>b</strong></span></div>', attr());

    const tooltip = el._x_tooltip.tooltip;
    expect(tooltip.querySelector('div > em')).not.toBeNull();
    expect(tooltip.querySelector('div > span > strong')?.textContent).toBe('b');
  });

  it('renders plain text content unchanged', () => {
    const el = mount();
    tooltipDirective(el, 'Just plain text', attr());
    expect(el._x_tooltip.tooltip.textContent).toBe('Just plain text');
  });
});

describe('tooltipDirective — modifiers', () => {
  it('defaults to placement "top" and trigger "hover"', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr());
    expect(el._x_tooltip.placement).toBe('top');
    expect(el._x_tooltip.trigger).toBe('hover');
  });

  it.each(['top', 'bottom', 'left', 'right', 'auto'])('reads placement modifier ".%s"', placement => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr([placement]));
    expect(el._x_tooltip.placement).toBe(placement);
  });

  it.each(['hover', 'click', 'focus'])('reads trigger modifier ".%s"', trigger => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr([trigger]));
    expect(el._x_tooltip.trigger).toBe(trigger);
  });

  it.each([
    ['top', 'hover'], ['top', 'click'],
    ['bottom', 'hover'], ['bottom', 'click'],
    ['left', 'hover'], ['left', 'click'],
    ['right', 'hover'], ['right', 'click'],
    ['auto', 'hover'], ['auto', 'click'],
  ])('combines placement ".%s" with trigger ".%s"', (placement, trigger) => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr([placement, trigger]));
    expect(el._x_tooltip.placement).toBe(placement);
    expect(el._x_tooltip.trigger).toBe(trigger);
  });
});

describe('tooltipDirective — placement class', () => {
  it.each(['top', 'bottom', 'left', 'right'])('adds "v-tooltip--%s" once shown with that placement', placement => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr([placement]));

    el._x_tooltip.show();

    expect(el._x_tooltip.tooltip.classList.contains(`v-tooltip--${placement}`)).toBe(true);
  });

  it('never adds a literal "v-tooltip--auto" class — it reflects the resolved side instead', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['auto']));
    stubRect(el, { top: 5, bottom: 35, left: 400, right: 450, width: 50, height: 30 });
    stubSize(el._x_tooltip.tooltip, 100, 40);

    el._x_tooltip.show();

    const tooltip = el._x_tooltip.tooltip;
    expect(tooltip.classList.contains('v-tooltip--auto')).toBe(false);
    expect(['top', 'bottom', 'left', 'right'].some(side => tooltip.classList.contains(`v-tooltip--${side}`))).toBe(true);
  });

  it('swaps the class when the placement modifier changes while visible', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['top']));
    el._x_tooltip.show();
    expect(el._x_tooltip.tooltip.classList.contains('v-tooltip--top')).toBe(true);

    tooltipDirective(el, 'Tip', attr(['bottom']));
    expect(el._x_tooltip.tooltip.classList.contains('v-tooltip--top')).toBe(false);
    expect(el._x_tooltip.tooltip.classList.contains('v-tooltip--bottom')).toBe(true);
  });

  it('swaps the class when a later reposition() resolves "auto" to a different side', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['auto']));
    stubSize(el._x_tooltip.tooltip, 100, 40);

    stubRect(el, { top: 5, bottom: 35, left: 400, right: 450, width: 50, height: 30 });
    el._x_tooltip.show();
    const firstSide = ['top', 'bottom', 'left', 'right'].find(side =>
      el._x_tooltip.tooltip.classList.contains(`v-tooltip--${side}`)
    );

    stubRect(el, { top: 760, bottom: 790, left: 400, right: 450, width: 50, height: 30 });
    el._x_tooltip.reposition();
    const secondSide = ['top', 'bottom', 'left', 'right'].find(side =>
      el._x_tooltip.tooltip.classList.contains(`v-tooltip--${side}`)
    );

    expect(secondSide).not.toBe(firstSide);
  });
});

describe('tooltipDirective — hover trigger', () => {
  it('shows on mouseenter and hides on mouseleave', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover', '0ms']));
    stubRect(el, { top: 100, bottom: 120, left: 100, right: 150, width: 50, height: 20 });
    stubSize(el._x_tooltip.tooltip, 80, 24);

    el.dispatchEvent(new Event('mouseenter'));
    expect(el._x_tooltip.visible).toBe(true);

    el.dispatchEvent(new Event('mouseleave'));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('shows on focus and hides on blur, for keyboard accessibility', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover']));
    stubRect(el, { top: 100, bottom: 120, left: 100, right: 150, width: 50, height: 20 });
    stubSize(el._x_tooltip.tooltip, 80, 24);

    el.dispatchEvent(new Event('focus'));
    expect(el._x_tooltip.visible).toBe(true);

    el.dispatchEvent(new Event('blur'));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('does not react to click', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover']));
    el.dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('reappears when content goes empty then non-empty again while still hovered', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover', '0ms']));

    el.dispatchEvent(new Event('mouseenter'));
    expect(el._x_tooltip.visible).toBe(true);

    tooltipDirective(el, '', attr(['hover', '0ms']));
    expect(el._x_tooltip.visible).toBe(false);

    tooltipDirective(el, 'Tip again', attr(['hover', '0ms']));
    expect(el._x_tooltip.visible).toBe(true);
  });

  it('does not add a tabindex or interactive role to a non-interactive target', () => {
    const el = mount('span');
    tooltipDirective(el, 'Tip', attr(['hover']));
    expect(el.hasAttribute('tabindex')).toBe(false);
    expect(el.getAttribute('role')).not.toBe('button');
  });
});

describe('tooltipDirective — touch and outside dismissal', () => {
  it('shows immediately on touchstart, bypassing the hover delay', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover', '300ms']));

    el.dispatchEvent(new Event('touchstart'));
    expect(el._x_tooltip.visible).toBe(true);
  });

  it('closes a touch-opened hover tooltip on an outside click, since there is no mouseleave', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover']));
    el.dispatchEvent(new Event('touchstart'));
    expect(el._x_tooltip.visible).toBe(true);

    const outside = mount();
    outside.dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('closes a touch-opened hover tooltip on Escape', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover']));
    el.dispatchEvent(new Event('touchstart'));
    expect(el._x_tooltip.visible).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('also closes a mouse-hovered tooltip on an outside click', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover', '0ms']));
    el.dispatchEvent(new Event('mouseenter'));
    expect(el._x_tooltip.visible).toBe(true);

    const outside = mount();
    outside.dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('does not accumulate duplicate touchstart listeners across repeated updates', () => {
    const el = mount();
    const addSpy = vi.spyOn(el, 'addEventListener');

    tooltipDirective(el, 'Tip', attr(['hover']));
    tooltipDirective(el, 'Tip changed', attr(['hover']));

    const touchCalls = addSpy.mock.calls.filter(([type]) => type === 'touchstart');
    expect(touchCalls.length).toBe(1);
  });
});

describe('tooltipDirective — focus trigger', () => {
  it('shows on focus and hides on blur, on an <input>', () => {
    const el = mount('input');
    tooltipDirective(el, 'Please fill this field', attr(['focus']));

    el.dispatchEvent(new Event('focus'));
    expect(el._x_tooltip.visible).toBe(true);

    el.dispatchEvent(new Event('blur'));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('does not react to mouse hover — only to actual focus', () => {
    const el = mount('input');
    tooltipDirective(el, 'Tip', attr(['focus']));

    el.dispatchEvent(new Event('mouseenter'));
    expect(el._x_tooltip.visible).toBe(false);

    el.dispatchEvent(new Event('mouseleave'));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('reappears when content goes empty then non-empty again while still focused (validation error re-triggering)', () => {
    const el = mount('input');
    tooltipDirective(el, 'Invalid email', attr(['focus']));

    el.dispatchEvent(new Event('focus'));
    expect(el._x_tooltip.visible).toBe(true);

    // Typing a valid value clears the error — tooltip hides, field stays focused.
    tooltipDirective(el, '', attr(['focus']));
    expect(el._x_tooltip.visible).toBe(false);

    // Deleting characters makes it invalid again — must reappear without a fresh focus event.
    tooltipDirective(el, 'Invalid email', attr(['focus']));
    expect(el._x_tooltip.visible).toBe(true);
  });

  it('does not react to click', () => {
    const el = mount('input');
    tooltipDirective(el, 'Tip', attr(['focus']));

    el.dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('shows immediately, ignoring any hover delay modifier', () => {
    const el = mount('input');
    tooltipDirective(el, 'Tip', attr(['focus', '300ms']));

    el.dispatchEvent(new Event('focus'));
    expect(el._x_tooltip.visible).toBe(true);
  });

  it('works the same on a non-input element, since focusability is never forced', () => {
    const el = mount('button');
    tooltipDirective(el, 'Tip', attr(['focus']));

    el.dispatchEvent(new Event('focus'));
    expect(el._x_tooltip.visible).toBe(true);
  });
});

describe('tooltipDirective — hover delay', () => {
  it('defaults to a non-zero delay when no bare <n>ms modifier is set at all', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover']));

    expect(el._x_tooltip.delay).toBeGreaterThan(0);

    el.dispatchEvent(new Event('mouseenter'));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('shows after the default delay elapses, with no bare <n>ms modifier at all', async () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover']));

    el.dispatchEvent(new Event('mouseenter'));
    await new Promise(resolve => setTimeout(resolve, el._x_tooltip.delay + 50));

    expect(el._x_tooltip.visible).toBe(true);
  });

  it('reads the delay from a bare "<n>ms" modifier', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover', '300ms']));
    expect(el._x_tooltip.delay).toBe(300);
  });

  it('treats an explicit "0ms" as "no delay", not "unset"', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover', '0ms']));
    expect(el._x_tooltip.delay).toBe(0);

    el.dispatchEvent(new Event('mouseenter'));
    expect(el._x_tooltip.visible).toBe(true);
  });

  it('does not show right away once a delay is set', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover', '30ms']));

    el.dispatchEvent(new Event('mouseenter'));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('shows once the cursor has stayed for the full delay', async () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover', '30ms']));

    el.dispatchEvent(new Event('mouseenter'));
    await new Promise(resolve => setTimeout(resolve, 60));

    expect(el._x_tooltip.visible).toBe(true);
  });

  it('never shows if the cursor leaves before the delay elapses', async () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover', '30ms']));

    el.dispatchEvent(new Event('mouseenter'));
    el.dispatchEvent(new Event('mouseleave'));
    await new Promise(resolve => setTimeout(resolve, 60));

    expect(el._x_tooltip.visible).toBe(false);
  });

  it('shows immediately on focus even with a hover delay modifier set', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover', '300ms']));

    el.dispatchEvent(new Event('focus'));
    expect(el._x_tooltip.visible).toBe(true);
  });

  it('cancels a pending delayed show if the element is destroyed first', async () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover', '30ms']));

    el.dispatchEvent(new Event('mouseenter'));
    el._x_tooltip.destroy();
    await new Promise(resolve => setTimeout(resolve, 60));

    expect(el._x_tooltip).toBeUndefined();
    expect(document.querySelectorAll('.v-tooltip').length).toBe(0);
  });

  it('applies an updated delay from a later directive call', async () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover', '300ms']));
    tooltipDirective(el, 'Tip', attr(['hover', '30ms']));

    el.dispatchEvent(new Event('mouseenter'));
    await new Promise(resolve => setTimeout(resolve, 60));

    expect(el._x_tooltip.visible).toBe(true);
  });
});

describe('tooltipDirective — click trigger', () => {
  it('toggles open then closed on repeated clicks', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['click']));

    el.dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(true);

    el.dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('stays open right after the opening click (no immediate self-close)', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['click']));

    el.dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(true);
  });

  it('closes on an outside click', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['click']));
    el.dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(true);

    const outside = mount();
    outside.dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('does not close on a click inside the tooltip itself', () => {
    const el = mount();
    tooltipDirective(el, '<button>inside</button>', attr(['click']));
    el.dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(true);

    el._x_tooltip.tooltip.querySelector('button').dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(true);
  });

  it('closes on Escape', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['click']));
    el.dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(el._x_tooltip.visible).toBe(false);
  });

  it('does not react to hover', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['click']));
    el.dispatchEvent(new Event('mouseenter'));
    expect(el._x_tooltip.visible).toBe(false);
  });
});

describe('tooltipDirective — different target elements', () => {
  it.each(['div', 'span', 'p', 'a', 'button', 'input', 'img'])('works on a <%s> element', tag => {
    const el = mount(tag);
    tooltipDirective(el, 'Tip', attr(['click']));

    el.dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(true);
  });
});

describe('tooltipDirective — updates and modifier changes', () => {
  it('rewires listeners when the trigger modifier changes from hover to click', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover', '0ms']));

    el.dispatchEvent(new Event('mouseenter'));
    expect(el._x_tooltip.visible).toBe(true);
    el.dispatchEvent(new Event('mouseleave'));

    tooltipDirective(el, 'Tip', attr(['click']));

    el.dispatchEvent(new Event('mouseenter'));
    expect(el._x_tooltip.visible).toBe(false);

    el.dispatchEvent(new Event('click', { bubbles: true }));
    expect(el._x_tooltip.visible).toBe(true);
  });

  it('does not accumulate duplicate trigger listeners across repeated updates', () => {
    const el = mount();
    const addSpy = vi.spyOn(el, 'addEventListener');

    tooltipDirective(el, 'Tip', attr(['hover']));
    tooltipDirective(el, 'Tip changed', attr(['hover']));
    tooltipDirective(el, 'Tip changed again', attr(['hover']));

    const mouseenterCalls = addSpy.mock.calls.filter(([type]) => type === 'mouseenter');
    expect(mouseenterCalls.length).toBe(1);
  });

  it('does not accumulate document listeners across repeated open/close cycles', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['click']));

    const addSpy    = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    for (let i = 0; i < 3; i++) {
      el.dispatchEvent(new Event('click', { bubbles: true })); // open
      el.dispatchEvent(new Event('click', { bubbles: true })); // close
    }

    const opens  = addSpy.mock.calls.filter(([type]) => type === 'click').length;
    const closes = removeSpy.mock.calls.filter(([type]) => type === 'click').length;
    expect(opens).toBe(3);
    expect(closes).toBe(3);
  });
});

describe('tooltipDirective — destroy and removal cleanup', () => {
  it('removes the tooltip node immediately on destroy(), without waiting for an exit animation', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr());
    el._x_tooltip.show();
    const node = el._x_tooltip.tooltip;
    expect(document.body.contains(node)).toBe(true);

    el._x_tooltip.destroy();

    expect(document.body.contains(node)).toBe(false);
    expect(el._x_tooltip).toBeUndefined();
  });

  it('is inert after destroy — no error, no reappearance, on further interaction', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr(['hover']));
    el._x_tooltip.show();
    el._x_tooltip.destroy();

    expect(() => el.dispatchEvent(new Event('mouseenter'))).not.toThrow();
    expect(document.querySelectorAll('.v-tooltip').length).toBe(0);
  });

  it('creates a fresh instance on reinitialization after destroy', () => {
    const el = mount();
    tooltipDirective(el, 'Tip', attr());
    const firstInstance = el._x_tooltip;
    firstInstance.show();
    firstInstance.destroy();

    tooltipDirective(el, 'Tip again', attr());
    el._x_tooltip.show();
    expect(el._x_tooltip).not.toBe(firstInstance);
    expect(document.querySelectorAll('.v-tooltip').length).toBe(1);
  });

  it('tears itself down automatically once the element is removed from the DOM', async () => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const el = document.createElement('div');
    container.appendChild(el);
    tooltipDirective(el, 'Tip', attr());
    el._x_tooltip.show();
    const node = el._x_tooltip.tooltip;

    container.remove();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(document.body.contains(node)).toBe(false);
  });
});

describe('tooltipDirective — no leaked global listeners', () => {
  it('installs at most one shared scroll and one shared resize listener, regardless of instance count', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');

    const a = mount(), b = mount(), c = mount();
    tooltipDirective(a, 'A', attr());
    tooltipDirective(b, 'B', attr());
    tooltipDirective(c, 'C', attr());

    a._x_tooltip.show();
    b._x_tooltip.show();
    c._x_tooltip.show();

    const scrolls  = addSpy.mock.calls.filter(([type]) => type === 'scroll').length;
    const resizes   = addSpy.mock.calls.filter(([type]) => type === 'resize').length;
    expect(scrolls).toBeLessThanOrEqual(1);
    expect(resizes).toBeLessThanOrEqual(1);
  });

  it('installs at most one MutationObserver regardless of instance count', () => {
    const ObserveSpy = vi.spyOn(MutationObserver.prototype, 'observe');

    const a = mount(), b = mount();
    tooltipDirective(a, 'A', attr());
    tooltipDirective(b, 'B', attr());

    expect(ObserveSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
