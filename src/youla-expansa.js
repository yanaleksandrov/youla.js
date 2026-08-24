document.addEventListener('youla:init', ()=> {
  /**
   * Password policy: checks a string against a fixed policy (minimum count per character
   * class, minimum length) and can generate a password that already satisfies it.
   *
   * @since 1.0
   */
  Youla.data('password', () => ({
    value: '',
    visible: false,
    progress: 0,
    labels: ['Слишком слабый', 'Слабый', 'Средний', 'Хороший', 'Отличный'],
    min: {
      lowercase: 2,
      uppercase: 2,
      special: 2,
      digit: 2,
      length: 12
    },
    valid: {
      lowercase: false,
      uppercase: false,
      special: false,
      digit: false,
      length: false
    },
    charsets: {
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      special: '!@#$%^&*(){|}~',
      digit: '0123456789'
    },
    toggle() {
      this.visible = !this.visible;
    },
    level() {
      return Math.min(4, Math.round(this.progress / 25));
    },
    label() {
      return this.labels[this.level()];
    },
    check(value) {
      let matchCount = 0;
      // One point per character class plus one for the length rule — fixed, unlike the old
      // per-call total, which only counted the length rule's point when it passed. That let a
      // short password satisfying all 4 character classes read as 100% despite failing length.
      let totalWeight = Object.keys(this.charsets).reduce((sum, type) => sum + this.min[type], 0) + 1;

      for (const type in this.charsets) {
        let charsetRegex = new RegExp(`[${this.charsets[type]}]`, 'g');
        let charsetCount = (value.match(charsetRegex) || []).length;

        matchCount += Math.min(charsetCount, this.min[type]);
        this.valid[type] = charsetCount >= this.min[type];
      }

      this.valid.length = value.length >= this.min.length;
      if (this.valid.length) {
        matchCount += 1;
      }

      this.progress = (matchCount / totalWeight) * 100;

      return this.progress;
    },
    generate() {
      let pool = Object.values(this.charsets).join('');
      let password = '';

      for (const type in this.charsets) {
        for (let i = 0; i < this.min[type]; i++) {
          password += this.charsets[type][Math.floor(Math.random() * this.charsets[type].length)];
        }
      }

      while (password.length < this.min.length) {
        password += pool[Math.floor(Math.random() * pool.length)];
      }

      this.value = this.shuffle(password);
      this.check(this.value);

      return this.value;
    },
    shuffle(password) {
      let array = password.split('');

      for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }

      return array.join('');
    },
  }));

  /**
   * Avatar uploader.
   *
   * @since 1.0
   */
  Youla.data('avatar', () => ({
    name: '',
    image: '',
    field: {
      'v-prop': 'name',
    },
    picture: {
      ':title': 'name',
      ':style': "image && `background-image:url(${image})`",
    },
    initials: {
      'v-show': '!image',
      'v-text'() {
        return this.name.trim().split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase();
      },
    },
    uploader: {
      '@change'() {
        let file = this.$event.target.files[0];
        if (file) {
          let reader = new FileReader();
          reader.onload = e => this.image = e.target.result;
          reader.readAsDataURL(file);
        }
      },
    },
    remover: {
      'v-show': 'image',
      '@click'() {
        let input = this.$root.querySelector('input[type="file"]');
        if (input) {
          input.value = '';
        }
        this.image = '';
      },
    },
  }));

  /**
   * Table checkboxes
   *
   * @since 1.0
   */
  Youla.data('table', () => ({
    anchor: null,
    trigger: {
      '@change': 'selectAll($el, $root)',
    },
    item: {
      '@click': 'selectItem($el, $root, $event)',
    },
    items(root) {
      return [...root.querySelectorAll('[v-bind~="item"]')];
    },
    selectAll(el, root) {
      this.items(root).forEach(input => input.checked = el.checked);
    },
    selectItem(el, root, event) {
      let items   = this.items(root);
      let index   = items.indexOf(el);
      let checked = el.checked;
      let start   = event.shiftKey && this.anchor !== null ? this.anchor : index;

      for (let i = Math.min(start, index); i <= Math.max(start, index); i++) {
        items[i].checked = checked;
      }
      this.anchor = index;
    },
  }));

  /**
   * Code syntax highlight
   *
   * @since 1.0
   */
  Youla.directive('highlight', (el, output, { modifiers }) => {
    const lang    = modifiers[0] || 'html';
    const wrapper = document.createElement('code');

    wrapper.className  = `language-${lang}`;
    wrapper.innerHTML  = el.innerHTML;

    el.classList.add('line-numbers');
    el.setAttribute('data-lang', lang.toUpperCase());
    el.replaceChildren(wrapper);
  });

  /**
   * Disable autofill, reliably — the readonly-until-focus trick stops
   * autofill from prefilling the field before the user interacts with it,
   * even when the browser ignores `autocomplete="off"`.
   *
   * @since 1.0
   */
  Youla.directive('noautofill', (el) => {
    const lock = () => el.readOnly = true;

    lock();

    el.addEventListener('focus', () => requestAnimationFrame(() => el.readOnly = false));
    el.addEventListener('blur', lock);
  });

  /**
   * Pins a sidebar in place while its `position: relative` parent scrolls
   * past, keeping it inside the parent's own bounds rather than just
   * sticking to the viewport — for a sidebar taller than the viewport, it
   * scrolls internally instead of overflowing off the top or bottom.
   *
   * @since 1.0
   */
  Youla.directive('sticky', el => {
    const parent = el.parentElement;
    if (getComputedStyle(parent).position !== 'relative') {
      console.warn('Youla.js: "v-sticky" requires its parent to have position: relative.');
      return;
    }

    const paddingTop    = parseInt(getComputedStyle(parent).paddingTop) + 42;
    const paddingBottom = parseInt(getComputedStyle(parent).paddingBottom);

    let top        = paddingTop;
    let lastScroll = window.scrollY;

    // Recomputed on every call (not cached) so a resize is picked up for free.
    const reposition = () => {
      const rect     = el.getBoundingClientRect();
      const overflow = rect.height - window.innerHeight;
      const delta    = window.scrollY - lastScroll;
      lastScroll     = window.scrollY;

      // Only slide while actually stuck — rect.top runs ahead of "top" both
      // before engaging (still in flow) and after releasing at the bottom.
      if (overflow <= 0 || rect.top > top) {
        return;
      }

      top = Math.min(paddingTop, Math.max(-overflow - paddingBottom, top - delta));
      el.style.top = `${top}px`;
    };

    el.style.position = 'sticky';
    el.style.top      = `${paddingTop}px`;

    ['load', 'scroll', 'resize'].forEach(event => window.addEventListener(event, reposition));
  });

  /**
   * Expands or collapses an element with a smooth slide animation, driven
   * by the directive's own truthiness (`v-collapse="open"`) rather than a
   * CSS class — so it works with any bound boolean expression.
   *
   * @since 1.0
   */
  Youla.directive('collapse', (el, output) => {
    const isOpen   = !!output;
    const duration = 200;
    const props    = ['height', 'paddingTop', 'paddingBottom', 'marginTop', 'marginBottom'];

    el.style.overflow = 'hidden';
    if (isOpen) {
      el.style.display = 'block';
    }

    const from = Object.fromEntries(props.map(prop => [prop, parseFloat(getComputedStyle(el)[prop])]));

    let start;
    function step(timestamp) {
      start ??= timestamp;

      const elapsed = Math.min(timestamp - start, duration);
      const ratio   = isOpen ? elapsed / duration : 1 - elapsed / duration;

      props.forEach(prop => el.style[prop] = `${from[prop] * ratio}px`);

      if (elapsed < duration) {
        requestAnimationFrame(step);
      } else {
        if (!isOpen) {
          el.style.display = 'none';
        }
        [...props, 'overflow'].forEach(prop => el.style[prop] = '');
      }
    }
    requestAnimationFrame(step);
  });

  /**
   * Grows a <textarea> to fit its content as the user types, up to a
   * maximum number of rows (`v-textarea="6"`) — past that, it stops
   * growing and scrolls internally instead.
   *
   * @since 1.0
   */
  Youla.directive('textarea', (el, output) => {
    if (el.tagName !== 'TEXTAREA') {
      return;
    }

    el.addEventListener('input', () => {
      const maxRows = parseInt(output) || 99;
      if (el.value.split(/\r\n|\r|\n/).length > maxRows) {
        return;
      }

      const border = parseInt(getComputedStyle(el).borderWidth) * 4;

      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight + border + 4}px`;
    });
  });

  /**
   * Animates a progress indicator into view once when it enters the viewport.
   * Sets `--youla-progress` and `--youla-progress-transition` CSS properties
   * based on `from.to` (both percentages) and the shared `<number><unit>`
   * duration modifier. Skips the transition when reduced motion is preferred.
   *
   * `to` can also come from the directive's bound value instead of the `to`
   * modifier — e.g. `v-progress.0.600ms="percent"` — in which case it's
   * reactive: once the initial reveal has played, every change to `percent`
   * transitions `--youla-progress` straight to the new value.
   *
   * @since 1.0
   */
  Youla.directive('progress', (el, output, { modifiers, duration, expression }) => {
    const [rawFrom = 0, rawTo = 100] = modifiers;

    const from = parseInt(rawFrom);

    const bound = expression !== '' && !isNaN(parseFloat(output));
    const to    = bound ? parseFloat(output) : parseInt(rawTo);

    if (isNaN(from) || isNaN(to)) {
      console.warn('Youla.js: "v-progress" requires numeric from/to modifiers as percentages (or a numeric bound value), e.g. v-progress.20.80.600ms.');
      return;
    }

    const start = Math.min(Math.max(from, 0), 100);
    const end   = Math.min(Math.max(to, 0), 100);

    const transitionDuration = duration ? `${duration.value}${duration.unit}` : '0ms';
    const reducedMotion      = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const apply = (percent, animate) => {
      if (animate && !reducedMotion()) {
        el.style.setProperty('--youla-progress-transition', `width ${transitionDuration}`);
      }
      el.style.setProperty('--youla-progress', `${percent}%`);
    };

    // Already revealed — this call is a reactive update to the bound value, not the initial mount.
    if (el._x_progress?.revealed) {
      el._x_progress.end = end;
      apply(end, true);
      return;
    }

    if (el._x_progress) {
      el._x_progress.end = end;
      return;
    }

    el._x_progress = { revealed: false, end };

    new IntersectionObserver(([entry], observer) => {
      if (!entry.isIntersecting) {
        return;
      }
      observer.unobserve(el);

      el._x_progress.revealed = true;

      el.style.setProperty('--youla-progress', `${start}%`);

      if (reducedMotion()) {
        apply(el._x_progress.end, false);
        return;
      }

      setTimeout(() => apply(el._x_progress.end, true), 500);
    }).observe(el);
  });

  /**
   * Adapter for SlimSelect — turns `<option>`s (with optional
   * data-image/data-icon/data-description attributes) and optgroups into
   * SlimSelect's data format. The directive's bound value, if given, is
   * parsed as JSON and merged into SlimSelect's settings. Requires
   * SlimSelect to be loaded; this project doesn't bundle it.
   *
   * @see   https://github.com/brianvoe/slim-select
   * @since 1.0
   */
  Youla.directive('select', (el, output) => {
    const settings = { showSearch: false, hideSelected: false, closeOnSelect: true };

    if (el.hasAttribute('multiple')) {
      settings.hideSelected  = true;
      settings.closeOnSelect = false;
    }

    Object.assign(settings, JSON.parse(output || '{}'));

    const data = Array.from(el.options).reduce((acc, option) => {
      const image       = option.getAttribute('data-image');
      const icon        = option.getAttribute('data-icon');
      const description = option.getAttribute('data-description') || '';

      const html =
        `${image ? `<img src="${image}" alt />` : ''}${icon ? `<i class="${icon}"></i>` : ''}` +
        `<span class="ss-text">${option.text}${description ? `<span class="ss-description">${description}</span>` : ''}</span>`;

      const optionData = {
        text: option.text, value: option.value, html, selected: option.selected,
        display: true, disabled: false, mandatory: false, placeholder: false,
        class: '', style: '', data: {},
      };

      if (option.parentElement.tagName === 'OPTGROUP') {
        const label = option.parentElement.getAttribute('label');
        let group   = acc.find(item => item.label === label);
        if (!group) {
          group = { label, options: [] };
          acc.push(group);
        }
        group.options.push(optionData);
      } else {
        acc.push(optionData);
      }
      return acc;
    }, []);

    try {
      new SlimSelect({ settings, select: el, data });
    } catch {
      console.error('Youla.js: "SlimSelect" is not defined — v-select requires SlimSelect to be loaded.');
    }
  });

  /**
   * Date picker with Datepicker.js
   *
   * @see     https://github.com/wwilsman/Datepicker.js
   * @since   1.0
   */
  Youla.directive('pickadate', (e, el) => options => {
    try {
      options = Object.assign( {}, {
        inline: true,
        multiple: false,
        ranged: true,
        time: true,
        lang: 'ru',
        months: 2,
        timeAmPm: false,
        within: false,
        without: false,
        yearRange: 5,
        weekStart: 1,
      }, options );

      new Datepicker(el,options);
    } catch (e) {
      console.error( 'Youla.js: "Datepicker" is not defined. Details: https:://github.com/text-mask/text-mask' );
    }
  });

  /**
   * Turns an element with a `data-src` audio URL into a click-to-play
   * widget: toggles playback, paints progress as a background gradient, and
   * can loop just a `data-start`–`data-end` slice instead of the whole file.
   * Playback is delegated through a single document-level click listener,
   * so any number of `v-listen` elements share it instead of each adding
   * their own.
   *
   * @since 1.0
   */
  const LISTEN_CLASS = 'listen-node';

  function listenInjectStyle() {
    if (document.getElementById('youla-listen-style')) {
      return;
    }
    const style = document.createElement('style');
    style.id = 'youla-listen-style';
    style.textContent = `
      .${LISTEN_CLASS} { display: inline-block; background: rgba(0, 0, 0, 0.05); padding: 1px 8px 2px; border-radius: 3px; cursor: pointer; }
      .${LISTEN_CLASS} i { font-size: 0.65em; border: 0.5em solid transparent; border-left: 0.75em solid; display: inline-block; margin: 0 2px 1px 0; }
      .${LISTEN_CLASS} i.playing { border: 0; border-left: 0.75em double; border-right: 0.5em solid transparent; height: 1em; }
    `;
    document.head.appendChild(style);
  }

  function listenPause(audio, icon) {
    audio.pause();
    audio.dataset.playing = 'false';
    icon.classList.remove('playing');
  }

  function listenPlay(audio, icon) {
    audio.dataset.playing = 'true';
    icon.classList.add('playing');
    audio.play();

    (function loop() {
      const frame   = requestAnimationFrame(loop);
      const percent = Math.min(((audio.currentTime - audio.start) * 100) / (audio.end - audio.start), 100);

      audio.parentElement.style.background = `linear-gradient(to right, rgba(0, 0, 0, 0.1) ${percent}%, rgba(0, 0, 0, 0.05) ${percent}%)`;

      if (audio.currentTime >= audio.end) {
        listenPause(audio, icon);
        cancelAnimationFrame(frame);
      }
    })();
  }

  document.addEventListener('click', e => {
    const node = e.target.closest(`.${LISTEN_CLASS}`);
    if (!node) {
      return;
    }

    const audio = node.querySelector('audio');
    const icon  = node.querySelector('i');

    audio.start = parseFloat(node.dataset.start) || 0;
    audio.end   = parseFloat(node.dataset.end) || audio.duration;

    if (audio.dataset.playing === 'true') {
      listenPause(audio, icon);
      return;
    }

    if (audio.currentTime < audio.start || audio.currentTime > audio.end) {
      audio.currentTime = audio.start;
    }
    listenPlay(audio, icon);
  });

  Youla.directive('listen', (el, output) => {
    if (!output) {
      return;
    }

    listenInjectStyle();

    const icon  = document.createElement('i');
    const audio = document.createElement('audio');

    audio.src = el.dataset.src;
    audio.dataset.playing = 'false';
    audio.addEventListener('ended', () => {
      listenPause(audio, icon);
      el.style.background = '';
    });

    el.classList.add(LISTEN_CLASS);
    el.prepend(icon);
    el.append(audio);
  });
});