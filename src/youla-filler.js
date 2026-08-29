// Library-list swatches for the dropdown, sorted by name at render time.
const PALETTE = [
  { name: 'Black', hex: '#000000' },
  { name: 'Blue', hex: '#2196F3' },
  { name: 'Gray', hex: '#9E9E9E' },
  { name: 'Green', hex: '#4CAF50' },
  { name: 'Indigo', hex: '#3F51B5' },
  { name: 'Orange', hex: '#FF9800' },
  { name: 'Pink', hex: '#E91E63' },
  { name: 'Purple', hex: '#9C27B0' },
  { name: 'Red', hex: '#F44336' },
  { name: 'Teal', hex: '#009688' },
  { name: 'White', hex: '#FFFFFF' },
  { name: 'Yellow', hex: '#FFEB3B' },
];

class Filler {
  static DEFAULTS = {
    classes: {
      container: 'filler',
      swatch: 'filler-swatch',
      swatchColor: 'filler-swatch-color',
      swatchColorOpaque: 'filler-swatch-color-opaque',
      input: 'filler-input',
      alpha: 'filler-alpha',
      alphaInput: 'filler-alpha-input',
      suffix: 'filler-suffix',

      dropdown: 'filler-dropdown',
      paletteSection: 'filler-palette-section',
      paletteTitle: 'filler-palette-title',
      paletteRow: 'filler-palette-row',
      paletteSwatch: 'filler-palette-swatch',
      paletteChip: 'filler-palette-chip',
      paletteLabel: 'filler-palette-label',
      paletteHex: 'filler-palette-hex',
      paletteRemove: 'filler-palette-remove',
      paletteAdd: 'filler-palette-add',

      dialog: 'filler-dialog',
      dialogArea: 'filler-dialog-area',
      dialogAreaHandle: 'filler-dialog-area-handle',
      dialogHue: 'filler-dialog-hue',
      dialogAlpha: 'filler-dialog-alpha',
      dialogAlphaGradient: 'filler-dialog-alpha-gradient',
      dialogHandle: 'filler-dialog-handle',
      dialogTabs: 'filler-dialog-tabs',
      dialogTab: 'filler-dialog-tab',
      dialogCopy: 'filler-dialog-copy',
      dialogFields: 'filler-dialog-fields',
      dialogField: 'filler-dialog-field',
      dialogFieldLabel: 'filler-dialog-field-label',
    },
    // Dialog's color format ('hex'/'rgb'/'hsl'); the field next to the swatch always shows HEX regardless.
    format: 'hex',
    // Initial transparency (0-100); falls back to the input's own data-alpha attribute, then 100.
    alpha: null,
    // {name, hex}[] shown in the dropdown's library list, sorted by name.
    palette: PALETTE,
    // localStorage key the user's custom swatches are persisted under; set null to disable persistence.
    customPaletteKey: 'youla-filler-palette',
    disabled: false,
    // Text shown after the transparency value; dragging it left/right adjusts the value.
    suffixText: '%',
    // (hex, alpha) => void, fired whenever the color or transparency changes.
    onChange: null,

    // User-facing text, overridable for localization.
    labels: {
      customPaletteTitle: 'Свой набор',
      addCurrentColor: 'Добавить текущий цвет',
      libraryTitle: 'Библиотека',
      copyValue: 'Скопировать значение',
    },
  };

  static clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /** Builds an element and assigns own properties onto it in one step (className, type, textContent, ...). */
  static el(tag, props = {}) {
    return Object.assign(document.createElement(tag), props);
  }

  /** Normalizes "abc"/"#abc"/"aabbcc"/"#AABBCC" into "#AABBCC", or null if not a valid hex color. */
  static normalizeHex(hex) {
    if (typeof hex !== 'string') {
      return null;
    }

    let value = hex.trim().replace(/^#/, '');
    if (value.length === 3) {
      value = value.split('').map((c) => c + c).join('');
    }

    return /^[0-9a-f]{6}$/i.test(value) ? `#${value.toUpperCase()}` : null;
  }

  static hexToRgb(hex) {
    const normalized = Filler.normalizeHex(hex);
    if (!normalized) {
      return null;
    }

    const n = parseInt(normalized.slice(1), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  static rgbToHex({ r, g, b }) {
    return `#${[r, g, b].map((v) => Filler.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
  }

  // Parses any CSS color string via the browser's own parser (assign to style.color, read back computed).
  static parseCssColor(value) {
    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    const probe = Filler.el('span', { style: 'display: none' });
    probe.style.color = value.trim();
    if (!probe.style.color) {
      return null;
    }

    document.body.appendChild(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove();

    const match = computed.match(/^rgba?\(([^)]+)\)$/);
    if (!match) {
      return null;
    }

    const [r, g, b, a = 1] = match[1].split(',').map((n) => parseFloat(n));
    if ([r, g, b].some(Number.isNaN)) {
      return null;
    }

    return { r, g, b, a: Filler.clamp(a, 0, 1) * 100 };
  }

  /** True for white and near-white colors, where a same-color border would be invisible. */
  static isNearWhite({ r, g, b }) {
    return r >= 235 && g >= 235 && b >= 235;
  }

  // Strips non-digits and clamps to [min, max]; '' passes through so a field mid-clear isn't forced back.
  static sanitizeDigits(value, min, max) {
    const digits = value.replace(/[^0-9]/g, '');
    return digits === '' ? '' : String(Filler.clamp(+digits, min, max));
  }

  // Shared 60°-wide-sector mapping for hsvToRgb/hslToRgb: which channel gets c/x/0 depends only on hue.
  static hueToChannels(h, c, x) {
    return h < 60 ? [c, x, 0]
      : h < 120 ? [x, c, 0]
      : h < 180 ? [0, c, x]
      : h < 240 ? [0, x, c]
      : h < 300 ? [x, 0, c]
      : [c, 0, x];
  }

  // Shared hue extraction for rgbToHsv/rgbToHsl, given the already-computed max and max-min delta.
  static rgbToHue({ r, g, b }, max, d) {
    if (d === 0) {
      return 0;
    }

    const h = max === r ? 60 * (((g - b) / d) % 6)
      : max === g ? 60 * ((b - r) / d + 2)
      : 60 * ((r - g) / d + 4);

    return h < 0 ? h + 360 : h;
  }

  static rgbToHsv({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;

    const max = Math.max(r, g, b);
    const d = max - Math.min(r, g, b);

    return { h: Filler.rgbToHue({ r, g, b }, max, d), s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
  }

  static hsvToRgb({ h, s, v }) {
    s /= 100; v /= 100;

    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    const [r, g, b] = Filler.hueToChannels(h, c, x);

    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
  }

  static rgbToHsl({ r, g, b }) {
    r /= 255; g /= 255; b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const l = (max + min) / 2;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));

    return { h: Filler.rgbToHue({ r, g, b }, max, d), s: s * 100, l: l * 100 };
  }

  static hslToRgb({ h, s, l }) {
    s /= 100; l /= 100;

    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = Filler.hueToChannels(h, c, x);

    return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 };
  }

  // Below-anchor, left-aligned, flipped above when there isn't room, clamped inside the viewport.
  static computePosition(anchorRect, size, viewport, offset = 6) {
    let top = anchorRect.bottom + offset;
    if (top + size.height > viewport.height && anchorRect.top - size.height - offset >= 0) {
      top = anchorRect.top - size.height - offset;
    }

    const left = Filler.clamp(anchorRect.left, 4, Math.max(viewport.width - size.width - 4, 4));

    return { top, left };
  }

  /** @param {string|HTMLInputElement} target @param {object} [options] */
  constructor(target, options = {}) {
    const el = this.el = typeof target === 'string' ? document.querySelector(target) : target;

    if (!(el instanceof HTMLInputElement)) {
      throw new Error(`Filler: no input element found for "${target}"`);
    }

    Object.assign(this, Filler.DEFAULTS, options, {
      classes: { ...Filler.DEFAULTS.classes, ...options.classes },
      labels: { ...Filler.DEFAULTS.labels, ...options.labels },
      palette: options.palette ? [...options.palette] : [...Filler.DEFAULTS.palette],
    });

    this.disabled = options.disabled ?? el.disabled;

    const initialHex = Filler.normalizeHex(el.value) || '#000000';
    const initialAlpha = Filler.clamp(options.alpha ?? parseFloat(el.dataset.alpha ?? '100'), 0, 100);
    this.hsva = { ...Filler.rgbToHsv(Filler.hexToRgb(initialHex)), a: initialAlpha };

    this.customPalette = this.loadCustomPalette();
    this.dropdownOpen = false;
    this.dialogOpen = false;

    this.initialize();
  }

  get hex() {
    return Filler.rgbToHex(Filler.hsvToRgb(this.hsva));
  }

  initialize() {
    const { el, classes } = this;
    el.classList.add(classes.input);
    Object.assign(el, { type: 'text', autocomplete: 'off', spellcheck: false, maxLength: 7 });

    const wrapper = this.wrapper = Filler.el('div', { className: classes.container });
    el.parentNode.insertBefore(wrapper, el);

    const swatchColor = this.swatchColor = Filler.el('span', { className: classes.swatchColor });
    // Painted over swatchColor via DOM order (no z-index needed); shown only while there's transparency.
    const swatchColorOpaque = this.swatchColorOpaque = Filler.el('span', { className: classes.swatchColorOpaque });
    const swatch = this.swatch = Filler.el('button', { type: 'button', className: classes.swatch });
    swatch.append(swatchColor, swatchColorOpaque);

    const alphaInput = this.alphaInput = Filler.el('input', {
      type: 'text', inputMode: 'numeric', maxLength: 3, className: classes.alphaInput,
    });
    const suffix = this.suffix = Filler.el('span', { className: classes.suffix, textContent: this.suffixText });
    // Not a native range input, so nothing else marks it as draggable — spell it out for a mouse user.
    Object.assign(suffix.style, { cursor: 'ew-resize', touchAction: 'none' });
    const alphaWrapper = this.alphaWrapper = Filler.el('label', { className: classes.alpha });
    alphaWrapper.append(alphaInput, suffix);

    wrapper.append(swatch, el, alphaWrapper);

    if (this.disabled) {
      [el, alphaInput, swatch].forEach((e) => { e.disabled = true; });
      wrapper.classList.add('is-disabled');
    }

    this.addListeners();
    this.render();
  }

  addListeners() {
    const { el, alphaInput } = this;
    el.addEventListener('focus', () => this.openDropdown());
    el.addEventListener('input', () => this.handleHexInput());
    el.addEventListener('blur', () => { el.value = this.hex; });
    el.addEventListener('paste', (event) => this.handleHexPaste(event));

    alphaInput.addEventListener('input', () => {
      const value = Filler.sanitizeDigits(alphaInput.value, 0, 100);
      if (value !== alphaInput.value) {
        alphaInput.value = value;
      }
      if (value !== '') {
        this.setAlpha(+value);
      }
    });
    alphaInput.addEventListener('blur', () => { alphaInput.value = Math.round(this.hsva.a); });

    this.bindAlphaSuffixDrag();

    this.swatch.addEventListener('click', () => this.toggleDialog());
  }

  // Dragging the "%" suffix left/right nudges transparency, mirroring Ranger's pointer-capture drags.
  bindAlphaSuffixDrag() {
    const { suffix } = this;
    suffix.addEventListener('pointerdown', (event) => {
      if (this.disabled) {
        return;
      }
      event.preventDefault();

      // Tracked from the last position (not drag start), so reversing after clamping resumes immediately.
      let lastX = event.clientX;
      suffix.setPointerCapture(event.pointerId);

      const onMove = (moveEvent) => {
        this.setAlpha(this.hsva.a + (moveEvent.clientX - lastX) / 2);
        lastX = moveEvent.clientX;
      };
      const onUp = () => {
        suffix.removeEventListener('pointermove', onMove);
        suffix.removeEventListener('pointerup', onUp);
      };

      suffix.addEventListener('pointermove', onMove);
      suffix.addEventListener('pointerup', onUp);
    });
  }

  // Applies once the typed text is a complete hex color (3-digit shorthand included); normalized on blur.
  handleHexInput() {
    const rgb = Filler.hexToRgb(this.el.value);
    if (!rgb) {
      return;
    }

    this.hsva = { ...Filler.rgbToHsv(rgb), a: this.hsva.a };
    this.render({ skipHexInput: true });
  }

  // Applies any recognizable pasted color (alpha included); anything else falls through to a normal paste.
  handleHexPaste(event) {
    const color = Filler.parseCssColor(event.clipboardData?.getData('text'));
    if (!color) {
      return;
    }

    event.preventDefault();
    this.hsva = { ...Filler.rgbToHsv(color), a: color.a };
    this.render();
  }

  setAlpha(value) {
    this.hsva.a = Filler.clamp(value, 0, 100);
    this.render();
  }

  applyHex(hex) {
    const rgb = Filler.hexToRgb(hex);
    if (!rgb) {
      return;
    }

    this.hsva = { ...Filler.rgbToHsv(rgb), a: this.hsva.a };
    this.render();
    this.closeDropdown();
  }

  toggleDialog() {
    if (this.disabled) {
      return;
    }
    this.dialogOpen ? this.closeDialog() : this.openDialog();
  }

  // Repaints everything derived from `hsva`; `skipHexInput` avoids clobbering the caret while typing.
  render({ skipHexInput = false } = {}) {
    const { el, hsva, alphaInput, swatch, swatchColor, swatchColorOpaque } = this;
    const hex = this.hex;
    if (!skipHexInput) {
      el.value = hex;
    }

    const alphaRounded = Math.round(hsva.a);
    if (document.activeElement !== alphaInput) {
      alphaInput.value = alphaRounded;
    }

    const rgb = Filler.hsvToRgb(hsva);
    const rgbTriplet = `${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}`;
    const hasAlpha = hsva.a < 100;

    // Split while transparent: left shows the opaque color, right the actual one over the checkerboard.
    swatchColor.style.backgroundColor = `rgba(${rgbTriplet}, ${hsva.a / 100})`;
    swatchColorOpaque.style.backgroundColor = `rgb(${rgbTriplet})`;
    swatch.classList.toggle('has-alpha', hasAlpha);

    // No border except for white/near-white, which would otherwise blend into the page.
    swatch.style.border = Filler.isNearWhite(rgb) ? '1px solid #dfe2e3' : 'none';

    if (this.dialogOpen) {
      this.renderDialog();
    }

    this.onChange?.(hex, alphaRounded);
    // "change", not "input" — firing "input" here would recurse into handleHexInput.
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Current color as a string in the dialog's active format, for the copy-to-clipboard button.
  getFormattedValue() {
    const { a } = this.hsva;
    const rgb = Filler.hsvToRgb(this.hsva);
    const r = Math.round(rgb.r);
    const g = Math.round(rgb.g);
    const b = Math.round(rgb.b);
    const opaque = a >= 100;
    const alpha = Math.round((a / 100) * 100) / 100;

    if (this.format === 'rgb') {
      return opaque ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    if (this.format === 'hsl') {
      const hsl = Filler.rgbToHsl(rgb);
      const h = Math.round(hsl.h);
      const s = Math.round(hsl.s);
      const l = Math.round(hsl.l);
      return opaque ? `hsl(${h}, ${s}%, ${l}%)` : `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
    }

    if (opaque) {
      return this.hex;
    }
    return this.hex + Math.round((a / 100) * 255).toString(16).padStart(2, '0').toUpperCase();
  }

  copyValue(button) {
    navigator.clipboard.writeText(this.getFormattedValue()).then(() => {
      button.classList.add('is-copied');
      clearTimeout(this.copyResetTimer);
      this.copyResetTimer = setTimeout(() => button.classList.remove('is-copied'), 1200);
    });
  }

  // Anchors `panel` to `this.wrapper` (not whatever was clicked), width clamped to [200, 280]; returns a teardown.
  attachFloating(panel, onClose) {
    const { wrapper } = this;
    document.body.appendChild(panel);

    // Hidden while sized/positioned so nothing flashes unstyled first.
    panel.style.visibility = 'hidden';

    const fieldWidth = wrapper.getBoundingClientRect().width;
    panel.style.width = `${Filler.clamp(fieldWidth, 200, 280)}px`;

    const reposition = () => {
      const anchorRect = wrapper.getBoundingClientRect();
      const size = { width: panel.offsetWidth, height: panel.offsetHeight };
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const { top, left } = Filler.computePosition(anchorRect, size, viewport);

      panel.style.top = `${top}px`;
      panel.style.left = `${left}px`;
    };

    reposition();
    panel.style.visibility = 'visible';

    const onDocClick = (event) => {
      if (wrapper.contains(event.target) || panel.contains(event.target)) {
        return;
      }
      onClose();
    };
    const onKeydown = (event) => event.key === 'Escape' && onClose();

    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    return () => {
      document.removeEventListener('click', onDocClick, true);
      document.removeEventListener('keydown', onKeydown);
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
      panel.remove();
    };
  }

  openDropdown() {
    if (this.disabled || this.dropdownOpen) {
      return;
    }
    this.closeDialog();

    if (!this.dropdownBody) {
      this.dropdownBody = Filler.el('div', { className: this.classes.dropdown });
    }
    this.renderDropdown();

    this.dropdownOpen = true;
    this.wrapper.classList.add('is-open');
    this.detachDropdown = this.attachFloating(this.dropdownBody, () => this.closeDropdown());
  }

  closeDropdown() {
    if (!this.dropdownOpen) {
      return;
    }
    this.dropdownOpen = false;
    this.wrapper.classList.remove('is-open');
    this.detachDropdown?.();
    this.detachDropdown = null;
  }

  renderDropdown() {
    const { classes, labels } = this;
    const dropdown = this.dropdownBody;
    dropdown.innerHTML = '';

    const section = (title, row) => {
      const box = Filler.el('div', { className: classes.paletteSection });
      box.append(Filler.el('div', { className: classes.paletteTitle, textContent: title }), row);
      return box;
    };

    const customRow = Filler.el('div', { className: classes.paletteRow });
    this.customPalette.forEach((hex) => customRow.appendChild(this.createPaletteItem(hex, hex, true)));

    const addChip = Filler.el('span', { className: classes.paletteChip, textContent: '+' });
    const addLabel = Filler.el('span', { className: classes.paletteLabel, textContent: labels.addCurrentColor });
    const addButton = Filler.el('button', { type: 'button', className: classes.paletteAdd });
    addButton.append(addChip, addLabel);
    addButton.addEventListener('click', (event) => {
      event.stopPropagation();
      this.addCustomColor(this.hex);
    });
    customRow.appendChild(addButton);

    const paletteRow = Filler.el('div', { className: classes.paletteRow });
    [...this.palette]
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach(({ name, hex }) => paletteRow.appendChild(this.createPaletteItem(hex, name, false)));

    dropdown.append(section(labels.customPaletteTitle, customRow), section(labels.libraryTitle, paletteRow));
  }

  // A palette row: color chip + name + hex (custom entries just repeat hex as both label and value).
  createPaletteItem(hex, label, removable) {
    const { classes } = this;
    const item = Filler.el('button', { type: 'button', className: classes.paletteSwatch, title: label });
    const chip = Filler.el('span', { className: classes.paletteChip });
    chip.style.backgroundColor = hex;
    item.append(chip, Filler.el('span', { className: classes.paletteLabel, textContent: label }));

    // Library entries get their hex shown alongside the name; custom entries already use it as the label.
    if (!removable) {
      item.appendChild(Filler.el('span', { className: classes.paletteHex, textContent: hex }));
    }

    item.addEventListener('click', () => this.applyHex(hex));

    if (removable) {
      const remove = Filler.el('span', { className: classes.paletteRemove, textContent: '×' });
      remove.addEventListener('click', (event) => {
        event.stopPropagation();
        this.removeCustomColor(hex);
      });
      item.appendChild(remove);
    }

    return item;
  }

  addCustomColor(hex) {
    const normalized = Filler.normalizeHex(hex);
    if (!normalized || this.customPalette.includes(normalized)) {
      return;
    }

    this.customPalette = [normalized, ...this.customPalette].slice(0, 24);
    this.persistCustomPalette();
    this.renderDropdown();
  }

  removeCustomColor(hex) {
    this.customPalette = this.customPalette.filter((c) => c !== hex);
    this.persistCustomPalette();
    this.renderDropdown();
  }

  loadCustomPalette() {
    if (!this.customPaletteKey) {
      return [];
    }
    try {
      const stored = JSON.parse(localStorage.getItem(this.customPaletteKey) || '[]');
      return Array.isArray(stored) ? stored.filter((hex) => Filler.normalizeHex(hex)) : [];
    } catch {
      return [];
    }
  }

  persistCustomPalette() {
    if (!this.customPaletteKey) {
      return;
    }
    try {
      localStorage.setItem(this.customPaletteKey, JSON.stringify(this.customPalette));
    } catch {
      // Storage unavailable (private mode, quota) — the custom palette just won't persist.
    }
  }

  openDialog() {
    if (this.disabled || this.dialogOpen) {
      return;
    }
    this.closeDropdown();

    if (!this.dialog) {
      this.buildDialog();
    }
    this.renderDialogFields();
    this.syncDialogTabs();
    this.renderDialog();

    this.dialogOpen = true;
    this.wrapper.classList.add('is-open');
    this.detachDialog = this.attachFloating(this.dialog, () => this.closeDialog());
  }

  closeDialog() {
    if (!this.dialogOpen) {
      return;
    }
    this.dialogOpen = false;
    this.wrapper.classList.remove('is-open');
    this.detachDialog?.();
    this.detachDialog = null;
  }

  buildDialog() {
    const { classes } = this;
    const area = Filler.el('div', { className: classes.dialogArea });
    const areaHandle = Filler.el('div', { className: classes.dialogAreaHandle });
    area.appendChild(areaHandle);
    this.bindAreaDrag(area);

    const hue = Filler.el('div', { className: classes.dialogHue });
    const hueHandle = Filler.el('div', { className: classes.dialogHandle });
    hue.appendChild(hueHandle);
    this.bindTrackDrag(hue, (ratio) => { this.hsva.h = ratio * 360; this.render(); });

    const alpha = Filler.el('div', { className: classes.dialogAlpha });
    const alphaGradient = Filler.el('div', { className: classes.dialogAlphaGradient });
    const alphaHandle = Filler.el('div', { className: classes.dialogHandle });
    alpha.append(alphaGradient, alphaHandle);
    this.bindTrackDrag(alpha, (ratio) => this.setAlpha(ratio * 100));

    const tabs = Filler.el('div', { className: classes.dialogTabs });
    ['hex', 'rgb', 'hsl'].forEach((format) => {
      const tab = Filler.el('button', {
        type: 'button', className: classes.dialogTab, textContent: format.toUpperCase(),
      });
      tab.dataset.format = format;
      tab.addEventListener('click', () => {
        this.format = format;
        this.renderDialogFields();
        this.syncDialogTabs();
      });
      tabs.appendChild(tab);
    });

    const copyButton = Filler.el('button', {
      type: 'button', className: classes.dialogCopy, title: this.labels.copyValue, textContent: '⧉',
    });
    copyButton.addEventListener('click', () => this.copyValue(copyButton));
    tabs.appendChild(copyButton);

    const fields = Filler.el('div', { className: classes.dialogFields });

    const dialog = this.dialog = Filler.el('div', { className: classes.dialog });
    dialog.append(area, hue, alpha, tabs, fields);

    Object.assign(this, {
      dialogArea: area,
      dialogAreaHandle: areaHandle,
      dialogHue: hue,
      dialogHueHandle: hueHandle,
      dialogAlpha: alpha,
      dialogAlphaGradient: alphaGradient,
      dialogAlphaHandle: alphaHandle,
      dialogTabs: tabs,
      dialogFields: fields,
      dialogFieldInputs: [],
    });
  }

  // Shared drag handling for the 1D hue/alpha tracks: reports the pointer's 0-1 ratio along the track.
  bindTrackDrag(track, onRatio) {
    const update = (event) => {
      const rect = track.getBoundingClientRect();
      onRatio(Filler.clamp((event.clientX - rect.left) / rect.width, 0, 1));
    };

    track.addEventListener('pointerdown', (event) => {
      if (this.disabled) {
        return;
      }
      event.preventDefault();
      track.setPointerCapture(event.pointerId);
      update(event);

      const onMove = (moveEvent) => update(moveEvent);
      const onUp = () => {
        track.removeEventListener('pointermove', onMove);
        track.removeEventListener('pointerup', onUp);
      };

      track.addEventListener('pointermove', onMove);
      track.addEventListener('pointerup', onUp);
    });
  }

  bindAreaDrag(area) {
    const update = (event) => {
      const rect = area.getBoundingClientRect();
      const x = Filler.clamp(event.clientX - rect.left, 0, rect.width);
      const y = Filler.clamp(event.clientY - rect.top, 0, rect.height);

      this.hsva.s = (x / rect.width) * 100;
      this.hsva.v = 100 - (y / rect.height) * 100;
      this.render();
    };

    area.addEventListener('pointerdown', (event) => {
      if (this.disabled) {
        return;
      }
      event.preventDefault();
      area.setPointerCapture(event.pointerId);
      update(event);

      const onMove = (moveEvent) => update(moveEvent);
      const onUp = () => {
        area.removeEventListener('pointermove', onMove);
        area.removeEventListener('pointerup', onUp);
      };

      area.addEventListener('pointermove', onMove);
      area.addEventListener('pointerup', onUp);
    });
  }

  syncDialogTabs() {
    [...this.dialogTabs.children].forEach((tab) => {
      if (tab === undefined || !tab.dataset) {
        return;
      }
      tab.classList.toggle('is-active', tab.dataset.format === this.format);
    });
  }

  // Rebuilds the field row from scratch; only on open/format-switch, not every drag tick (would steal focus).
  renderDialogFields() {
    const fields = this.dialogFields;
    fields.innerHTML = '';
    this.dialogFieldInputs = [];

    // `isHex` swaps digit-filtering for hex-filtering and skips the numeric clamp (partial hex isn't "out of range").
    const addField = (label, { min = 0, max, isHex = false } = {}, onInput) => {
      const input = Filler.el('input', {
        type: 'text', inputMode: isHex ? 'text' : 'numeric', maxLength: isHex ? 6 : String(max).length,
      });
      input.addEventListener('input', () => {
        const value = isHex
          ? input.value.replace(/[^0-9a-fA-F]/g, '')
          : Filler.sanitizeDigits(input.value, min, max);

        if (value !== input.value) {
          input.value = value;
        }
        onInput(value);
      });
      // Selected on focus so typing a new value overwrites the old one outright.
      input.addEventListener('focus', () => input.select());

      const wrap = Filler.el('label', { className: this.classes.dialogField });
      wrap.append(input, Filler.el('span', { className: this.classes.dialogFieldLabel, textContent: label }));
      fields.appendChild(wrap);
      this.dialogFieldInputs.push(input);
    };

    if (this.format === 'rgb') {
      const withRgb = (patch) => {
        const rgb = { ...Filler.hsvToRgb(this.hsva), ...patch };
        this.hsva = { ...Filler.rgbToHsv(rgb), a: this.hsva.a };
        this.render();
      };
      addField('R', { max: 255 }, (v) => withRgb({ r: Filler.clamp(+v || 0, 0, 255) }));
      addField('G', { max: 255 }, (v) => withRgb({ g: Filler.clamp(+v || 0, 0, 255) }));
      addField('B', { max: 255 }, (v) => withRgb({ b: Filler.clamp(+v || 0, 0, 255) }));
    } else if (this.format === 'hsl') {
      const withHsl = (patch) => {
        const hsl = { ...Filler.rgbToHsl(Filler.hsvToRgb(this.hsva)), ...patch };
        this.hsva = { ...Filler.rgbToHsv(Filler.hslToRgb(hsl)), a: this.hsva.a };
        this.render();
      };
      addField('H', { max: 360 }, (v) => withHsl({ h: Filler.clamp(+v || 0, 0, 360) }));
      addField('S', { max: 100 }, (v) => withHsl({ s: Filler.clamp(+v || 0, 0, 100) }));
      addField('L', { max: 100 }, (v) => withHsl({ l: Filler.clamp(+v || 0, 0, 100) }));
    } else {
      addField('HEX', { isHex: true }, (v) => {
        const rgb = Filler.hexToRgb(`#${v}`);
        if (rgb) {
          this.hsva = { ...Filler.rgbToHsv(rgb), a: this.hsva.a };
          this.render();
        }
      });
    }

    addField('A', { max: 100 }, (v) => this.setAlpha(Filler.clamp(+v || 0, 0, 100)));
    this.updateDialogFieldValues();
  }

  // Cheap per-render sync of the field values, skipping whichever one the user is actively editing.
  updateDialogFieldValues() {
    const { format, dialogFieldInputs } = this;
    if (!dialogFieldInputs.length) {
      return;
    }

    const { a } = this.hsva;
    const rgb = Filler.hsvToRgb(this.hsva);

    let values;
    if (format === 'rgb') {
      values = [rgb.r, rgb.g, rgb.b, a].map(Math.round);
    } else if (format === 'hsl') {
      const hsl = Filler.rgbToHsl(rgb);
      values = [hsl.h, hsl.s, hsl.l, a].map(Math.round);
    } else {
      values = [this.hex.slice(1), Math.round(a)];
    }

    dialogFieldInputs.forEach((input, index) => {
      if (document.activeElement !== input) {
        input.value = values[index];
      }
    });
  }

  renderDialog() {
    const { h, s, v, a } = this.hsva;
    const { dialogAreaHandle } = this;

    const hueRgb = Filler.hsvToRgb({ h, s: 100, v: 100 });
    this.dialogArea.style.backgroundColor = `rgb(${Math.round(hueRgb.r)}, ${Math.round(hueRgb.g)}, ${Math.round(hueRgb.b)})`;
    dialogAreaHandle.style.left = `${s}%`;
    dialogAreaHandle.style.top = `${100 - v}%`;

    this.dialogHueHandle.style.left = `${(h / 360) * 100}%`;

    const rgb = Filler.hsvToRgb({ h, s, v });
    const rgbTriplet = `${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}`;
    this.dialogAlphaGradient.style.backgroundImage = `linear-gradient(to right, rgba(${rgbTriplet}, 0), rgba(${rgbTriplet}, 1))`;
    this.dialogAlphaHandle.style.left = `${a}%`;

    this.updateDialogFieldValues();
  }

  // Applies an options patch after mount, following the same el._x_filler-cached-instance pattern
  update(options = {}) {
    const paletteChanged = 'palette' in options;

    Object.assign(this, options, {
      classes: options.classes ? { ...this.classes, ...options.classes } : this.classes,
      labels: options.labels ? { ...this.labels, ...options.labels } : this.labels,
      palette: options.palette ? [...options.palette] : this.palette,
    });

    if ('disabled' in options) {
      const { disabled, el, alphaInput, swatch, wrapper } = this;
      el.disabled = alphaInput.disabled = swatch.disabled = disabled;
      wrapper.classList.toggle('is-disabled', disabled);

      if (disabled) {
        this.closeDropdown();
        this.closeDialog();
      }
    }

    if (paletteChanged && this.dropdownOpen) {
      this.renderDropdown();
    }
  }
}

document.addEventListener('youla:init', ()=> {

  /**
   * Turns a plain `<input type="text">` into a Figma-style fill/color field: a swatch, a HEX input,
   * and a transparency field (drag the "%" to adjust). Clicking the HEX input opens a dropdown to
   * type a HEX value or pick from a named/custom palette (each entry lists its color and name
   * together); clicking the swatch opens a full HSV + alpha dialog with a copy-to-clipboard button
   * for whichever format (HEX/RGB/HSL) is active. The main input always displays HEX.
   *
   * @since 1.0
   */
  Youla.directive('filler', (el, output) => {
    if (!(el instanceof HTMLInputElement)) {
      console.warn('Youla.js: "v-filler" requires an <input>.');
      return;
    }

    const options = output && typeof output === 'object' ? output : {};

    if (el._x_filler) {
      el._x_filler.update(options);
      return;
    }

    el._x_filler = new Filler(el, options);
  });
});
