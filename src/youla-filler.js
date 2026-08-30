// Injected into the panels' shadow root, never the global stylesheet (see createShadowPanel).
import PANEL_CSS from './styles/filler-panel.scss?inline';

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

// Expands `{ key: suffix }` into `{ key: prefix-suffix }`; an empty suffix maps to the bare prefix.
const classNames = (prefix, suffixes) => Object.fromEntries(
  Object.entries(suffixes).map(([key, suffix]) => [key, suffix ? `${prefix}-${suffix}` : prefix]),
);

class Filler {
  static DEFAULTS = {
    classes: {
      ...classNames('filler', {
        container: '',
        input: 'input',
        alpha: 'alpha',
        alphaInput: 'alpha-input',
        alphaSuffix: 'alpha-suffix',
        swatch: 'swatch',
        swatchColor: 'swatch-color',
        swatchColorOpaque: 'swatch-color-opaque',
        dropdown: 'dropdown',
      }),

      ...classNames('filler-palette', {
        paletteSection: 'section',
        paletteTitle: 'title',
        paletteRow: 'row',
        paletteSwatch: 'swatch',
        paletteChip: 'chip',
        paletteLabel: 'label',
        paletteHex: 'hex',
        paletteRemove: 'remove',
        paletteAdd: 'add',
      }),

      ...classNames('filler-dialog', {
        dialog: '',
        dialogArea: 'area',
        dialogAreaHandle: 'area-handle',
        dialogHue: 'hue',
        dialogAlpha: 'alpha',
        dialogAlphaGradient: 'alpha-gradient',
        dialogHandle: 'handle',
        dialogTabs: 'tabs',
        dialogTab: 'tab',
        dialogEyedropper: 'eyedropper',
        dialogCopy: 'copy',
        dialogFields: 'fields',
        dialogField: 'field',
        dialogFieldLabel: 'field-label',
        dialogSources: 'sources',
        dialogSource: 'source',
        dialogSolid: 'solid',
      }),

      ...classNames('filler-dialog-image', {
        dialogImage: '',
        dialogImageToolbar: 'toolbar',
        dialogImageFit: 'fit',
        dialogImageRotate: 'rotate',
        dialogImageUpload: 'upload',
        dialogImageUploadInput: 'upload-input',
        dialogImagePreview: 'preview',
        dialogImagePreviewImg: 'preview-img',
        dialogImagePlaceholder: 'placeholder',
        dialogImageRemove: 'remove',
        dialogImageReset: 'reset',
        dialogImageSlidersTitle: 'sliders-title',
        dialogImageSliders: 'sliders',
        dialogImageSlider: 'slider',
        dialogImageSliderHead: 'slider-head',
        dialogImageSliderLabel: 'slider-label',
        dialogImageSliderValue: 'slider-value',
        dialogImageSliderInput: 'slider-input',
      }),
    },
    // Dialog format ('hex'/'rgb'/'hsl'); the field next to the swatch always shows HEX.
    format: 'hex',
    // Initial transparency (0-100); falls back to data-alpha, then 100.
    alpha: null,
    // {name, hex}[] for the dropdown's library list, sorted by name.
    palette: PALETTE,
    // Source-type buttons to show — 'solid' and/or 'image'; a single entry locks the dialog to it.
    sources: ['solid', 'image'],
    // localStorage key for the custom palette; null disables persistence.
    customPaletteKey: 'youla-filler-palette',
    disabled: false,
    // Shown after the transparency value; drag it left/right to adjust.
    suffixText: '%',
    // (hex, alpha) => void, fired on any color/transparency change.
    onChange: null,

    // User-facing text, overridable for localization.
    labels: {
      customPaletteTitle: 'Свой набор',
      addCurrentColor: 'Добавить текущий цвет',
      libraryTitle: 'Библиотека',
      copyValue: 'Скопировать значение',
      pickColor: 'Пипетка с экрана',
      eyedropper: 'Alt+клик — пипетка с экрана',

      solidSource: 'Заливка',
      imageSource: 'Изображение',
      uploadImage: 'Выбрать изображение',
      removeImage: 'Удалить изображение',
      rotateImage: 'Повернуть на 90°',
      adjustments: 'Коррекция',
      resetAdjustments: 'Сбросить',
      objectFit: {
        cover: 'Заполнение',
        contain: 'Вписать',
        fill: 'Растянуть',
        none: 'Без изменений',
        'scale-down': 'Уменьшение',
      },
      // Slider labels, one per Filler.IMAGE_FILTERS key.
      filters: {
        brightness: 'Яркость',
        contrast: 'Контраст',
        saturate: 'Насыщенность',
        grayscale: 'Оттенки серого',
        sepia: 'Сепия',
        hueRotate: 'Поворот тона',
        invert: 'Инверсия',
        blur: 'Размытие',
      },
    },
  };

  // Source-type button icons (Phosphor "image" / "paint-brush-broad"), keyed like `sources`.
  static SOURCE_ICONS = {
    solid: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path d="M234.53 139.07a8 8 0 0 0 3.13-13.24L122.17 10.34a8 8 0 0 0-11.31 0L70.25 51l-24.6-24.66a8 8 0 0 0-11.31 11.32l24.6 24.6L15 106.17a24 24 0 0 0 0 33.94L99.89 225a24 24 0 0 0 33.94 0l78.49-78.49Zm-32.19-5.24-79.83 79.83a8 8 0 0 1-11.31 0L26.34 128.8a8 8 0 0 1 0-11.31l43.91-43.92 29.12 29.12a28 28 0 1 0 11.31-11.32L81.57 62.26l35-34.95L217.19 128l-11.72 3.9a8 8 0 0 0-3.13 1.93m-86.83-26.31a13.26 13.26 0 1 1-.05.06s.05-.05.05-.06m123.15 56a8 8 0 0 0-13.32 0C223.57 166.23 208 190.09 208 208a24 24 0 0 0 48 0c0-17.91-15.57-41.77-17.34-44.44ZM232 216a8 8 0 0 1-8-8c0-6.8 4-16.32 8-24.08 4 7.76 8 17.34 8 24.08a8 8 0 0 1-8 8"/></svg>',
    image: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 256 256"><path d="M208 32H48a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16M48 48h160v77l-25-24a16 16 0 0 0-22 0L53 208h-5Zm160 160H76l96-96 36 36zM96 120a24 24 0 1 0-24-24 24 24 0 0 0 24 24m0-32a8 8 0 1 1-8 8 8 8 0 0 1 8 8"/></svg>',
  };

  // Eyedropper icon (Material "colorize"), for the dialog's pick-from-screen button.
  static EYEDROPPER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"><path d="M20.71 5.63l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-3.12 3.12-1.93-1.91-1.41 1.41 1.42 1.42L3 16.25V21h4.75l8.92-8.92 1.42 1.42 1.41-1.41-1.93-1.93 3.12-3.12c.4-.39.4-1.02.02-1.41zM6.92 19H5v-1.92l8.06-8.06 1.92 1.92L6.92 19z"/></svg>';

  /* Panel width clamp (see attachFloating) — also the "enough room" threshold `availableSpace`
     uses to prefer placing the panel beside the field over stacking it. */
  static PANEL_MIN_WIDTH = 200;
  static PANEL_MAX_WIDTH = 280;

  /* One slider per CSS filter function; ranges follow the spec — grayscale/sepia/invert/blur run
     0-100(px) from their floor/neutral value, brightness/contrast/saturate center on their 100%
     neutral (capped at an arbitrary 200), and hue-rotate alone is signed, centered on 0 (-180..180). */
  static IMAGE_FILTERS = [
    { key: 'brightness', css: 'brightness', min: 0, max: 200, default: 100, step: 1, unit: '%' },
    { key: 'contrast', css: 'contrast', min: 0, max: 200, default: 100, step: 1, unit: '%' },
    { key: 'saturate', css: 'saturate', min: 0, max: 200, default: 100, step: 1, unit: '%' },
    { key: 'hueRotate', css: 'hue-rotate', min: -180, max: 180, default: 0, step: 1, unit: 'deg' },
    { key: 'grayscale', css: 'grayscale', min: 0, max: 100, default: 0, step: 1, unit: '%' },
    { key: 'sepia', css: 'sepia', min: 0, max: 100, default: 0, step: 1, unit: '%' },
    { key: 'invert', css: 'invert', min: 0, max: 100, default: 0, step: 1, unit: '%' },
    { key: 'blur', css: 'blur', min: 0, max: 20, default: 0, step: 1, unit: 'px' },
  ];

  // Same as the CSS unit, except degrees show "°" instead of "deg".
  static filterDisplayUnit(key) {
    const unit = Filler.IMAGE_FILTERS.find((f) => f.key === key).unit;
    return unit === 'deg' ? '°' : unit;
  }

  // One call per IMAGE_FILTERS entry; each slider's own min/max already keeps values in range.
  static computeImageFilter(image) {
    return Filler.IMAGE_FILTERS.map(({ key, css, unit }) => `${css}(${image[key]}${unit})`).join(' ');
  }

  static clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  /* Builds an element and assigns own properties (className, type, textContent, ...); mirrors
     `className` into `part` for ::part() access from outside a shadow root (`part: false` opts out). */
  static el(tag, { part, ...props } = {}) {
    const el = Object.assign(document.createElement(tag), props);
    if (part !== false && props.className) {
      el.setAttribute('part', props.className);
    }
    return el;
  }

  // Parsed once, shared via `adoptedStyleSheets` across every instance's shadow root.
  static getPanelStylesheet() {
    if (!Filler._panelStylesheet) {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(PANEL_CSS);
      Filler._panelStylesheet = sheet;
    }
    return Filler._panelStylesheet;
  }

  /* Normalizes "abc"/"#abc"/"aabbcc"/"#AABBCC" into "#AABBCC", or null if not a valid hex color. */
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

  // Like hexToRgb, but also accepts 8-digit #RRGGBBAA, returning its alpha (3/6-digit forms return `a: null`).
  static hexToRgba(hex) {
    const value = typeof hex === 'string' ? hex.trim().replace(/^#/, '') : '';
    if (!/^[0-9a-f]{8}$/i.test(value)) {
      const rgb = Filler.hexToRgb(hex);
      return rgb ? { ...rgb, a: null } : null;
    }

    const n = parseInt(value, 16);
    return {
      r: (n >>> 24) & 255, g: (n >>> 16) & 255, b: (n >>> 8) & 255,
      a: Math.round(((n & 255) / 255) * 100),
    };
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

  // First image file from a paste/drop DataTransfer, or null (`.items` is the fallback for pasted images).
  static extractImageFile(dataTransfer) {
    const fromFiles = [...(dataTransfer.files || [])].find((f) => f.type.startsWith('image/'));
    if (fromFiles) {
      return fromFiles;
    }

    const item = [...(dataTransfer.items || [])].find((i) => i.kind === 'file' && i.type.startsWith('image/'));
    return item ? item.getAsFile() : null;
  }

  /* True for white and near-white colors, where a same-color border would be invisible. */
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

  /* Prefers beside the field (right, then left) over stacking below/above; falls back only when
     neither side fits the panel's own minimum width (PANEL_MIN_WIDTH). Returns the side and its
     room as `maxSize`, used to cap the panel before measuring so it scrolls only as a last resort. */
  static availableSpace(anchorRect, viewport, offset = 6) {
    const space = {
      right: viewport.width - anchorRect.right - offset,
      left: anchorRect.left - offset,
      bottom: viewport.height - anchorRect.bottom - offset,
      top: anchorRect.top - offset,
    };

    if (space.right >= Filler.PANEL_MIN_WIDTH) {
      return { side: 'right', maxSize: space.right };
    }
    if (space.left >= Filler.PANEL_MIN_WIDTH) {
      return { side: 'left', maxSize: space.left };
    }

    const side = space.bottom >= space.top ? 'bottom' : 'top';
    return { side, maxSize: Math.max(space[side], 0) };
  }

  // Placed on whichever side availableSpace picked, then clamped to stay on-screen (assumes `size` already fits `maxSize`).
  static computePosition(anchorRect, size, viewport, offset = 6) {
    const { side } = Filler.availableSpace(anchorRect, viewport, offset);

    const position = {
      bottom: { top: anchorRect.bottom + offset, left: anchorRect.left },
      top: { top: anchorRect.top - size.height - offset, left: anchorRect.left },
      right: { top: anchorRect.top, left: anchorRect.right + offset },
      left: { top: anchorRect.top, left: anchorRect.left - size.width - offset },
    }[side];

    return {
      top: Filler.clamp(position.top, 4, Math.max(viewport.height - size.height - 4, 4)),
      left: Filler.clamp(position.left, 4, Math.max(viewport.width - size.width - 4, 4)),
    };
  }

  /* @param {string|HTMLInputElement} target @param {object} [options] */
  constructor(target, options = {}) {
    const el = this.el = typeof target === 'string' ? document.querySelector(target) : target;

    if (!(el instanceof HTMLInputElement)) {
      throw new Error(`Filler: no input element found for "${target}"`);
    }

    Object.assign(this, Filler.DEFAULTS, options, {
      classes: { ...Filler.DEFAULTS.classes, ...options.classes },
      labels: { ...Filler.DEFAULTS.labels, ...options.labels },
      palette: options.palette ? [...options.palette] : [...Filler.DEFAULTS.palette],
      sources: options.sources?.length ? [...options.sources] : [...Filler.DEFAULTS.sources],
    });

    this.disabled = options.disabled ?? el.disabled;

    const initialHex = Filler.normalizeHex(el.value) || '#000000';
    const initialAlpha = Filler.clamp(options.alpha ?? parseFloat(el.dataset.alpha ?? '100'), 0, 100);
    this.hsva = { ...Filler.rgbToHsv(Filler.hexToRgb(initialHex)), a: initialAlpha };

    // Which panel the dialog shows — 'solid' (HSV picker) or 'image' (upload + adjustments).
    this.source = this.sources[0];
    this.image = {
      dataUrl: null,
      fit: 'cover',
      rotation: 0,
      ...Object.fromEntries(Filler.IMAGE_FILTERS.map(({ key, default: value }) => [key, value])),
    };

    this.customPalette = this.loadCustomPalette();
    this.dropdownOpen = false;
    this.dialogOpen = false;
    this.draggingAlpha = false;

    this.initialize();
  }

  get hex() {
    return Filler.rgbToHex(Filler.hsvToRgb(this.hsva));
  }

  initialize() {
    const { el, classes } = this;
    el.classList.add(classes.input);
    // 9 = "#" + 8 hex digits, so a full #RRGGBBAA still fits (see handleHexInput).
    Object.assign(el, { type: 'text', autocomplete: 'off', spellcheck: false, maxLength: 9 });

    const wrapper = this.wrapper = Filler.el('div', { className: classes.container });
    el.parentNode.insertBefore(wrapper, el);

    const swatchColor = this.swatchColor = Filler.el('span', { className: classes.swatchColor });
    // Painted over swatchColor via DOM order (no z-index needed); shown only while there's transparency.
    const swatchColorOpaque = this.swatchColorOpaque = Filler.el('span', { className: classes.swatchColorOpaque });
    const swatch = this.swatch = Filler.el('button', { type: 'button', className: classes.swatch });
    swatch.append(swatchColor, swatchColorOpaque);
    this.syncSwatchTitle();

    const alphaInput = this.alphaInput = Filler.el('input', {
      type: 'text', inputMode: 'numeric', maxLength: 3, className: classes.alphaInput,
    });
    const suffix = this.suffix = Filler.el('span', { className: classes.alphaSuffix, textContent: this.suffixText });
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
    // Image mode has no hex value to select or type — open the dialog instead of the dropdown.
    el.addEventListener('focus', () => {
      if (this.source === 'image') {
        this.openDialog();
        return;
      }
      el.select();
      this.openDropdown();
    });
    el.addEventListener('input', () => this.handleHexInput());
    el.addEventListener('blur', () => this.renderSwatch());
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

    const { swatch } = this;
    // Alt+click samples a color from the screen instead of opening the dialog (see syncSwatchTitle for the hint).
    swatch.addEventListener('click', (event) => {
      if (event.altKey && window.EyeDropper) {
        this.pickWithEyeDropper();
        return;
      }
      this.toggleDialog();
    });

    // Pasting or dropping an image onto the swatch switches straight to image mode with it loaded.
    swatch.addEventListener('paste', (event) => this.handleSwatchImageData(event.clipboardData));
    swatch.addEventListener('dragover', (event) => {
      if (!this.disabled) {
        event.preventDefault();
      }
    });
    swatch.addEventListener('drop', (event) => {
      event.preventDefault();
      this.handleSwatchImageData(event.dataTransfer);
    });
  }

  // Samples a color from anywhere on screen; applied via `applyHex`, the same path a palette click uses.
  pickWithEyeDropper() {
    if (this.disabled || !window.EyeDropper || !this.sources.includes('solid')) {
      return;
    }
    new window.EyeDropper().open().then(({ sRGBHex }) => {
      const hex = Filler.normalizeHex(sRGBHex);
      if (hex) {
        this.setSource('solid');
        this.applyHex(hex);
      }
    }).catch(() => {});
  }

  // Whether to show a hint for the Alt+click eyedropper shortcut — only where it actually works.
  syncSwatchTitle() {
    this.swatch.title = (window.EyeDropper && this.sources.includes('solid')) ? this.labels.eyedropper : '';
  }

  handleSwatchImageData(dataTransfer) {
    if (this.disabled || !dataTransfer || !this.sources.includes('image')) {
      return;
    }
    const file = Filler.extractImageFile(dataTransfer);
    if (!file) {
      return;
    }
    this.setSource('image');
    this.openDialog();
    this.handleImageUpload(file);
  }

  // Dragging the "%" suffix left/right nudges transparency, mirroring Ranger's pointer-capture drags.
  bindAlphaSuffixDrag() {
    const { suffix, alphaInput } = this;
    suffix.addEventListener('pointerdown', (event) => {
      if (this.disabled) {
        return;
      }
      event.preventDefault();

      // Tracked from the last position (not drag start), so reversing after clamping resumes immediately.
      let lastX = event.clientX;
      suffix.setPointerCapture(event.pointerId);

      // The wrapping label still focuses alphaInput on click, which would make render() skip refreshing the value until blur.
      this.draggingAlpha = true;

      const onMove = (moveEvent) => {
        this.setAlpha(this.hsva.a + (moveEvent.clientX - lastX) / 2);
        lastX = moveEvent.clientX;
      };
      const onUp = () => {
        this.draggingAlpha = false;
        alphaInput.value = Math.round(this.hsva.a);
        suffix.removeEventListener('pointermove', onMove);
        suffix.removeEventListener('pointerup', onUp);
      };

      suffix.addEventListener('pointermove', onMove);
      suffix.addEventListener('pointerup', onUp);
    });
  }

  // Applies once typed text is a complete hex (3/6/8-digit); 8-digit's alpha wins, otherwise the current one is kept.
  handleHexInput() {
    const color = Filler.hexToRgba(this.el.value);
    if (!color) {
      return;
    }

    this.hsva = { ...Filler.rgbToHsv(color), a: color.a ?? this.hsva.a };
    this.render({ skipHexInput: true });
  }

  // Applies any recognizable pasted color (alpha included); anything else falls through to a normal paste.
  handleHexPaste(event) {
    if (this.source === 'image') {
      return;
    }

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
    const { el, hsva, alphaInput } = this;
    const hex = this.hex;

    const alphaRounded = Math.round(hsva.a);
    if (this.draggingAlpha || document.activeElement !== alphaInput) {
      alphaInput.value = alphaRounded;
    }

    this.renderSwatch({ skipHexInput });

    if (this.dialogOpen) {
      this.renderDialog();
    }

    this.onChange?.(hex, alphaRounded);
    // 'change', not 'input' — 'input' would recurse into handleHexInput.
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Repaints the swatch/field for the active source: 'solid' paints hsva, 'image' shows the uploaded thumbnail.
  renderSwatch({ skipHexInput = false } = {}) {
    const { el, hsva, swatch, swatchColor, swatchColorOpaque, labels } = this;
    const isImage = this.source === 'image';

    swatch.classList.toggle('is-image', isImage);
    el.classList.toggle('is-image-value', isImage);
    el.readOnly = isImage;

    if (isImage) {
      const { dataUrl, rotation } = this.image;
      if (!skipHexInput) {
        el.value = labels.imageSource;
      }

      swatchColor.style.backgroundColor = '';
      swatchColor.style.backgroundImage = dataUrl ? `url("${dataUrl}")` : '';
      swatchColor.style.transform = dataUrl ? `rotate(${rotation}deg)` : '';
      swatchColor.style.opacity = hsva.a / 100;
      swatch.classList.remove('has-alpha');
      swatch.style.border = 'none';

      this.applyImageFilter();
      return;
    }

    if (!skipHexInput) {
      el.value = this.hex;
    }

    const rgb = Filler.hsvToRgb(hsva);
    const rgbTriplet = `${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}`;
    const hasAlpha = hsva.a < 100;

    swatchColor.style.backgroundImage = '';
    swatchColor.style.transform = '';
    swatchColor.style.opacity = '';
    // Cleared here too — otherwise the last image filter (applyImageFilter) stays stuck on the solid color.
    swatchColor.style.filter = '';
    // Split while transparent: left shows the opaque color, right the actual one over the checkerboard.
    swatchColor.style.backgroundColor = `rgba(${rgbTriplet}, ${hsva.a / 100})`;
    swatchColorOpaque.style.backgroundColor = `rgb(${rgbTriplet})`;
    swatch.classList.toggle('has-alpha', hasAlpha);

    // No border except for white/near-white, which would otherwise blend into the page.
    swatch.style.border = Filler.isNearWhite(rgb) ? '1px solid #dfe2e3' : 'none';
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

  /* `host` is the plain light-DOM element attachFloating positions and appends to <body>; `root`
     (its shadow tree) carries the panel's chrome/content, isolated from page CSS both ways —
     restyle from outside via `::part(<class-name>)` instead of a plain selector. */
  createShadowPanel(className) {
    const host = Filler.el('div');
    const shadow = host.attachShadow({ mode: 'open' });

    if ('adoptedStyleSheets' in shadow) {
      shadow.adoptedStyleSheets = [Filler.getPanelStylesheet()];
    } else {
      shadow.appendChild(Filler.el('style', { textContent: PANEL_CSS }));
    }

    const root = Filler.el('div', { className });
    shadow.appendChild(root);

    return { host, root };
  }

  /* `content` is `panel`'s shadow-root element (its `root`) — the scroll clamp below targets it
     instead of `panel`, since an ancestor's overflow clips a descendant's box-shadow but never
     its own, keeping content's box-shadow (filler-panel-chrome) intact while it scrolls. */
  attachFloating(panel, content, onClose) {
    const { wrapper } = this;
    Object.assign(panel.style, { position: 'fixed', zIndex: 999999, top: 0, left: 0 });
    document.body.appendChild(panel);

    // Hidden while sized/positioned so nothing flashes unstyled first.
    panel.style.visibility = 'hidden';

    const fieldWidth = wrapper.getBoundingClientRect().width;
    panel.style.width = `${Filler.clamp(fieldWidth, Filler.PANEL_MIN_WIDTH, Filler.PANEL_MAX_WIDTH)}px`;

    const reposition = () => {
      const anchorRect = wrapper.getBoundingClientRect();
      const viewport = { width: window.innerWidth, height: window.innerHeight };

      // Capped to the chosen side's room before measuring, so it scrolls only as a last resort.
      const { side, maxSize } = Filler.availableSpace(anchorRect, viewport);
      const stacked = side === 'top' || side === 'bottom';

      content.style.maxHeight = `${stacked ? maxSize : viewport.height - 8}px`;
      content.style.overflowY = 'auto';
      panel.style.maxWidth = stacked ? '' : `${maxSize}px`;

      const size = { width: panel.offsetWidth, height: panel.offsetHeight };
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

    /* Deferred past the gesture that opened this panel: a focus-triggered open (see the hex
       field's 'focus' listener) runs before that same gesture's 'click' event, which this
       listener would otherwise catch and could misread as an outside click. */
    const addClickListenerTimer = setTimeout(() => document.addEventListener('click', onDocClick, true), 0);
    document.addEventListener('keydown', onKeydown);
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    return () => {
      clearTimeout(addClickListenerTimer);
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
      const { host, root } = this.createShadowPanel(this.classes.dropdown);
      this.dropdownHost = host;
      this.dropdownBody = root;
    }
    this.renderDropdown();

    this.dropdownOpen = true;
    this.wrapper.classList.add('is-open');
    this.detachDropdown = this.attachFloating(this.dropdownHost, this.dropdownBody, () => this.closeDropdown());
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
    this.syncSourceUI();

    this.dialogOpen = true;
    this.wrapper.classList.add('is-open');
    this.detachDialog = this.attachFloating(this.dialogHost, this.dialog, () => this.closeDialog());
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

    // Hidden outright where the browser doesn't support it — no point offering a button that can't work.
    const eyedropperButton = this.dialogEyedropperButton = Filler.el('button', {
      type: 'button', className: classes.dialogEyedropper, title: this.labels.pickColor,
      innerHTML: Filler.EYEDROPPER_ICON, hidden: !window.EyeDropper,
    });
    eyedropperButton.addEventListener('click', () => this.pickWithEyeDropper());
    tabs.appendChild(eyedropperButton);

    const copyButton = Filler.el('button', {
      type: 'button', className: classes.dialogCopy, title: this.labels.copyValue, textContent: '⧉',
    });
    copyButton.addEventListener('click', () => this.copyValue(copyButton));
    tabs.appendChild(copyButton);

    const fields = Filler.el('div', { className: classes.dialogFields });

    const solidPanel = Filler.el('div', { className: classes.dialogSolid });
    solidPanel.append(area, hue, alpha, tabs, fields);

    const sourceButtons = this.buildSourceButtons();
    const imagePanel = this.buildImagePanel();

    const { host, root: dialog } = this.createShadowPanel(classes.dialog);
    this.dialogHost = host;
    this.dialog = dialog;
    dialog.append(sourceButtons, solidPanel, imagePanel);

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
      dialogSolidPanel: solidPanel,
      dialogImagePanel: imagePanel,
    });

    this.syncSourceUI();
  }

  // Source-type buttons ('Solid'/'Image'); hidden outright under 2 sources; icon-only, label lives in `title`.
  buildSourceButtons() {
    const { classes } = this;
    const row = this.dialogSources = Filler.el('div', { className: classes.dialogSources });

    this.dialogSourceButtons = {};
    ['solid', 'image'].forEach((type) => {
      const button = Filler.el('button', {
        type: 'button', className: classes.dialogSource, innerHTML: Filler.SOURCE_ICONS[type],
      });
      button.addEventListener('click', () => this.setSource(type));

      this.dialogSourceButtons[type] = button;
      row.appendChild(button);
    });

    this.syncSourceLabels();

    return row;
  }

  // Split out so update({ labels }) can refresh titles without rebuilding the dialog.
  syncSourceLabels() {
    const { dialogSourceButtons, labels } = this;
    if (!dialogSourceButtons) {
      return;
    }

    dialogSourceButtons.solid.title = labels.solidSource;
    dialogSourceButtons.image.title = labels.imageSource;
  }

  setSource(type) {
    if (this.disabled || type === this.source || !this.sources.includes(type)) {
      return;
    }
    this.source = type;
    this.syncSourceUI();
    this.renderSwatch();
  }

  // Shows/hides the source buttons and solid/image panels for the current `sources` and `source`.
  syncSourceUI() {
    const { dialogSources, dialogSourceButtons, dialogSolidPanel, dialogImagePanel, sources, source } = this;
    if (!dialogSources) {
      return;
    }

    Object.entries(dialogSourceButtons).forEach(([type, button]) => {
      button.hidden = !sources.includes(type);
      button.classList.toggle('is-active', type === source);
    });
    dialogSources.hidden = sources.length < 2;

    dialogSolidPanel.hidden = source !== 'solid';
    dialogImagePanel.hidden = source !== 'image';
  }

  // The 'Image' panel: object-fit + rotate toolbar, upload field, one slider per IMAGE_FILTERS entry.
  buildImagePanel() {
    const { classes, labels, image } = this;

    const fitSelect = this.dialogImageFit = Filler.el('select', { className: classes.dialogImageFit });
    Object.entries(labels.objectFit).forEach(([value, text]) => {
      fitSelect.appendChild(Filler.el('option', { value, textContent: text, selected: value === image.fit }));
    });
    fitSelect.addEventListener('change', () => {
      this.image.fit = fitSelect.value;
      this.renderImagePreview();
    });

    const rotateButton = Filler.el('button', {
      type: 'button', className: classes.dialogImageRotate, title: labels.rotateImage, textContent: '⤾',
    });
    rotateButton.addEventListener('click', () => {
      this.image.rotation = (this.image.rotation + 90) % 360;
      this.renderImagePreview();
    });

    const toolbar = Filler.el('div', { className: classes.dialogImageToolbar });
    toolbar.append(fitSelect, rotateButton);

    const uploadInput = this.dialogImageUploadInput = Filler.el('input', {
      type: 'file', accept: 'image/*', className: classes.dialogImageUploadInput,
    });
    uploadInput.addEventListener('change', () => this.handleImageUpload(uploadInput.files?.[0]));

    const previewImg = this.dialogImagePreviewImg = Filler.el('img', { className: classes.dialogImagePreviewImg });
    const placeholder = this.dialogImagePlaceholder = Filler.el('span', {
      className: classes.dialogImagePlaceholder, textContent: labels.uploadImage,
    });
    const removeButton = this.dialogImageRemoveButton = Filler.el('button', {
      type: 'button', className: classes.dialogImageRemove, title: labels.removeImage, textContent: '×',
    });
    removeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.clearImage();
    });

    // Square, top-left (mirrors removeButton); shown on hover only once a slider's off default.
    const resetButton = this.dialogImageResetButton = Filler.el('button', {
      type: 'button', className: classes.dialogImageReset, title: labels.resetAdjustments, textContent: '↺',
    });
    resetButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.resetImageAdjustments();
    });

    const preview = this.dialogImagePreview = Filler.el('span', { className: classes.dialogImagePreview });
    preview.append(previewImg, placeholder, resetButton, removeButton);

    const upload = this.dialogImageUpload = Filler.el('label', { className: classes.dialogImageUpload });
    upload.append(uploadInput, preview);

    const slidersTitle = Filler.el('span', { className: classes.dialogImageSlidersTitle, textContent: labels.adjustments });

    const sliders = Filler.el('div', { className: classes.dialogImageSliders });
    this.dialogImageSliderInputs = {};
    this.dialogImageSliderValues = {};

    Filler.IMAGE_FILTERS.forEach(({ key, min, max, step, default: def }) => {
      const displayUnit = Filler.filterDisplayUnit(key);
      // `part: false` — this repaints on every drag tick and isn't meant to be its own ::part().
      const valueEl = Filler.el('span', {
        className: classes.dialogImageSliderValue, part: false, textContent: `${image[key]}${displayUnit}`,
      });
      const head = Filler.el('span', { className: classes.dialogImageSliderHead });
      head.append(Filler.el('span', { className: classes.dialogImageSliderLabel, textContent: labels.filters[key] }), valueEl);

      const input = Filler.el('input', {
        type: 'range', className: classes.dialogImageSliderInput, min, max, step, value: image[key],
      });
      // Where the fill treats "center" — the filter's neutral value, not the track's midpoint; unitless 0-1.
      input.style.setProperty('--center', (def - min) / (max - min));
      Filler.setSliderPercent(input);
      input.addEventListener('input', () => {
        this.image[key] = +input.value;
        valueEl.textContent = `${input.value}${displayUnit}`;
        Filler.setSliderPercent(input);
        this.applyImageFilter();
        this.syncImageAdjustmentsState();
      });
      this.dialogImageSliderInputs[key] = input;
      this.dialogImageSliderValues[key] = valueEl;

      const row = Filler.el('label', { className: classes.dialogImageSlider });
      row.append(head, input);
      sliders.appendChild(row);
    });

    const panel = Filler.el('div', { className: classes.dialogImage });
    panel.append(toolbar, upload, slidersTitle, sliders);

    this.renderImagePreview();
    this.syncImageAdjustmentsState();

    return panel;
  }

  // Current position as a 0-1 fraction, kept as `--percent` for the pure-CSS fill to read.
  static setSliderPercent(input) {
    const min = +input.min;
    const max = +input.max;
    input.style.setProperty('--percent', (+input.value - min) / (max - min));
  }

  // Whether any slider has moved off default; gates the reset button's visibility.
  hasImageAdjustments() {
    return Filler.IMAGE_FILTERS.some(({ key, default: value }) => this.image[key] !== value);
  }

  syncImageAdjustmentsState() {
    this.dialogImageUpload.classList.toggle('has-adjustments', this.hasImageAdjustments());
  }

  handleImageUpload(file) {
    if (!file || !file.type.startsWith('image/')) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.image.dataUrl = reader.result;
      this.image.rotation = 0;
      this.renderImagePreview();
    };
    reader.readAsDataURL(file);
  }

  clearImage() {
    this.image.dataUrl = null;
    this.image.rotation = 0;
    this.dialogImageUploadInput.value = '';
    this.resetImageAdjustments();
    this.renderImagePreview();
  }

  // Restores every filter to its neutral default, Figma-style; the image itself is untouched.
  resetImageAdjustments() {
    Filler.IMAGE_FILTERS.forEach(({ key, default: value }) => {
      this.image[key] = value;

      const input = this.dialogImageSliderInputs[key];
      input.value = value;
      Filler.setSliderPercent(input);
      this.dialogImageSliderValues[key].textContent = `${value}${Filler.filterDisplayUnit(key)}`;
    });
    this.syncImageAdjustmentsState();
    this.renderSwatch();
  }

  // Repaints the upload field's preview/placeholder and the image itself from `this.image`.
  renderImagePreview() {
    const { dataUrl, fit, rotation } = this.image;
    const { dialogImagePreviewImg: img, dialogImagePlaceholder: placeholder, dialogImageUpload: upload, dialogImageRemoveButton: removeButton } = this;

    upload.classList.toggle('has-image', !!dataUrl);
    placeholder.hidden = !!dataUrl;
    removeButton.hidden = !dataUrl;
    img.hidden = !dataUrl;

    // Nothing to adjust without an image — keep the sliders inert (and visibly so) until one's loaded.
    Object.values(this.dialogImageSliderInputs).forEach((input) => { input.disabled = !dataUrl; });

    if (dataUrl) {
      img.src = dataUrl;
      img.style.objectFit = fit;
      img.style.transform = `rotate(${rotation}deg)`;
    } else {
      img.src = '';
    }

    // Also applies the adjustment filter and, while 'image' is active, syncs the compact swatch.
    this.renderSwatch();
  }

  // Applies the computed filter to the dialog preview, and to the compact swatch while 'image' is active.
  applyImageFilter() {
    const filter = Filler.computeImageFilter(this.image);
    if (this.dialogImagePreviewImg) {
      this.dialogImagePreviewImg.style.filter = filter;
    }
    if (this.source === 'image' && this.swatchColor) {
      this.swatchColor.style.filter = filter;
    }
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
      // Inside a shadow root, document.activeElement reports only the host — ask the input's own root instead.
      if (input.getRootNode().activeElement !== input) {
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

  // Applies an options patch to an already-mounted instance.
  update(options = {}) {
    const paletteChanged = 'palette' in options;
    const sourcesChanged = 'sources' in options;
    const labelsChanged = 'labels' in options;

    Object.assign(this, options, {
      classes: options.classes ? { ...this.classes, ...options.classes } : this.classes,
      labels: options.labels ? { ...this.labels, ...options.labels } : this.labels,
      palette: options.palette ? [...options.palette] : this.palette,
      sources: options.sources?.length ? [...options.sources] : this.sources,
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

    if (sourcesChanged) {
      if (!this.sources.includes(this.source)) {
        this.source = this.sources[0];
      }
      this.syncSourceUI();
      this.syncSwatchTitle();
    }

    if (labelsChanged) {
      this.syncSourceLabels();
      this.syncSwatchTitle();
      if (this.source === 'image') {
        this.renderSwatch();
      }
    }
  }
}

document.addEventListener('youla:init', ()=> {

  /* Turns `<input type="text">` into a Figma-style fill field — swatch, HEX input, and a
     transparency field. The HEX field opens a palette dropdown; the swatch opens a full HSV +
     alpha dialog with copy-to-clipboard in HEX/RGB/HSL. The main input always displays HEX. */
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
