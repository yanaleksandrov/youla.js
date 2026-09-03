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

// Exported so other UI built outside the v-data/directive system (e.g. the ProseMirror selection
// toolbar's Text Color/Highlight editor, editrix/prosemirror/toolbar.js) can attach a real filler
// to an <input> it built by hand, the same way the "v-filler" directive below does.
export class Filler {
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
        swatchVideo: 'swatch-video',
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
        dialogFieldsValues: 'fields-values',
        dialogField: 'field',
        dialogFieldLabel: 'field-label',
        dialogSources: 'sources',
        dialogSourcesGroup: 'sources-group',
        dialogSource: 'source',
        dialogClose: 'close',
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

      ...classNames('filler-dialog-video', {
        dialogVideo: '',
        dialogVideoToolbar: 'toolbar',
        dialogVideoFit: 'fit',
        dialogVideoRotate: 'rotate',
        dialogVideoUpload: 'upload',
        dialogVideoUploadInput: 'upload-input',
        dialogVideoPreview: 'preview',
        dialogVideoPreviewVideo: 'preview-video',
        dialogVideoPlaceholder: 'placeholder',
        dialogVideoRemove: 'remove',
        dialogVideoReset: 'reset',
        // Real <video>-tag playback settings (autoplay/loop/muted/...), not a CSS-filter correction panel like the image source's.
        dialogVideoSettingsTitle: 'settings-title',
        dialogVideoSettings: 'settings',
        dialogVideoSetting: 'setting',
        dialogVideoSettingLabel: 'setting-label',
        dialogVideoSettingInput: 'setting-input',
      }),
    },
    // Dialog format ('hex'/'rgb'/'hsl'); the field next to the swatch always shows HEX.
    format: 'hex',
    // Initial transparency (0-100); falls back to data-alpha, then 100.
    alpha: null,
    // {name, hex}[] for the dropdown's library list, sorted by name.
    palette: PALETTE,
    // Source-type buttons to show — 'solid', 'image' and/or 'video'; a single entry locks the dialog to it.
    sources: ['solid', 'image', 'video'],
    // localStorage key for the custom palette; null disables persistence.
    customPaletteKey: 'youla-filler-palette',
    disabled: false,
    // Shown after the transparency value; drag it left/right to adjust.
    suffixText: '%',
    // (hex, alpha) => void, fired on any color/transparency change.
    onChange: null,
    // (type) => void, fired when the dialog's source switches ('solid'/'image'/'video').
    onSourceChange: null,
    // ('image'|'video', media) => void, fired after an upload/clear/reset or any slider/setting edit.
    onMediaChange: null,

    // User-facing text, overridable for localization.
    labels: {
      customPaletteTitle: 'Свой набор',
      addCurrentColor: 'Добавить текущий цвет',
      libraryTitle: 'Библиотека',
      copyValue: 'Скопировать значение',
      pickColor: 'Пипетка с экрана',
      eyedropper: 'Alt+клик — пипетка с экрана',
      closeDialog: 'Закрыть',

      solidSource: 'Заливка',
      imageSource: 'Изображение',
      uploadImage: 'Выбрать изображение',
      removeImage: 'Удалить изображение',
      videoSource: 'Видео',
      uploadVideo: 'Выбрать видео',
      removeVideo: 'Удалить видео',
      // Shared by the image and video panels' rotate button — the text itself isn't source-specific.
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
      // Slider labels, one per Filler.MEDIA_FILTERS key (image source only).
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

      // Video source only — real <video>-tag attributes, one per Filler.VIDEO_SETTINGS key.
      videoSettingsTitle: 'Настройки видео',
      videoSettings: {
        autoplay: 'Автовоспроизведение',
        loop: 'Зациклить',
        muted: 'Без звука',
        playsInline: 'Воспроизведение в блоке (playsinline)',
        controls: 'Элементы управления',
        preload: 'Предзагрузка',
      },
      videoPreload: {
        none: 'Не загружать',
        metadata: 'Только метаданные',
        auto: 'Автоматически',
      },
    },
  };

  // Source-type button icons (Phosphor "image" / "paint-brush-broad"), keyed like `sources`.
  static SOURCE_ICONS = {
    solid: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 12 12"><path fill="#ababab" d="M3 3h6v6H3z"/><path fill="#000" fill-rule="evenodd" d="M2 1h8a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1M0 2a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2zm3 7V3h6v6zM2 2.5a1 1 0 0 1 .5-.5h7a1 1 0 0 1 .5.5v7a1 1 0 0 1-.5.5h-7a1 1 0 0 1-.5-.5z" clip-rule="evenodd"/></svg>',
    image: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 12 12"><path fill="#000" d="M10 0a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2zM2 1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1zm2.22 4.08a.5.5 0 0 1 .63.07l4 4a.5.5 0 1 1-.7.7L4.5 6.21 2.85 7.85a.5.5 0 1 1-.7-.7l2-2zM8.5 2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3m0 1a.5.5 0 1 0 0 1 .5.5 0 0 0 0-1"/></svg>',
    video: '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 12 12"><path fill="#000" d="M10 0a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2V2a2 2 0 0 1 2-2zM2 1a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"/><path stroke="#000" d="M4.1 4.3q.1-.6.8-.5l3 1.8q.5.4 0 .8l-3 1.8q-.7.3-.8-.5z"/></svg>',
  };

  // Per-type wiring shared by buildMediaPanel/renderMediaPreview/etc.; `classKeys`/`labelKeys` point into `classes`/`labels`.
  static MEDIA = {
    image: {
      tag: 'img',
      accept: 'image/*',
      classKeys: {
        panel: 'dialogImage', toolbar: 'dialogImageToolbar', fit: 'dialogImageFit', rotate: 'dialogImageRotate',
        upload: 'dialogImageUpload', uploadInput: 'dialogImageUploadInput', preview: 'dialogImagePreview',
        previewMedia: 'dialogImagePreviewImg', placeholder: 'dialogImagePlaceholder', remove: 'dialogImageRemove',
        reset: 'dialogImageReset', slidersTitle: 'dialogImageSlidersTitle', sliders: 'dialogImageSliders',
        slider: 'dialogImageSlider', sliderHead: 'dialogImageSliderHead', sliderLabel: 'dialogImageSliderLabel',
        sliderValue: 'dialogImageSliderValue', sliderInput: 'dialogImageSliderInput',
      },
      labelKeys: { source: 'imageSource', upload: 'uploadImage', remove: 'removeImage', rotate: 'rotateImage' },
    },
    video: {
      tag: 'video',
      accept: 'video/*',
      classKeys: {
        panel: 'dialogVideo', toolbar: 'dialogVideoToolbar', fit: 'dialogVideoFit', rotate: 'dialogVideoRotate',
        upload: 'dialogVideoUpload', uploadInput: 'dialogVideoUploadInput', preview: 'dialogVideoPreview',
        previewMedia: 'dialogVideoPreviewVideo', placeholder: 'dialogVideoPlaceholder', remove: 'dialogVideoRemove',
        reset: 'dialogVideoReset', settingsTitle: 'dialogVideoSettingsTitle', settings: 'dialogVideoSettings',
        setting: 'dialogVideoSetting', settingLabel: 'dialogVideoSettingLabel', settingInput: 'dialogVideoSettingInput',
      },
      labelKeys: { source: 'videoSource', upload: 'uploadVideo', remove: 'removeVideo', rotate: 'rotateImage' },
    },
  };

  // Real <video>-tag playback settings, editable in the video panel instead of a CSS-filter correction section.
  static VIDEO_SETTINGS = [
    { key: 'autoplay', type: 'checkbox', default: true },
    { key: 'loop', type: 'checkbox', default: true },
    { key: 'muted', type: 'checkbox', default: true },
    { key: 'playsInline', type: 'checkbox', default: true },
    { key: 'controls', type: 'checkbox', default: false },
    { key: 'preload', type: 'select', default: 'auto', options: ['none', 'metadata', 'auto'] },
  ];

  // Eyedropper icon (Material "colorize"), for the dialog's pick-from-screen button.
  static EYEDROPPER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="none" viewBox="0 0 12 12"><path fill="#000" d="M12 2.2a2.2 2.2 0 0 0-.7-1.6C10.42-.23 9-.2 8.13.67L6.93 1.9a1.5 1.5 0 0 0-2.08.05l-.56.56a1 1 0 0 0 0 1.41l.13.13-3.19 3.19A2.5 2.5 0 0 0 .57 9.6l-.5 1.16a.9.9 0 0 0 .18.95 1 1 0 0 0 1.1.2l1.1-.47a2.5 2.5 0 0 0 2.32-.67l3.19-3.2.12.14a1 1 0 0 0 1.42 0l.56-.57a1.5 1.5 0 0 0 .05-2.07l1.23-1.24A2.2 2.2 0 0 0 12 2.2m-7.94 7.86a1.5 1.5 0 0 1-1.5.38.5.5 0 0 0-.34.02l-1.13.5.47-1.12a.5.5 0 0 0 .02-.36 1.5 1.5 0 0 1 .36-1.54l3.19-3.19 2.12 2.13zm6.57-6.93L9.05 4.72a.5.5 0 0 0 0 .7l.3.31a.5.5 0 0 1 0 .7L8.8 7 5 3.2l.56-.56a.5.5 0 0 1 .71 0l.3.3a.5.5 0 0 0 .71 0l1.56-1.56a1.3 1.3 0 0 1 1.77-.05 1.25 1.25 0 0 1 .02 1.8"/></svg>';

  // Panel width clamp; also the "enough room" threshold `availableSpace` uses to prefer beside the field over stacking.
  static PANEL_MIN_WIDTH = 200;
  static PANEL_MAX_WIDTH = 280;

  // One slider per CSS filter function; ranges follow the spec, hue-rotate alone is signed (-180..180).
  static MEDIA_FILTERS = [
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
    const unit = Filler.MEDIA_FILTERS.find((f) => f.key === key).unit;
    return unit === 'deg' ? '°' : unit;
  }

  // One call per MEDIA_FILTERS entry; each slider's own min/max already keeps values in range.
  static computeMediaFilter(media) {
    return Filler.MEDIA_FILTERS.map(({ key, css, unit }) => `${css}(${media[key]}${unit})`).join(' ');
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

  // First file matching `mimePrefix` from a paste/drop DataTransfer, or null (`.items` is the fallback for pasted files).
  static extractMediaFile(dataTransfer, mimePrefix) {
    const fromFiles = [...(dataTransfer.files || [])].find((f) => f.type.startsWith(mimePrefix));
    if (fromFiles) {
      return fromFiles;
    }

    const item = [...(dataTransfer.items || [])].find((i) => i.kind === 'file' && i.type.startsWith(mimePrefix));
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

  // Prefers beside the field (right, then left) over stacking, falling back only if neither fits PANEL_MIN_WIDTH.
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

  /**
   * @param {string|HTMLInputElement} target
   * @param {object} [options]
   */
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

    // Which panel the dialog shows; "options.source" seeds it (e.g. restoring a fill saved elsewhere), else the first configured source.
    this.source = options.source && this.sources.includes(options.source) ? options.source : this.sources[0];
    const imageFilterDefaults = Object.fromEntries(Filler.MEDIA_FILTERS.map(({ key, default: value }) => [key, value]));
    const videoSettingDefaults = Object.fromEntries(Filler.VIDEO_SETTINGS.map(({ key, default: value }) => [key, value]));
    // "options.image"/"options.video" restore a previously uploaded file's dataUrl/filters/settings, merged over the defaults.
    this.image = { dataUrl: null, fit: 'cover', rotation: 0, ...imageFilterDefaults, ...options.image };
    this.video = { dataUrl: null, fit: 'cover', rotation: 0, ...videoSettingDefaults, ...options.video };
    // DOM refs per media type ('image'/'video'), filled in by buildMediaPanel.
    this.mediaRefs = { image: null, video: null };

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
    // CSS `background-image` can't show a <video>, so the video source gets its own live element.
    const swatchVideo = this.swatchVideo = Filler.el('video', { className: classes.swatchVideo, hidden: true });
    const swatch = this.swatch = Filler.el('button', { type: 'button', className: classes.swatch });
    swatch.append(swatchColor, swatchColorOpaque, swatchVideo);
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
    // Image/video mode has no hex value to select or type — open the dialog instead of the dropdown.
    el.addEventListener('focus', () => {
      if (this.source !== 'solid') {
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

    // Pasting or dropping an image/video onto the swatch switches straight to that mode with it loaded.
    swatch.addEventListener('paste', (event) => this.handleSwatchMediaData(event.clipboardData));
    swatch.addEventListener('dragover', (event) => {
      if (!this.disabled) {
        event.preventDefault();
      }
    });
    swatch.addEventListener('drop', (event) => {
      event.preventDefault();
      this.handleSwatchMediaData(event.dataTransfer);
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

  handleSwatchMediaData(dataTransfer) {
    if (this.disabled || !dataTransfer) {
      return;
    }

    const imageFile = this.sources.includes('image') ? Filler.extractMediaFile(dataTransfer, 'image/') : null;
    const videoFile = !imageFile && this.sources.includes('video') ? Filler.extractMediaFile(dataTransfer, 'video/') : null;
    const file = imageFile || videoFile;
    if (!file) {
      return;
    }

    const type = imageFile ? 'image' : 'video';
    this.setSource(type);
    this.openDialog();
    this.handleMediaUpload(type, file);
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
        suffix.removeEventListener('pointercancel', onUp);
      };

      suffix.addEventListener('pointermove', onMove);
      suffix.addEventListener('pointerup', onUp);
      // "pointerup" can be skipped (capture aborted mid-gesture); "pointercancel" always fires, avoiding a listener leak on "suffix".
      suffix.addEventListener('pointercancel', onUp);
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
    if (this.source !== 'solid') {
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

  // Repaints the swatch/field for the active source: 'solid' paints hsva, 'image'/'video' shows the uploaded thumbnail.
  renderSwatch({ skipHexInput = false } = {}) {
    const { el, hsva, swatch, swatchColor, swatchColorOpaque, swatchVideo, labels } = this;
    const isImage = this.source === 'image';
    const isVideo = this.source === 'video';

    swatch.classList.toggle('is-image', isImage);
    swatch.classList.toggle('is-video', isVideo);
    el.classList.toggle('is-image-value', isImage || isVideo);
    el.readOnly = isImage || isVideo;

    if (isVideo) {
      const { dataUrl, fit, rotation } = this.video;
      if (!skipHexInput) {
        el.value = labels.videoSource;
      }

      swatchColor.style.backgroundColor = '';
      swatchColor.style.backgroundImage = '';

      if (dataUrl) {
        if (swatchVideo.getAttribute('src') !== dataUrl) {
          swatchVideo.src = dataUrl;
        }
      } else {
        swatchVideo.removeAttribute('src');
      }
      swatchVideo.hidden = !dataUrl;
      swatchVideo.style.objectFit = fit;
      swatchVideo.style.transform = `rotate(${rotation}deg)`;
      swatchVideo.style.opacity = hsva.a / 100;

      swatch.classList.remove('has-alpha');
      swatch.style.border = 'none';

      // Sets autoplay/loop/muted/... from `this.video` and starts/stops playback to match.
      this.applyVideoSettings('video');
      return;
    }

    swatchVideo.hidden = true;
    if (!swatchVideo.paused) {
      swatchVideo.pause();
    }

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

  // `host` is the light-DOM element attachFloating positions; `root` is its shadow tree — restyle it via `::part(<class-name>)`.
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

  // Scroll clamp targets `content` (panel's shadow root), not `panel`, so overflow clipping never eats its own box-shadow.
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

    // Deferred so the gesture that opened this panel (e.g. a focus-triggered open) isn't misread as an outside click.
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

    // Bookends the value fields — eyedropper before, copy after — hidden where the browser lacks EyeDropper.
    const eyedropperButton = this.dialogEyedropperButton = Filler.el('button', {
      type: 'button', className: classes.dialogEyedropper, title: this.labels.pickColor,
      innerHTML: Filler.EYEDROPPER_ICON, hidden: !window.EyeDropper,
    });
    eyedropperButton.addEventListener('click', () => this.pickWithEyeDropper());

    const copyButton = Filler.el('button', {
      type: 'button', className: classes.dialogCopy, title: this.labels.copyValue, textContent: '⧉',
    });
    copyButton.addEventListener('click', () => this.copyValue(copyButton));

    // renderDialogFields() rebuilds just this inner row on every format switch, leaving eyedropper/copy untouched.
    const fieldsValues = Filler.el('div', { className: classes.dialogFieldsValues });
    const fields = Filler.el('div', { className: classes.dialogFields });
    fields.append(eyedropperButton, fieldsValues, copyButton);

    const solidPanel = Filler.el('div', { className: classes.dialogSolid });
    solidPanel.append(area, hue, alpha, tabs, fields);

    const sourceButtons = this.buildSourceButtons();
    const imagePanel = this.buildMediaPanel('image');
    const videoPanel = this.buildMediaPanel('video');

    const { host, root: dialog } = this.createShadowPanel(classes.dialog);
    this.dialogHost = host;
    this.dialog = dialog;
    dialog.append(sourceButtons, solidPanel, imagePanel, videoPanel);

    Object.assign(this, {
      dialogArea: area,
      dialogAreaHandle: areaHandle,
      dialogHue: hue,
      dialogHueHandle: hueHandle,
      dialogAlpha: alpha,
      dialogAlphaGradient: alphaGradient,
      dialogAlphaHandle: alphaHandle,
      dialogTabs: tabs,
      dialogFields: fieldsValues,
      dialogFieldInputs: [],
      dialogSolidPanel: solidPanel,
      dialogImagePanel: imagePanel,
      dialogVideoPanel: videoPanel,
    });

    this.syncSourceUI();
  }

  // Dialog's top row: grouped source-type buttons on the left, close button on the right (always visible).
  buildSourceButtons() {
    const { classes } = this;
    const row = this.dialogSources = Filler.el('div', { className: classes.dialogSources });
    const group = this.dialogSourcesGroup = Filler.el('div', { className: classes.dialogSourcesGroup });

    this.dialogSourceButtons = {};
    ['solid', 'image', 'video'].forEach((type) => {
      const button = Filler.el('button', {
        type: 'button', className: classes.dialogSource, innerHTML: Filler.SOURCE_ICONS[type],
      });
      button.addEventListener('click', () => this.setSource(type));

      this.dialogSourceButtons[type] = button;
      group.appendChild(button);
    });

    const closeButton = this.dialogCloseButton = Filler.el('button', {
      type: 'button', className: classes.dialogClose, title: this.labels.closeDialog, textContent: '×',
    });
    closeButton.addEventListener('click', () => this.closeDialog());

    row.append(group, closeButton);

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
    dialogSourceButtons.video.title = labels.videoSource;
  }

  setSource(type) {
    if (this.disabled || type === this.source || !this.sources.includes(type)) {
      return;
    }
    this.source = type;
    this.syncSourceUI();
    this.renderSwatch();
    this.onSourceChange?.(type);
  }

  // Shows/hides the source buttons and solid/image/video panels for the current `sources` and `source`.
  syncSourceUI() {
    const { dialogSourcesGroup, dialogSourceButtons, dialogSolidPanel, dialogImagePanel, dialogVideoPanel, sources, source } = this;
    if (!dialogSourcesGroup) {
      return;
    }

    Object.entries(dialogSourceButtons).forEach(([type, button]) => {
      button.hidden = !sources.includes(type);
      button.classList.toggle('is-active', type === source);
    });

    dialogSolidPanel.hidden = source !== 'solid';
    dialogImagePanel.hidden = source !== 'image';
    dialogVideoPanel.hidden = source !== 'video';
  }

  // The 'Image'/'Video' panel: object-fit + rotate toolbar, upload field, plus a type-specific settings section.
  buildMediaPanel(type) {
    const { classes, labels } = this;
    const { tag, accept, classKeys, labelKeys } = Filler.MEDIA[type];
    const cls = Object.fromEntries(Object.entries(classKeys).map(([k, classKey]) => [k, classes[classKey]]));
    const lbl = Object.fromEntries(Object.entries(labelKeys).map(([k, labelKey]) => [k, labels[labelKey]]));
    const media = this[type];

    const fitSelect = Filler.el('select', { className: cls.fit });
    Object.entries(labels.objectFit).forEach(([value, text]) => {
      fitSelect.appendChild(Filler.el('option', { value, textContent: text, selected: value === media.fit }));
    });
    fitSelect.addEventListener('change', () => {
      media.fit = fitSelect.value;
      this.renderMediaPreview(type);
    });

    const rotateButton = Filler.el('button', {
      type: 'button', className: cls.rotate, title: lbl.rotate, textContent: '⤾',
    });
    rotateButton.addEventListener('click', () => {
      media.rotation = (media.rotation + 90) % 360;
      this.renderMediaPreview(type);
    });

    const toolbar = Filler.el('div', { className: cls.toolbar });
    toolbar.append(fitSelect, rotateButton);

    const uploadInput = Filler.el('input', { type: 'file', accept, className: cls.uploadInput });
    uploadInput.addEventListener('change', () => this.handleMediaUpload(type, uploadInput.files?.[0]));

    // autoplay/loop/muted/... are applied from `this.video` by applyVideoSettings, not hardcoded here.
    const previewMedia = Filler.el(tag, { className: cls.previewMedia });

    const placeholder = Filler.el('span', { className: cls.placeholder, textContent: lbl.upload });
    const removeButton = Filler.el('button', {
      type: 'button', className: cls.remove, title: lbl.remove, textContent: '×',
    });
    removeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.clearMedia(type);
    });

    // Square, top-left (mirrors removeButton); shown on hover only once something's off default.
    const resetButton = Filler.el('button', {
      type: 'button', className: cls.reset, title: labels.resetAdjustments, textContent: '↺',
    });
    resetButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.resetMediaAdjustments(type);
    });

    const preview = Filler.el('span', { className: cls.preview });
    preview.append(previewMedia, placeholder, resetButton, removeButton);

    const upload = Filler.el('label', { className: cls.upload });
    upload.append(uploadInput, preview);

    this.mediaRefs[type] = { uploadInput, previewMedia, placeholder, upload, removeButton };

    const panel = Filler.el('div', { className: cls.panel });
    panel.append(toolbar, upload);
    panel.append(...(type === 'video' ? this.buildVideoSettings(type, cls, media) : this.buildFilterSliders(type, cls, media)));

    this.renderMediaPreview(type);
    this.syncMediaAdjustmentsState(type);

    return panel;
  }

  // Current position as a 0-1 fraction, kept as `--percent` for the pure-CSS fill to read.
  static setSliderPercent(input) {
    const min = +input.min;
    const max = +input.max;
    input.style.setProperty('--percent', (+input.value - min) / (max - min));
  }

  // The image panel's correction sliders — one per Filler.MEDIA_FILTERS entry; returns [title, list].
  buildFilterSliders(type, cls, media) {
    const { labels } = this;
    const slidersTitle = Filler.el('span', { className: cls.slidersTitle, textContent: labels.adjustments });
    const sliders = Filler.el('div', { className: cls.sliders });
    const sliderInputs = {};
    const sliderValues = {};

    Filler.MEDIA_FILTERS.forEach(({ key, min, max, step, default: def }) => {
      const displayUnit = Filler.filterDisplayUnit(key);
      // `part: false` — this repaints on every drag tick and isn't meant to be its own ::part().
      const valueEl = Filler.el('span', {
        className: cls.sliderValue, part: false, textContent: `${media[key]}${displayUnit}`,
      });
      const head = Filler.el('span', { className: cls.sliderHead });
      head.append(Filler.el('span', { className: cls.sliderLabel, textContent: labels.filters[key] }), valueEl);

      const input = Filler.el('input', {
        type: 'range', className: cls.sliderInput, min, max, step, value: media[key],
      });
      // Where the fill treats "center" — the filter's neutral value, not the track's midpoint; unitless 0-1.
      input.style.setProperty('--center', (def - min) / (max - min));
      Filler.setSliderPercent(input);
      input.addEventListener('input', () => {
        media[key] = +input.value;
        valueEl.textContent = `${input.value}${displayUnit}`;
        Filler.setSliderPercent(input);
        this.applyImageFilter();
        this.syncMediaAdjustmentsState(type);
      });
      sliderInputs[key] = input;
      sliderValues[key] = valueEl;

      const row = Filler.el('label', { className: cls.slider });
      row.append(head, input);
      sliders.appendChild(row);
    });

    Object.assign(this.mediaRefs[type], { sliderInputs, sliderValues });

    return [slidersTitle, sliders];
  }

  // The video panel's playback settings — one checkbox/select per Filler.VIDEO_SETTINGS entry; returns [title, list].
  buildVideoSettings(type, cls, media) {
    const { labels } = this;
    const settingsTitle = Filler.el('span', { className: cls.settingsTitle, textContent: labels.videoSettingsTitle });
    const settings = Filler.el('div', { className: cls.settings });
    const settingInputs = {};

    Filler.VIDEO_SETTINGS.forEach(({ key, type: controlType, options }) => {
      const row = Filler.el('label', { className: cls.setting });
      row.appendChild(Filler.el('span', { className: cls.settingLabel, textContent: labels.videoSettings[key] }));

      const onInput = (value) => {
        media[key] = value;
        this.applyVideoSettings(type);
        this.syncMediaAdjustmentsState(type);
      };

      let input;
      if (controlType === 'select') {
        input = Filler.el('select', { className: cls.settingInput });
        options.forEach((value) => {
          input.appendChild(Filler.el('option', {
            value, textContent: labels.videoPreload[value], selected: value === media[key],
          }));
        });
        input.addEventListener('change', () => onInput(input.value));
      } else {
        input = Filler.el('input', { type: 'checkbox', className: cls.settingInput, checked: media[key] });
        input.addEventListener('change', () => onInput(input.checked));
      }

      row.appendChild(input);
      settings.appendChild(row);
      settingInputs[key] = input;
    });

    Object.assign(this.mediaRefs[type], { settingInputs });

    return [settingsTitle, settings];
  }

  // Whether anything (filter sliders, or video settings) has moved off default; gates the reset button.
  hasMediaAdjustments(type) {
    const media = this[type];
    return type === 'video'
      ? Filler.VIDEO_SETTINGS.some(({ key, default: value }) => media[key] !== value)
      : Filler.MEDIA_FILTERS.some(({ key, default: value }) => media[key] !== value);
  }

  syncMediaAdjustmentsState(type) {
    this.mediaRefs[type].upload.classList.toggle('has-adjustments', this.hasMediaAdjustments(type));
  }

  handleMediaUpload(type, file) {
    const { accept } = Filler.MEDIA[type];
    if (!file || !file.type.startsWith(accept.replace('*', ''))) {
      return;
    }

    const media = this[type];
    const reader = new FileReader();
    reader.onload = () => {
      media.dataUrl = reader.result;
      media.rotation = 0;
      this.renderMediaPreview(type);
    };
    reader.readAsDataURL(file);
  }

  clearMedia(type) {
    const media = this[type];
    media.dataUrl = null;
    media.rotation = 0;
    this.mediaRefs[type].uploadInput.value = '';
    this.resetMediaAdjustments(type);
    this.renderMediaPreview(type);
  }

  // Restores every filter/setting to its default, Figma-style; the uploaded media itself is untouched.
  resetMediaAdjustments(type) {
    const media = this[type];

    if (type === 'video') {
      const { settingInputs } = this.mediaRefs[type];
      Filler.VIDEO_SETTINGS.forEach(({ key, type: controlType, default: value }) => {
        media[key] = value;
        if (controlType === 'select') {
          settingInputs[key].value = value;
        } else {
          settingInputs[key].checked = value;
        }
      });
      this.applyVideoSettings(type);
    } else {
      const { sliderInputs, sliderValues } = this.mediaRefs[type];
      Filler.MEDIA_FILTERS.forEach(({ key, default: value }) => {
        media[key] = value;

        const input = sliderInputs[key];
        input.value = value;
        Filler.setSliderPercent(input);
        sliderValues[key].textContent = `${value}${Filler.filterDisplayUnit(key)}`;
      });
    }

    this.syncMediaAdjustmentsState(type);
    this.renderSwatch();
  }

  // Repaints the upload field's preview/placeholder and the media element itself from `this[type]`.
  renderMediaPreview(type) {
    const { dataUrl, fit, rotation } = this[type];
    const { previewMedia, placeholder, upload, removeButton, sliderInputs } = this.mediaRefs[type];

    upload.classList.toggle('has-media', !!dataUrl);
    placeholder.hidden = !!dataUrl;
    removeButton.hidden = !dataUrl;
    previewMedia.hidden = !dataUrl;

    // Filter sliders stay inert until an image is loaded; video's playback settings don't touch pixels, so they stay usable regardless.
    if (sliderInputs) {
      Object.values(sliderInputs).forEach((input) => { input.disabled = !dataUrl; });
    }

    if (dataUrl) {
      // Guarded — re-assigning a <video>'s `src` to the same value restarts playback.
      if (previewMedia.getAttribute('src') !== dataUrl) {
        previewMedia.src = dataUrl;
      }
      previewMedia.style.objectFit = fit;
      previewMedia.style.transform = `rotate(${rotation}deg)`;
    } else {
      previewMedia.removeAttribute('src');
    }

    if (type === 'video') {
      this.applyVideoSettings(type);
    }

    // Also applies the image correction filter and, while this type is active, syncs the compact swatch.
    this.renderSwatch();
    this.onMediaChange?.(type, this[type]);
  }

  // Applies the computed CSS filter to the image dialog preview, and to the swatch while 'image' is active.
  applyImageFilter() {
    const filter = Filler.computeMediaFilter(this.image);
    const refs = this.mediaRefs.image;
    if (refs?.previewMedia) {
      refs.previewMedia.style.filter = filter;
    }
    if (this.source === 'image' && this.swatchColor) {
      this.swatchColor.style.filter = filter;
    }
  }

  // Applies playback settings from `this.video` and starts/stops playback, since setting the IDL properties alone doesn't restart an already-loaded <video>.
  applyVideoSettings(type) {
    const media = this[type];
    const refs = this.mediaRefs[type];

    const apply = (el) => {
      if (!el) {
        return;
      }
      el.loop = media.loop;
      el.muted = media.muted;
      el.controls = media.controls;
      el.playsInline = media.playsInline;
      el.autoplay = media.autoplay;

      if (!el.getAttribute('src')) {
        return;
      }
      if (media.autoplay) {
        el.play().catch(() => {});
      } else {
        el.pause();
      }
    };

    apply(refs?.previewMedia);
    if (this.source === type) {
      apply(this.swatchVideo);
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
        track.removeEventListener('pointercancel', onUp);
      };

      track.addEventListener('pointermove', onMove);
      track.addEventListener('pointerup', onUp);
      // See bindAlphaSuffixDrag() — "pointercancel" avoids leaking onMove/onUp onto this reused track.
      track.addEventListener('pointercancel', onUp);
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
        area.removeEventListener('pointercancel', onUp);
      };

      area.addEventListener('pointermove', onMove);
      area.addEventListener('pointerup', onUp);
      // See bindAlphaSuffixDrag() — "pointercancel" avoids leaking onMove/onUp onto this reused area.
      area.addEventListener('pointercancel', onUp);
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

    const rgb = Filler.hsvToRgb({ h, s, v });
    const rgbTriplet = `${Math.round(rgb.r)}, ${Math.round(rgb.g)}, ${Math.round(rgb.b)}`;
    dialogAreaHandle.style.left = `${s}%`;
    dialogAreaHandle.style.top = `${100 - v}%`;
    dialogAreaHandle.style.backgroundColor = `rgb(${rgbTriplet})`;

    // Unitless 0-1 fraction; CSS insets the actual `left` by half the handle's width so it stays inside the track at ratio 0/1.
    this.dialogHueHandle.style.setProperty('--percent', h / 360);

    this.dialogAlphaGradient.style.backgroundImage = `linear-gradient(to right, rgba(${rgbTriplet}, 0), rgba(${rgbTriplet}, 1))`;
    this.dialogAlphaHandle.style.setProperty('--percent', a / 100);

    this.updateDialogFieldValues();
  }

  // Applies an options patch to an already-mounted instance.
  update(options = {}) {
    // One-time constructor seeds; a caller like repeaterField()'s "fill" case echoes stale null/undefined values on every re-render, which would clobber this.image/this.video if reapplied here.
    const { image, video, source, alpha, ...rest } = options;

    const paletteChanged = 'palette' in options;
    const sourcesChanged = 'sources' in options;
    const labelsChanged = 'labels' in options;

    Object.assign(this, rest, {
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
      if (this.dialogCloseButton) {
        this.dialogCloseButton.title = this.labels.closeDialog;
      }
      if (this.source !== 'solid') {
        this.renderSwatch();
      }
    }
  }

  /**
   * Releases attachFloating's window/document listeners and detaches the floating panel.
   * Call before removing a filler's `<input>` from the DOM (e.g. control/repeater rebuilding a row), or it leaks.
   */
  destroy() {
    this.closeDialog();
    this.closeDropdown();
    clearTimeout(this.copyResetTimer);
  }
}

document.addEventListener('youla:init', ()=> {

  // Turns `<input type="text">` into a Figma-style fill field: swatch, HEX input, and a transparency field.
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
