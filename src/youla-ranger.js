class Ranger {
  // Every mounted instance, in creation order (for bulk refresh, e.g. after a skin change).
  static instances = [];

  // Keys treated as a keyboard-driven nudge/drag (label visibility, onStart/onEnd).
  static NAVIGATION_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'];

  // How sharply the --ranger-scale arc peaks; squaring narrows/heightens it vs a plain raised cosine.
  static ARC_SHARPNESS = 2;

  static DEFAULTS = {
    classes: {
      container: 'ranger',
      input: 'ranger-input',
      fill: 'ranger-fill',
      inputTo: 'ranger-input--to',
      scale: 'ranger-scale',
      scaleTick: 'ranger-scale-tick',
      scaleMinorTick: 'ranger-scale-tick ranger-scale-tick--minor',
      // Added on top of scaleTick (not a replacement) for whichever major tick lands on minValue/maxValue.
      scaleTickLimit: 'ranger-scale-tick--limit',
      label: 'ranger-label',
      labelItem: 'ranger-label-item',
      mark: 'ranger-marks',
      markItem: 'ranger-mark',
      markRange: 'ranger-mark ranger-mark--range',
    },

    scaleTickPrefix: '',
    scaleTickSuffix: '',
    scaleTicksCount: 10,
    // Unlabeled ticks inserted between each pair of major ticks, evenly splitting that gap.
    scaleMinorTicksCount: 0,
    // Radius (in ticks) of the --ranger-scale arc on either side of a handle — see updateScale.
    scaleAnimatedTicksCount: 1,

    labelIsVisible: true,
    labelPrefix: '',
    labelSuffix: '',
    // Keep the label hidden except while a handle is actively being dragged or nudged.
    labelOnDragOnly: false,

    disabled: false,

    // CSS background (e.g. a linear-gradient) painted on the fill instead of accentColor.
    fillGradient: null,

    // Display values (labels, dates, ...) to pick by index — min/max/step derived automatically.
    values: null,
    // (value) => string; overrides the label/tick prefixes+suffixes wherever a value is shown.
    format: null,
    // Displays the value exponentially between min/max while dragging itself stays linear.
    logScale: false,

    // Clamps resolved values to [minValue, maxValue] without touching native min/max, so the scale/fill/labels still span the full domain.
    minValue: null,
    maxValue: null,

    // Values that magnetically pull a handle in once it's within snapThreshold of them.
    snapPoints: [],
    snapThreshold: 0.02,
    // Step for Shift+Arrow nudges; defaults to step/10 when unset.
    fineStep: null,
    // Minimum distance between handles (range mode); ignored when fixedRange is set.
    minGap: 0,

    // Range mode: locks the handle gap so dragging either one slides, not resizes, the range.
    fixedRange: false,

    // Fixed points/zones, independent of the tick scale: { value } for a point, { from, to } for a zone.
    marks: [],

    // External <input> elements kept in sync with the lower/single and upper handles.
    fromInput: null,
    toInput: null,

    // (value, slider) — [from, to] in range mode; slider is the fill during a whole-range drag.
    onStart: null, // fired when a handle drag (pointer or keyboard) begins
    onChange: null, // fired on every resolved value change
    onEnd: null, // fired when a handle drag (pointer or keyboard) ends
    onFocus: null, // fired when a handle gains focus
    onBlur: null, // fired when a handle loses focus
  };

  /** Creates a DOM element, optionally with a class and inner content. */
  static createElement(tag, classes, content = '') {
    const element = document.createElement(tag);

    if (classes) {
      element.className = classes;
    }

    if (content) {
      element.innerHTML = content;
    }
    return element;
  }

  /** Rounds to the decimal precision of step ("any" = unrounded). */
  static roundToStep(value, step) {
    const stepString = String(step);

    if (stepString.toLowerCase() === 'any') {
      return Number(value);
    }

    const decimals = stepString.includes('.') ? stepString.split('.')[1].length : 0;

    return parseFloat(Number(value).toFixed(decimals));
  }

  /** Percentage `value` falls at between `start` and `end`. */
  static calculatePercent(start, end, value) {
    return ((value - start) / (end - start)) * 100;
  }

  /**
   * Inverse of logScale's position→value mapping: converts a real/displayed value back to the
   * linear drag position, so markup can declare `value`/`data-points` in real units.
   */
  static logScalePosition(value, min, max) {
    return min + (max - min) * (Math.log(value / min) / Math.log(max / min));
  }

  // Smallest divisor of lastIndex >= minSkip, so 0/lastIndex stay included; falls back to lastIndex.
  static findSkip(lastIndex, minSkip) {
    for (let skip = minSkip; skip <= lastIndex; skip++) {
      if (lastIndex % skip === 0) {
        return skip;
      }
    }
    return lastIndex;
  }

  /** @param {string|HTMLInputElement} target @param {object} [options] */
  constructor(target, options = {}) {
    this.fromSlider = typeof target === 'string' ? document.querySelector(target) : target;

    if (!(this.fromSlider instanceof HTMLInputElement)) {
      throw new Error(`Ranger: no slider element found for "${target}"`);
    }

    this.toSlider = null;

    Object.assign(this, Ranger.DEFAULTS, options, {
      classes: { ...Ranger.DEFAULTS.classes, ...options.classes },
      // Cloned per instance — DEFAULTS.snapPoints/marks are shared arrays otherwise.
      snapPoints: options.snapPoints ? [...options.snapPoints] : [],
      marks: options.marks ? [...options.marks] : [],
    });

    // One major tick per value by default, else fractional indexes round to duplicate values.
    if (this.values && options.scaleTicksCount === undefined) {
      this.scaleTicksCount = this.values.length - 1;
    }

    this.initialize();
    Ranger.instances.push(this);
  }

  get isRange() {
    return this.toSlider !== null;
  }

  // Whether the slider flows RTL, inherited via CSS from an ancestor's dir attribute.
  get isRTL() {
    return getComputedStyle(this.wrapper).direction === 'rtl';
  }

  // Moves the single/lower handle through the normal pipeline (resolveValue, fillSlider, emitChange, ...).
  setValue(value) {
    this.fromSlider.value = value;
    this.fromSlider.dispatchEvent(new Event('input'));
  }

  // Moves both handles; both raw values are set before either dispatches so minGap/fixedRange see the real pair.
  setRange(from, to) {
    if (!this.isRange) {
      throw new Error('Ranger: setRange() requires a range slider (data-points)');
    }

    this.fromSlider.value = from;
    this.toSlider.value = to;
    this.fromSlider.dispatchEvent(new Event('input'));
    this.toSlider.dispatchEvent(new Event('input'));
  }

  // Applies an options patch after mount; rebuilds the scale/marks/label when something baked into their DOM changes.
  update({ min, max, step, ...options } = {}) {
    const rebuildsScale = ['values', 'scaleTicksCount', 'scaleMinorTicksCount', 'format', 'scaleTickPrefix', 'scaleTickSuffix'].some((key) => key in options) || min !== undefined || max !== undefined;
    const rebuildsMarks = min !== undefined || max !== undefined || 'values' in options || 'marks' in options;

    Object.assign(this, options, {
      classes: options.classes ? { ...this.classes, ...options.classes } : this.classes,
      snapPoints: options.snapPoints ? [...options.snapPoints] : this.snapPoints,
      marks: options.marks ? [...options.marks] : this.marks,
    });

    if (options.values) {
      this.fromSlider.min = 0;
      this.fromSlider.max = this.values.length - 1;
      this.step = 1;
      if (!('scaleTicksCount' in options)) {
        this.scaleTicksCount = this.values.length - 1;
      }
    } else {
      if (min !== undefined) {
        this.fromSlider.min = min;
      }
      if (max !== undefined) {
        this.fromSlider.max = max;
      }
    }
    if (this.toSlider) {
      this.toSlider.min = this.fromSlider.min;
      this.toSlider.max = this.fromSlider.max;
    }
    if (step !== undefined) {
      this.step = step;
    }

    if ('disabled' in options) {
      this.fromSlider.disabled = this.disabled;
      if (this.toSlider) {
        this.toSlider.disabled = this.disabled;
      }
      this.wrapper.classList.toggle('is-disabled', this.disabled);
    }

    // Re-derives rangeSize the same way initialize() does, in case fixedRange just turned on.
    if ('fixedRange' in options && this.isRange) {
      this.rangeSize = typeof this.fixedRange === 'number'
        ? this.fixedRange
        : Number(this.toSlider.value) - Number(this.fromSlider.value);
    }

    if ('labelIsVisible' in options) {
      if (this.labelIsVisible && !this.label) {
        this.label = this.createLabel();
      } else if (!this.labelIsVisible && this.label) {
        this.label.remove();
        this.label = this.labelFrom = this.labelTo = null;
      }
    }

    const wantsScale = this.scaleTicksCount > 0;
    if (wantsScale && (rebuildsScale || !this.scale)) {
      this.scale?.remove();
      this.scale = this.createScale();
    } else if (!wantsScale && this.scale) {
      this.scale.remove();
      this.scale = null;
    }

    const wantsMarks = this.marks.length > 0;
    if (wantsMarks && (rebuildsMarks || !this.marksContainer)) {
      this.marksContainer?.remove();
      this.marksContainer = this.createMarks();
    } else if (!wantsMarks && this.marksContainer) {
      this.marksContainer.remove();
      this.marksContainer = null;
      this.markEntries = null;
    }

    this.reorderLayers();

    this.fromSlider.dispatchEvent(new Event('input'));
    if (this.isRange) {
      this.toSlider.dispatchEvent(new Event('input'));
    }
  }

  initialize() {
    if (this.values) {
      this.fromSlider.min = 0;
      this.fromSlider.max = this.values.length - 1;
      this.fromSlider.step = 1;
      this.format ||= (index) => this.values[Math.round(index)] ?? index;
    }

    if (this.logScale) {
      const min = Number(this.fromSlider.min);
      const max = Number(this.fromSlider.max);
      this.format ||= (position) => Math.round(min * (max / min) ** ((position - min) / (max - min)));

      // `value`/`data-points` are real units (e.g. a $10 price), not the drag position — convert up front so everything below sees a normal position.
      this.fromSlider.value = Ranger.logScalePosition(Number(this.fromSlider.value), min, max);
      if (this.fromSlider.hasAttribute('data-points')) {
        this.fromSlider.dataset.points = this.parsePoints()
          .map((point) => Ranger.logScalePosition(point, min, max))
          .join(',');
      }
    }

    // Neutralizes native `step` to "any" (it re-snaps assignments, breaking fineStep); `this.step` holds the real one.
    this.step = this.fromSlider.step;
    this.fromSlider.step = 'any';

    this.fromSlider.classList.add(this.classes.input);

    const wrapper = document.createElement('div');
    wrapper.classList.add(this.classes.container);

    this.fromSlider.parentNode.insertBefore(wrapper, this.fromSlider);
    wrapper.appendChild(this.fromSlider);
    this.wrapper = wrapper;

    this.fill = wrapper.appendChild(document.createElement('div'));
    this.fill.className = this.classes.fill;
    // Purely visual; hidden from AT (the value's already exposed via the handle).
    this.fill.setAttribute('aria-hidden', 'true');

    if (this.fromSlider.hasAttribute('data-points')) {
      this.toSlider = this.fromSlider.cloneNode(false);
      this.toSlider.removeAttribute('data-points');
      this.toSlider.removeAttribute('id');
      this.toSlider.className += ` ${this.classes.inputTo}`;
      this.toSlider.value = Math.max(Number(this.fromSlider.value), this.parsePoints()[0]);

      wrapper.appendChild(this.toSlider);

      if (this.fixedRange) {
        this.rangeSize = typeof this.fixedRange === 'number'
          ? this.fixedRange
          : Number(this.toSlider.value) - Number(this.fromSlider.value);

        // Honors an explicit numeric fixedRange even if data-points's own gap differs.
        if (typeof this.fixedRange === 'number') {
          const max = Number(this.fromSlider.max);
          this.toSlider.value = Ranger.roundToStep(
            Math.min(Number(this.fromSlider.value) + this.rangeSize, max),
            this.step,
          );
        }
      }
    }

    if (this.disabled) {
      this.fromSlider.disabled = true;
      if (this.toSlider) {
        this.toSlider.disabled = true;
      }
      wrapper.classList.add('is-disabled');
    } else if (this.isRange) {
      this.fill.classList.add('is-draggable');
    }

    // Snapshot of what each handle started at, for dblclick-to-reset.
    this.defaultFromValue = this.fromSlider.value;
    this.defaultToValue = this.toSlider ? this.toSlider.value : null;

    this.fillSlider();
    this.addListeners();

    // Re-fills on resize since fillGradient positions itself in px (stale otherwise).
    if (this.fillGradient) {
      new ResizeObserver(() => this.fillSlider()).observe(this.wrapper);
    }

    if (this.labelIsVisible) {
      this.label = this.createLabel();
    }
    if (this.scaleTicksCount > 0) {
      this.scale = this.createScale();
    }
    if (this.marks.length > 0) {
      this.marksContainer = this.createMarks();
    }

    this.reorderLayers();
  }

  /**
   * Parses data-points into extra handle starting values; only the first entry is used (upper handle).
   * Falls back to max when an entry is missing or not a number.
   */
  parsePoints() {
    const attr = this.fromSlider.dataset.points ?? '';
    const parts = attr.length > 0 ? attr.split(',') : [''];

    return parts.map((part) => {
      const trimmed = part.trim();
      const value = trimmed === '' ? NaN : Number(trimmed);

      return Number.isNaN(value) ? Number(this.fromSlider.max) : value;
    });
  }

  addListeners() {
    // Registered first so startDrag reads the pre-move value before handleKeydown moves it.
    if (this.onStart || this.onEnd || this.onFocus || this.onBlur) {
      this.bindCallbackListeners();
    }

    this.fromSlider.oninput = () => this.controlFromSlider();
    this.fromSlider.addEventListener('keydown', (event) => this.handleKeydown(event, this.fromSlider));
    this.fromSlider.addEventListener('dblclick', () => this.resetSlider(this.fromSlider, this.defaultFromValue));

    if (this.isRange) {
      this.toSlider.oninput = () => this.controlToSlider();
      this.toSlider.addEventListener('keydown', (event) => this.handleKeydown(event, this.toSlider));
      this.toSlider.addEventListener('dblclick', () => this.resetSlider(this.toSlider, this.defaultToValue));

      // Always attached; handleFillDragStart itself checks this.disabled, since update() can toggle it later.
      this.fill.addEventListener('pointerdown', (event) => this.handleFillDragStart(event));
    }

    this.wrapper.addEventListener('click', (event) => this.handleTrackClick(event));

    [['fromInput', 'fromSlider'], ['toInput', 'toSlider']].forEach(([inputKey, sliderKey]) => {
      const input = this[inputKey];

      if (input) {
        input.addEventListener('input', () => {
          this[sliderKey].value = input.value;
          this[sliderKey].dispatchEvent(new Event('input'));
        });
      }
    });
  }

  // Wires onStart/onEnd/onFocus/onBlur; onChange fires separately, from control*Slider.
  bindCallbackListeners() {
    [this.fromSlider, this.toSlider].filter(Boolean).forEach((slider) => {
      slider.addEventListener('focus', () => this.onFocus?.(Number(slider.value), slider));
      slider.addEventListener('blur', () => this.onBlur?.(Number(slider.value), slider));

      slider.addEventListener('pointerdown', () => this.startDrag(slider));
      slider.addEventListener('keydown', (event) => Ranger.NAVIGATION_KEYS.includes(event.key) && this.startDrag(slider));
      slider.addEventListener('keyup', (event) => Ranger.NAVIGATION_KEYS.includes(event.key) && this.endDrag(slider));
    });

    document.addEventListener('pointerup', () => this.activeDragSlider && this.endDrag(this.activeDragSlider));
  }

  startDrag(slider) {
    this.activeDragSlider = slider;
    this.onStart?.(Number(slider.value), slider);
  }

  endDrag(slider) {
    this.activeDragSlider = null;
    this.onEnd?.(Number(slider.value), slider);
  }

  // Reports [from, to] in range mode (else the plain value) plus the triggering handle.
  emitChange(slider) {
    if (!this.onChange) {
      return;
    }

    const value = this.isRange ? [Number(this.fromSlider.value), Number(this.toSlider.value)] : Number(slider.value);
    this.onChange(value, slider);
  }

  controlFromSlider() {
    if (!this.isRange) {
      this.fromSlider.value = this.resolveValue(this.fromSlider.value, this.stepFor(this.fromSlider));
      this.fillSlider();

      if (this.fromInput) {
        this.fromInput.value = this.fromSlider.value;
      }
      this.emitChange(this.fromSlider);
      return;
    }

    if (this.fixedRange) {
      this.slideFixedRange(this.fromSlider);
      return;
    }

    const [from, to] = this.getParsed(this.fromSlider, this.toSlider);
    const ceiling = to - this.minGap;
    const value = from > ceiling ? Ranger.roundToStep(ceiling, this.step) : from;

    this.fromSlider.value = value;
    this.fillSlider();

    if (this.fromInput) {
      this.fromInput.value = value;
    }
    this.emitChange(this.fromSlider);
  }

  controlToSlider() {
    if (this.fixedRange) {
      this.slideFixedRange(this.toSlider);
      return;
    }

    const [from, to] = this.getParsed(this.fromSlider, this.toSlider);
    const floor = from + this.minGap;
    const value = Math.max(to, Ranger.roundToStep(floor, this.step));

    this.toSlider.value = value;
    this.fillSlider();
    this.updateHandleStackOrder(this.toSlider);

    if (this.toInput) {
      this.toInput.value = value;
    }
    this.emitChange(this.toSlider);
  }

  // fixedRange: repositions the OTHER handle to keep the pair rangeSize apart, clamped to min/max.
  slideFixedRange(movedSlider) {
    const min = Number(this.fromSlider.min);
    const max = Number(this.fromSlider.max);
    const step = this.stepFor(movedSlider);
    const moved = this.resolveValue(movedSlider.value, step);

    const rawFrom = movedSlider === this.fromSlider ? moved : moved - this.rangeSize;
    const upperBound = Math.max(min, max - this.rangeSize);
    const from = Math.min(Math.max(rawFrom, min), upperBound);

    const fromValue = Ranger.roundToStep(from, step);
    const toValue = Ranger.roundToStep(from + this.rangeSize, step);

    this.fromSlider.value = fromValue;
    this.toSlider.value = toValue;
    this.fillSlider();
    this.updateHandleStackOrder(this.toSlider);

    if (this.fromInput) {
      this.fromInput.value = fromValue;
    }
    if (this.toInput) {
      this.toInput.value = toValue;
    }
    this.emitChange(movedSlider);
  }

  getParsed(currentFrom, currentTo) {
    return [this.resolveValue(currentFrom.value, this.stepFor(currentFrom)), this.resolveValue(currentTo.value, this.stepFor(currentTo))];
  }

  // Step to round to: activeStep while nudging, else this.step (native step is always "any").
  stepFor(slider) {
    return this.activeSlider === slider ? this.activeStep : this.step;
  }

  // Rounds to step, snaps onto the nearest snapPoint within snapThreshold, then clamps to [minValue, maxValue], in that order.
  resolveValue(rawValue, step) {
    let value = Ranger.roundToStep(rawValue, step);

    if (this.snapPoints.length) {
      const nearest = this.snapPoints.reduce((closest, point) => (
        Math.abs(point - value) < Math.abs(closest - value) ? point : closest
      ));
      const threshold = (Number(this.fromSlider.max) - Number(this.fromSlider.min)) * this.snapThreshold;

      if (Math.abs(nearest - value) <= threshold) {
        value = nearest;
      }
    }

    if (this.minValue !== null) {
      value = Math.max(value, this.minValue);
    }
    if (this.maxValue !== null) {
      value = Math.min(value, this.maxValue);
    }

    return value;
  }

  positionToValue(clientX) {
    const { left, width } = this.wrapper.getBoundingClientRect();
    const min = Number(this.fromSlider.min);
    const max = Number(this.fromSlider.max);
    const ratio = (clientX - left) / width;

    return min + (this.isRTL ? 1 - ratio : ratio) * (max - min);
  }

  resetSlider(slider, defaultValue) {
    slider.value = defaultValue;
    slider.dispatchEvent(new Event('input'));
  }

  // Arrow keys nudge by step (Shift = fineStep); handled here since native step is always "any".
  handleKeydown(event, slider) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
      return;
    }
    event.preventDefault();

    // Only Left/Right flip under RTL; Up/Down always mean increase/decrease.
    const isForward = event.key === 'ArrowUp'
      || (event.key === 'ArrowRight' && !this.isRTL)
      || (event.key === 'ArrowLeft' && this.isRTL);
    const direction = isForward ? 1 : -1;
    const nativeStep = Number(this.step) || 1;
    const step = event.shiftKey ? (this.fineStep ?? nativeStep / 10) : nativeStep;

    slider.value = this.resolveValue(Number(slider.value) + direction * step, step);

    // Marks slider as nudging so stepFor() re-rounds to this step, not this.step, below.
    this.activeSlider = slider;
    this.activeStep = step;
    slider.dispatchEvent(new Event('input'));
    this.activeSlider = null;
    this.activeStep = null;
  }

  // Track clicks jump the nearest handle; clicks on a handle itself never reach the wrapper.
  handleTrackClick(event) {
    if (event.target !== this.wrapper) {
      return;
    }

    const value = this.positionToValue(event.clientX);
    const target = this.isRange && Math.abs(value - this.toSlider.value) < Math.abs(value - this.fromSlider.value)
      ? this.toSlider
      : this.fromSlider;

    target.value = this.resolveValue(value, this.step);
    target.dispatchEvent(new Event('input'));
  }

  // Dragging the fill slides both handles together, keeping their distance fixed.
  handleFillDragStart(event) {
    if (this.disabled) {
      return;
    }
    event.preventDefault();

    const startX = event.clientX;
    const startFrom = Number(this.fromSlider.value);
    const startTo = Number(this.toSlider.value);
    const min = Number(this.fromSlider.min);
    const max = Number(this.fromSlider.max);
    const trackWidth = this.wrapper.getBoundingClientRect().width;

    this.fill.setPointerCapture(event.pointerId);
    this.onStart?.([startFrom, startTo], this.fill);

    const onMove = (moveEvent) => {
      const rawDelta = ((moveEvent.clientX - startX) / trackWidth) * (max - min);
      const delta = this.isRTL ? -rawDelta : rawDelta;
      const clampedDelta = Math.max(min - startFrom, Math.min(max - startTo, delta));

      this.fromSlider.value = Ranger.roundToStep(startFrom + clampedDelta, this.step);
      this.toSlider.value = Ranger.roundToStep(startTo + clampedDelta, this.step);
      this.fromSlider.dispatchEvent(new Event('input'));
      this.toSlider.dispatchEvent(new Event('input'));
    };

    const onUp = () => {
      this.fill.removeEventListener('pointermove', onMove);
      this.fill.removeEventListener('pointerup', onUp);
      this.fill.removeEventListener('pointercancel', onUp);
      this.onEnd?.([Number(this.fromSlider.value), Number(this.toSlider.value)], this.fill);
    };

    this.fill.addEventListener('pointermove', onMove);
    this.fill.addEventListener('pointerup', onUp);
    // Also clean up on pointercancel (e.g. touch reinterpreted as scroll), or listeners leak on this.fill.
    this.fill.addEventListener('pointercancel', onUp);
  }

  // Fill is a separate layer positioned by percentage, so it never draws over a handle.
  fillSlider() {
    const { fromSlider, toSlider, fill } = this;

    const min = Number(fromSlider.min);
    const max = Number(fromSlider.max);
    const percent = (value) => Math.round(((value - min) / (max - min)) * 1000) / 10;

    const fromPercent = toSlider ? percent(fromSlider.value) : 0;
    const toPercent = percent(toSlider ? toSlider.value : fromSlider.value);

    // Re-read every time so a live skin change is picked up on the very next value change.
    fill.style.backgroundColor = getComputedStyle(fromSlider).accentColor;
    fill.style.setProperty('--ranger-fill-gradient', this.fillGradient || 'none');
    // Logical (not left/right) so the fill mirrors correctly under RTL.
    fill.style.insetInlineStart = `${fromPercent}%`;
    fill.style.width = `${toPercent - fromPercent}%`;

    // Sized to the full track and offset by the fill's own start, so gradient colors stay pinned to absolute values.
    if (this.fillGradient) {
      const trackWidth = this.wrapper.getBoundingClientRect().width;
      const offset = (fromPercent / 100) * trackWidth;
      fill.style.backgroundSize = `${trackWidth}px 100%`;
      fill.style.backgroundPosition = this.isRTL ? `right -${offset}px top 0` : `left -${offset}px top 0`;
    } else {
      fill.style.backgroundSize = '';
      fill.style.backgroundPosition = '';
    }

    // Handles exactly overlapping would hide one behind the other (see .is-overlapping in CSS).
    if (toSlider) {
      this.wrapper.classList.toggle('is-overlapping', Number(fromSlider.value) === Number(toSlider.value));
    }

    this.updateAriaValueText(fromSlider);
    if (toSlider) {
      this.updateAriaValueText(toSlider);
    }
  }

  // Mirrors the formatted display value via aria-valuetext for assistive tech.
  updateAriaValueText(slider) {
    slider.setAttribute('aria-valuetext', this.formatDisplayValue(slider.value));
  }

  // Reorders scale/label/fill/marks in the DOM; handles stay on top via the static z-index on `.ranger > input` in core.scss.
  reorderLayers() {
    [this.scale, this.label, this.fill, this.marksContainer].forEach((layer) => {
      if (layer) {
        this.wrapper.appendChild(layer);
      }
    });

    this.updateHandleStackOrder(this.toSlider);
  }

  // Keeps the more-likely-to-grab handle on top via z-index, not a DOM move, which would cancel pointer capture mid-drag.
  updateHandleStackOrder(target) {
    if (!this.toSlider) {
      return;
    }

    const midpoint = (Number(this.fromSlider.min) + Number(this.fromSlider.max)) / 2;
    this.toSlider.style.zIndex = Number(target.value) <= midpoint ? 4 : 2;
  }

  // Formats a value the same way everywhere it's shown (label, aria-valuetext, ...).
  formatDisplayValue(value) {
    return this.format ? String(this.format(Number(value))) : `${this.labelPrefix}${value}${this.labelSuffix}`;
  }

  /** Builds the floating value label(s) above the handle(s). */
  createLabel() {
    const label = Ranger.createElement('div', this.classes.label);
    // Purely visual; hidden from AT (the value's already exposed via the handle).
    label.setAttribute('aria-hidden', 'true');
    // Set before calcPositions() below, which reads this.label to measure the container width.
    this.label = label;

    this.labelFrom = label.appendChild(Ranger.createElement('div', this.classes.labelItem));
    this.fromSlider.addEventListener('input', () => this.calcPositions());

    if (this.isRange) {
      this.labelTo = label.appendChild(Ranger.createElement('div', this.classes.labelItem));
      this.toSlider.addEventListener('input', () => this.calcPositions());
    }

    this.wrapper.appendChild(label);
    this.calcPositions();

    // Recalculates on resize since positions are computed in px, not left to CSS % to self-update.
    new ResizeObserver(() => this.calcPositions()).observe(this.wrapper);

    if (this.labelOnDragOnly) {
      this.bindDragVisibility();
    }

    return label;
  }

  // Fades the label out except while a handle is actively dragged/nudged (see .is-idle in CSS).
  bindDragVisibility() {
    this.label.classList.add('is-idle');

    const show = () => {
      this.label.classList.remove('is-idle');
      this.calcPositions();
    };
    const hide = () => {
      this.label.classList.add('is-idle');
    };

    [this.fromSlider, this.toSlider].filter(Boolean).forEach((slider) => {
      slider.addEventListener('pointerdown', show);
      slider.addEventListener('keydown', (event) => Ranger.NAVIGATION_KEYS.includes(event.key) && show());
      slider.addEventListener('keyup', (event) => Ranger.NAVIGATION_KEYS.includes(event.key) && hide());
    });

    document.addEventListener('pointerup', hide);
  }

  calcPositions() {
    // Guards the input/resize listeners createLabel() wires up, which outlive update() removing the label.
    if (!this.label) {
      return;
    }

    const { fromSlider, toSlider, labelFrom, labelTo, label } = this;
    const containerWidth = label.clientWidth;

    const setLabelStyle = (labelEl, value, percent) => {
      // innerHTML (not innerText) so a format()/prefix/suffix returning markup renders, not escapes.
      labelEl.innerHTML = this.formatDisplayValue(value);
      this.positionLabel(labelEl, percent, containerWidth);
    };

    const percentFrom = Ranger.calculatePercent(+fromSlider.min, +fromSlider.max, +fromSlider.value);
    setLabelStyle(labelFrom, fromSlider.value, percentFrom);

    if (!this.isRange) {
      return;
    }

    const percentTo = Ranger.calculatePercent(+toSlider.min, +toSlider.max, +toSlider.value);
    setLabelStyle(labelTo, toSlider.value, percentTo);

    // Gap between facing edges, measured direction-agnostically (works when RTL mirrors labelTo).
    const fromRect = labelFrom.getBoundingClientRect();
    const toRect = labelTo.getBoundingClientRect();
    const distanceX = Math.max(fromRect.left, toRect.left) - Math.min(fromRect.right, toRect.right);

    if (distanceX < 10) {
      labelFrom.innerHTML = fromSlider.value === toSlider.value
        ? this.formatDisplayValue(fromSlider.value)
        : `${this.formatDisplayValue(fromSlider.value)} – ${this.formatDisplayValue(toSlider.value)}`;

      this.positionLabel(labelFrom, percentFrom + (percentTo - percentFrom) / 2, containerWidth);
      labelTo.style.visibility = 'hidden';
    } else {
      labelTo.style.visibility = 'visible';
    }
  }

  // Centers the label on its handle by percent, even at 0/100, instead of clamping flush inside the track.
  positionLabel(labelEl, percent, containerWidth) {
    const centered = (percent / 100) * containerWidth - labelEl.offsetWidth / 2;
    labelEl.style.insetInlineStart = `${centered}px`;
  }

  /**
   * Builds the tick scale — major + minor ticks, each with a live --ranger-scale property to animate.
   */
  createScale() {
    const scale = Ranger.createElement('div', this.classes.scale);
    // Purely visual; hidden from AT (the value's already exposed via the handle).
    scale.setAttribute('aria-hidden', 'true');

    const minorStep = this.scaleMinorTicksCount + 1;
    const segments = this.scaleTicksCount * minorStep;

    this.scaleTicks = this.calcTicks(segments).map((value, index) => {
      const isMajor = index % minorStep === 0;
      const tick = Ranger.createElement('span', isMajor ? this.classes.scaleTick : this.classes.scaleMinorTick);
      let label = null;
      let isLimit = false;

      if (isMajor) {
        const step = Ranger.roundToStep(value, this.step || 1);
        // Flags the tick landing on minValue/maxValue, so it stays visible in arrangeScale() and can be styled apart.
        isLimit = step === this.minValue || step === this.maxValue;
        if (isLimit) {
          tick.classList.add(this.classes.scaleTickLimit);
        }

        const text = this.format
          ? this.format(step)
          : `${this.scaleTickPrefix}${step}${this.scaleTickSuffix}`;

        label = Ranger.createElement('ins', '', text);
        tick.appendChild(label);
      }

      scale.appendChild(tick);

      return { value, tick, label, isMajor, isLimit };
    });

    this.wrapper.appendChild(scale);
    this.updateScale();
    this.arrangeScale();

    this.fromSlider.addEventListener('input', () => this.updateScale());
    if (this.isRange) {
      this.toSlider.addEventListener('input', () => this.updateScale());
    }
    new ResizeObserver(() => this.arrangeScale()).observe(this.wrapper);

    return scale;
  }

  // Sets --ranger-scale per tick: a raised-cosine arc, 1 at the handle, easing to 0 by scaleAnimatedTicksCount away.
  updateScale() {
    const { fromSlider, toSlider, scaleTicks, scaleAnimatedTicksCount } = this;

    const min = Number(fromSlider.min);
    const max = Number(fromSlider.max);
    const tickSpacing = (max - min) / (scaleTicks.length - 1);
    const maxDistance = tickSpacing * scaleAnimatedTicksCount;
    const handleValues = toSlider ? [Number(fromSlider.value), Number(toSlider.value)] : [Number(fromSlider.value)];

    scaleTicks.forEach(({ value, tick }) => {
      const distance = Math.min(...handleValues.map((handleValue) => Math.abs(handleValue - value)));
      const scale = maxDistance > 0 && distance < maxDistance
        ? ((Math.cos((distance / maxDistance) * Math.PI) + 1) / 2) ** Ranger.ARC_SHARPNESS
        : 0;

      tick.style.setProperty('--ranger-scale', scale.toFixed(2));
    });
  }

  // Shows every Nth major tick (mark and label together) so 0/last stay visible and spacing stays uniform (N divides evenly).
  arrangeScale() {
    const majors = this.scaleTicks.filter((tick) => tick.isMajor);
    const lastIndex = majors.length - 1;
    if (lastIndex < 1) {
      return;
    }

    // Measured from the first/last tick's real position (accounts for RTL and the scale's own padding).
    const trackWidth = Math.abs(majors[lastIndex].tick.getBoundingClientRect().left - majors[0].tick.getBoundingClientRect().left);
    const maxLabelWidth = Math.max(...majors.map(({ label }) => label.offsetWidth));
    const minSkip = maxLabelWidth > 0 && trackWidth > 0 ? Math.ceil((maxLabelWidth * lastIndex) / trackWidth) : 1;
    const skip = Ranger.findSkip(lastIndex, Math.max(1, minSkip));

    majors.forEach(({ tick, isLimit }, index) => {
      // A minValue/maxValue tick stays visible regardless of skip — it marks where selection actually stops.
      tick.style.visibility = index % skip === 0 || isLimit ? 'visible' : 'hidden';
    });
  }

  /** Evenly spreads `segments + 1` values across the slider's min/max range. */
  calcTicks(segments) {
    const min = Number(this.fromSlider.min);
    const max = Number(this.fromSlider.max);

    return Array.from({ length: segments + 1 }, (_, index) => min + ((max - min) / segments) * index);
  }

  // Fixed points/zones along the track, positioned by percent — the same units the fill layer uses.
  createMarks() {
    const container = Ranger.createElement('div', this.classes.mark);
    container.setAttribute('aria-hidden', 'true');

    const min = Number(this.fromSlider.min);
    const max = Number(this.fromSlider.max);

    this.markEntries = this.marks.map((mark) => {
      const { value, from, to, label, className } = typeof mark === 'object' ? mark : { value: mark };
      const isZone = from !== undefined && to !== undefined;
      const baseClass = isZone ? this.classes.markRange : this.classes.markItem;
      const markEl = Ranger.createElement('span', [baseClass, className].filter(Boolean).join(' '));

      if (label) {
        markEl.appendChild(Ranger.createElement('ins', '', label));
      }
      container.appendChild(markEl);

      return isZone
        ? { markEl, fromPercent: Ranger.calculatePercent(min, max, from), toPercent: Ranger.calculatePercent(min, max, to) }
        : { markEl, fromPercent: Ranger.calculatePercent(min, max, value) };
    });

    this.wrapper.appendChild(container);
    this.positionMarks();

    return container;
  }

  // Converts each mark's stored percent(s) into its inline position/width.
  positionMarks() {
    if (!this.markEntries) {
      return;
    }

    this.markEntries.forEach(({ markEl, fromPercent, toPercent }) => {
      markEl.style.insetInlineStart = `${fromPercent}%`;

      if (toPercent !== undefined) {
        // A zone's own left edge is the `from` boundary, so it stays anchored there (no centering).
        markEl.style.width = `${toPercent - fromPercent}%`;
      } else {
        // Centers a point mark on its value (matching the thumb) using its own rendered width.
        markEl.style.marginInlineStart = `${-markEl.offsetWidth / 2}px`;
      }
    });
  }
}

document.addEventListener('youla:init', () => {

  /**
   * Turns a plain `<input type="range">` into a skinned Ranger; `data-points` adds a second handle for range mode.
   * The bound expression is passed through as Ranger's options object.
   *
   * @since 1.0
   */
  Youla.directive('ranger', (el, output) => {
    if (!(el instanceof HTMLInputElement) || el.type !== 'range') {
      console.warn('Youla.js: "v-ranger" requires an <input type="range">.');
      return;
    }

    const options = output && typeof output === 'object' ? output : {};

    if (el._x_ranger) {
      el._x_ranger.update(options);
      return;
    }

    el._x_ranger = new Ranger(el, options);

    // The cloned second handle inherits directive attributes (e.g. v-ref) from "el" — strip them to avoid collisions.
    if (el._x_ranger.toSlider) {
      [...el._x_ranger.toSlider.attributes]
        .map(({ name }) => name)
        .filter((name) => /^(v-|@|:)/.test(name))
        .forEach((name) => el._x_ranger.toSlider.removeAttribute(name));
    }
  });
});
