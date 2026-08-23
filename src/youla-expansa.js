document.addEventListener('youla:init', ()=> {
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

    const start = Math.max(from, 0);
    const end   = Math.min(to, 100);

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
   * Multi-step wizard: `v-step="condition"` marks a panel's completion
   * state from the bound expression; `$step` (one state machine per wizard
   * root, via a WeakMap) drives navigation — `$step.goNext()`,
   * `$step.goBack()`, and the read-only helpers below. Panel visibility is
   * toggled directly here rather than through a `v-show` expression,
   * because `$step`'s methods (like any `Youla.method`) only reach `@event`
   * expressions, never `v-show`/`:attribute` ones.
   *
   * @since 1.0
   * @see based on https://github.com/glhd/alpine-wizard
   */
  Youla.directive('step', (el, output, attribute, component) => {
    const step = getWizard(el, component).getStep(el);

    step.isComplete = !!output;
    step.errors     = {};
  });
  Youla.method('step', (e, el, component) => getWizard(el, component));

  const wizards = new WeakMap();

  function getWizard(el, { root }) {
    if (!wizards.has(root)) {
      wizards.set(root, {
        steps: [],
        currentIndex: 0,
        progress() {
          let current = 0, complete = 0;
          const total = this.steps.length;

          this.steps.forEach((step, index) => {
            if (index <= this.currentIndex) {
              current++;
              if (step.isComplete) {
                complete++;
              }
            }
          });

          return {
            total, complete, current,
            incomplete: total - complete,
            progress: `${Math.floor(current / total * 100)}%`,
            completion: `${Math.floor(complete / total * 100)}%`,
            percentage: Math.floor(complete / total * 100),
          };
        },
        current()  { return this.steps[this.currentIndex] || { el: null, title: null }; },
        previous() { return this.steps[this.previousIndex()] || { el: null, title: null }; },
        next()     { return this.steps[this.nextIndex()] || { el: null, title: null }; },
        previousIndex() { return findNextIndex(this.steps, this.currentIndex, -1); },
        nextIndex()     { return findNextIndex(this.steps, this.currentIndex, 1); },
        isStep(index)   { return (Array.isArray(index) ? index : [index]).includes(this.currentIndex); },
        isFirst()       { return this.previousIndex() === null; },
        isNotFirst()    { return !this.isFirst(); },
        isLast()        { return this.nextIndex() === null; },
        isNotLast()     { return !this.isLast(); },
        isCompleted()   { return this.current().isComplete && this.nextIndex() === null; },
        isUncompleted() { return !this.isCompleted(); },
        canGoNext()     { return this.current().isComplete && this.nextIndex() !== null; },
        cannotGoNext()  { return !this.canGoNext(); },
        canGoBack()     { return this.previousIndex() !== null; },
        cannotGoBack()  { return !this.canGoBack(); },
        goNext() { this.goto(this.nextIndex()); },
        goBack() { this.goto(this.previousIndex()); },
        goto(index) {
          if (index !== null && this.steps[index] !== void 0) {
            this.currentIndex = index;
          }
          this.render();
          return this.current();
        },
        render() {
          this.steps.forEach((step, index) => {
            step.el.style.display = index === this.currentIndex ? '' : 'none';
          });
        },
        getStep(el) {
          let step = this.steps.find(step => step.el === el);
          if (!step) {
            step = { el, title: '', isComplete: true, errors: {} };
            this.steps.push(step);
            this.render();
          }
          return step;
        },
      });
    }
    return wizards.get(root);
  }

  function findNextIndex(steps, current, direction = 1) {
    for (let index = current + direction; index >= 0 && index < steps.length; index += direction) {
      if (steps[index]) {
        return index;
      }
    }
    return null;
  }

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
});