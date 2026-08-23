export const PLACEMENTS = ['top', 'bottom', 'left', 'right', 'auto'];
export const TRIGGERS   = ['hover', 'click', 'focus'];

const OFFSET = 8;
const MARGIN = 4;

const TOOLTIP_CLASS = 'v-tooltip';

// Fallback removal if the CSS exit animation never fires (e.g. reduced motion).
const EXIT_FALLBACK = 200;

// Shared across every tooltip — one observer and one scroll/resize pair, not one each.
const trackedElements = new Map();
const visibleTooltips = new Set();

let uid = 0;
let removalObserver;
let globalListenersAttached = false;

function ensureRemovalObserver() {
  if (removalObserver) {
    return;
  }
  removalObserver = new MutationObserver(() => {
    trackedElements.forEach((instance, el) => {
      if (!el.isConnected) {
        instance.destroy();
      }
    });
  });
  removalObserver.observe(document.body, { childList: true, subtree: true });
}

// Adds [target, type, handler, options] listeners; returns a function that removes them all.
function bind(listeners) {
  listeners.forEach(([target, type, handler, options]) => {
    target.addEventListener(type, handler, options);
  });

  return () => listeners.forEach(([target, type, handler, options]) => target.removeEventListener(type, handler, options));
}

// Coalesces bursts of scroll/resize events into one reposition pass per frame.
let repositionQueued = false;
const raf = window.requestAnimationFrame || (fn => setTimeout(fn, 16));

function scheduleReposition() {
  if (repositionQueued) {
    return;
  }
  repositionQueued = true;
  raf(() => {
    repositionQueued = false;
    visibleTooltips.forEach(instance => instance.reposition());
  });
}

function ensureGlobalListeners() {
  if (globalListenersAttached) {
    return;
  }
  globalListenersAttached = true;

  // capture:true also catches scrolling inside a nested scroll container.
  window.addEventListener('scroll', scheduleReposition, { passive: true, capture: true });
  window.addEventListener('resize', scheduleReposition, { passive: true });

  // Covers iOS Safari's keyboard and pinch-zoom, which resize the visual viewport without a window "resize".
  window.visualViewport?.addEventListener('resize', scheduleReposition);
  window.visualViewport?.addEventListener('scroll', scheduleReposition);
}

/**
 * Resolves a tooltip's position next to "anchorRect" for the given placement, clamped to the viewport.
 *
 * @param {object} anchorRect - The trigger element's bounding box.
 * @param {{width: number, height: number}} size - The tooltip's measured size.
 * @param {string} placement - "top" / "bottom" / "left" / "right" / "auto".
 * @param {{width: number, height: number}} viewport
 * @param {number} [offset] - Gap between the anchor and the tooltip.
 * @returns {{top: number, left: number, placement: string}}
 */
export function computePosition(anchorRect, size, placement, viewport, offset = OFFSET) {
  const centerY = anchorRect.top + anchorRect.height / 2 - size.height / 2;
  const centerX = anchorRect.left + anchorRect.width / 2 - size.width / 2;

  const boxes = {
    top:    { top: anchorRect.top - size.height - offset, left: centerX },
    bottom: { top: anchorRect.bottom + offset,            left: centerX },
    left:   { top: centerY,                               left: anchorRect.left - size.width - offset },
    right:  { top: centerY,                               left: anchorRect.right + offset },
  };

  const space = {
    top:    anchorRect.top,
    bottom: viewport.height - anchorRect.bottom,
    left:   anchorRect.left,
    right:  viewport.width - anchorRect.right,
  };

  let resolved = placement;
  if (placement === 'auto' || !boxes[placement]) {
    const bySpace = Object.keys(space).sort((a, b) => space[b] - space[a]);
    resolved = bySpace.find(side => {
      const needed = side === 'top' || side === 'bottom' ? size.height : size.width;
      return space[side] >= needed + offset;
    }) || bySpace[0];
  }

  let { top, left } = boxes[resolved];

  left = Math.min(Math.max(left, MARGIN), Math.max(viewport.width - size.width - MARGIN, MARGIN));
  top  = Math.min(Math.max(top, MARGIN), Math.max(viewport.height - size.height - MARGIN, MARGIN));

  return { top, left, placement: resolved };
}

// A tooltip's DOM element, positioning, triggers, and lifecycle. Cached as `el._x_tooltip`.
export class TooltipInstance {
  constructor(el, content, placement, trigger, delay = 250) {
    Object.assign(this, { el, content, placement, trigger, delay, visible: false });

    // Only inserted into the DOM while shown — see show()/hide().
    this.tooltip = Object.assign(document.createElement('div'), {
      id: `${TOOLTIP_CLASS}-${++uid}`,
      innerHTML: content,
    });
    this.tooltip.setAttribute('role', 'tooltip');
    this.syncClasses();

    this.attachTriggers();

    trackedElements.set(el, this);
    ensureRemovalObserver();
  }

  updateContent(content) {
    if (this.content === content) {
      return;
    }
    this.content = content;
    this.tooltip.innerHTML = content;

    if (!content) {
      this.hide();
    } else if (this.visible) {
      this.reposition();
    } else if (this.active) {
      this.show();
    }
  }

  updatePlacement(placement) {
    if (this.placement === placement) {
      return;
    }
    this.placement = placement;
    if (this.visible) {
      this.reposition();
    }
  }

  updateTrigger(trigger) {
    if (this.trigger === trigger) {
      return;
    }
    this.detachTriggers();
    this.trigger = trigger;
    this.attachTriggers();
  }

  updateDelay(delay) {
    this.delay = delay;
  }

  attachTriggers() {
    const el = this.el;

    if (this.trigger === 'click') {
      this.detach = bind([[el, 'click', () => this.toggle()]]);
      return;
    }

    // "hover" adds mouseenter/mouseleave (delayed) on top of focus/blur.
    const listeners = [
      [el, 'focus', () => this.activate()],
      [el, 'blur', () => this.deactivate()],
    ];

    if (this.trigger === 'hover') {
      listeners.push(
        [el, 'mouseenter', () => {
          if (this.delay > 0) {
            this.hoverTimer = setTimeout(() => this.activate(), this.delay);
          } else {
            this.activate();
          }
        }],
        [el, 'mouseleave', () => {
          clearTimeout(this.hoverTimer);
          this.deactivate();
        }],
        // Touch has no hover/dwell to time — show right away, like focus.
        [el, 'touchstart', () => {
          clearTimeout(this.hoverTimer);
          this.activate();
        }, { passive: true }],
      );
    }

    this.detach = bind(listeners);
  }

  detachTriggers() {
    clearTimeout(this.hoverTimer);
    this.detach?.();
    this.detach = null;
  }

  reposition() {
    const anchorRect = this.el.getBoundingClientRect();
    const size        = { width: this.tooltip.offsetWidth, height: this.tooltip.offsetHeight };
    // visualViewport reflects the actually-visible area on iOS Safari; innerWidth/innerHeight don't.
    const vv          = window.visualViewport;
    const viewport     = { width: vv?.width ?? window.innerWidth, height: vv?.height ?? window.innerHeight };
    const { top, left, placement } = computePosition(anchorRect, size, this.placement, viewport);

    this.tooltip.style.top  = `${top}px`;
    this.tooltip.style.left = `${left}px`;
    this.resolvedPlacement  = placement;
    this.syncClasses();
  }

  // The only place that writes the tooltip's className.
  syncClasses() {
    const classes = [TOOLTIP_CLASS];
    if (this.animationState) {
      classes.push(`${TOOLTIP_CLASS}--${this.animationState}`);
    }
    if (this.resolvedPlacement) {
      classes.push(`${TOOLTIP_CLASS}--${this.resolvedPlacement}`);
    }
    this.tooltip.className = classes.join(' ');
  }

  show() {
    if (this.visible || !this.content) {
      return;
    }
    this.visible = true;
    this.cancelExit();
    this.animationState = 'in';

    // Hidden while positioning, so it doesn't flash at the wrong spot.
    this.tooltip.style.visibility = 'hidden';
    document.body.appendChild(this.tooltip);

    this.reposition();
    this.tooltip.style.visibility = 'visible';

    this.el.setAttribute('aria-describedby', this.tooltip.id);

    visibleTooltips.add(this);
    ensureGlobalListeners();

    // Outside click/tap or Escape closes it; capture phase so it can't fire for the opening click itself.
    this.detachDocListeners = bind([
      [document, 'click', e => {
        if (!this.el.contains(e.target) && !this.tooltip.contains(e.target)) {
          this.deactivate();
        }
      }, true],
      [document, 'keydown', e => e.key === 'Escape' && this.deactivate()],
    ]);
  }

  hide() {
    if (!this.visible) {
      return;
    }
    this.visible = false;
    this.el.removeAttribute('aria-describedby');
    visibleTooltips.delete(this);

    this.detachDocListeners?.();
    this.detachDocListeners = null;

    // Removed from the DOM once the exit animation ends (see cancelExit()).
    this.animationState = 'out';
    this.syncClasses();

    this.onExitEnd = () => this.cancelExit();
    this.tooltip.addEventListener('animationend', this.onExitEnd, { once: true });
    this.exitTimer = setTimeout(this.onExitEnd, EXIT_FALLBACK);
  }

  // Removes the tooltip from the DOM and clears any pending exit bookkeeping.
  cancelExit() {
    clearTimeout(this.exitTimer);
    if (this.onExitEnd) {
      this.tooltip.removeEventListener('animationend', this.onExitEnd);
      this.onExitEnd = null;
    }
    this.animationState = null;
    this.syncClasses();
    this.tooltip.remove();
  }

  toggle() {
    this.active ? this.deactivate() : this.activate();
  }

  activate() {
    this.active = true;
    this.show();
  }

  deactivate() {
    this.active = false;
    this.hide();
  }

  destroy() {
    this.hide();
    this.cancelExit();
    this.detachTriggers();
    trackedElements.delete(this.el);
    delete this.el._x_tooltip;
  }
}
