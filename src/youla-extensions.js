document.addEventListener('youla:init', ()=> {
  /**
   * Multi-step wizard: `v-step="condition"` marks a panel's completion state; `$step`
   * (one state machine per wizard root) drives navigation via `goNext()`/`goBack()`. Registered
   * as a `Youla.variable()` so it's reachable from any expression, not just `@event` ones.
   *
   * @since 1.0
   */
  Youla.directive('step', (el, output, _, component) => {
    const wizard = getWizard(el, component);
    const step   = wizard.getStep(el);
    const isComplete = !!output;

    if (step.isComplete !== isComplete) {
      step.isComplete = isComplete;
      // step lives on el._x_step, outside the wizard's reactive wrapper, so refresh manually.
      Youla.forceRefresh(wizard.root);
    }
  });
  Youla.variable('step', (root, el) => getWizard(el, { root }));

  function getWizard(el, { root }) {
    if(!root._x_wizard) {
      root._x_wizard = Youla.reactive({
        root,
        steps: [],
        currentIndex: 0,
        progress() {
          const total   = this.steps.length;
          const current = Math.min(this.currentIndex + 1, total);

          let complete = 0;
          for(let index = 0; index < current; index++) {
            if(this.steps[index].isComplete) {
              complete++;
            }
          }
          return {
            total, complete, current,
            incomplete: total - complete,
            progress: `${Math.floor(current / total * 100)}%`,
            completion: `${Math.floor(complete / total * 100)}%`,
            percentage: Math.floor(complete / total * 100),
          };
        },
        stepAt(index) {
          return this.steps[index] || {
            el: null,
            title: null
          };
        },
        current() {
          return this.stepAt(this.currentIndex);
        },
        previous() {
          return this.stepAt(this.previousIndex());
        },
        next() {
          return this.stepAt(this.nextIndex());
        },
        previousIndex() {
          return this.currentIndex - 1 >= 0 ? this.currentIndex - 1 : null;
        },
        nextIndex() {
          return this.currentIndex + 1 < this.steps.length ? this.currentIndex + 1 : null;
        },
        isStep(index) {
          return Array.isArray(index) ? index.includes(this.currentIndex) : index === this.currentIndex;
        },
        isFirst() {
          return this.previousIndex() === null;
        },
        isNotFirst() {
          return !this.isFirst();
        },
        isLast() {
          return this.nextIndex() === null;
        },
        isNotLast() {
          return !this.isLast();
        },
        isCompleted() {
          return this.current().isComplete && this.nextIndex() === null;
        },
        isUncompleted() {
          return !this.isCompleted();
        },
        canGoNext() {
          return this.current().isComplete && this.nextIndex() !== null;
        },
        cannotGoNext() {
          return !this.canGoNext();
        },
        canGoBack() {
          return this.previousIndex() !== null;
        },
        cannotGoBack() {
          return !this.canGoBack();
        },
        getState() {
          return {
            currentIndex: this.currentIndex,
            isFirst: this.isFirst(),
            isNotFirst: this.isNotFirst(),
            isLast: this.isLast(),
            isNotLast: this.isNotLast(),
            canGoBack: this.canGoBack(),
            cannotGoBack: this.cannotGoBack(),
            canGoNext: this.canGoNext(),
            cannotGoNext: this.cannotGoNext(),
            isCompleted: this.isCompleted(),
            isUncompleted: this.isUncompleted(),
            progress: this.progress(),
          };
        },
        goNext() {
          this.goto(this.nextIndex());
        },
        goBack() {
          this.goto(this.previousIndex());
        },
        goto(index) {
          if(index !== null && this.steps[index] !== void 0) {
            this.currentIndex = index;
          }
          this.render();
          return this.current();
        },
        render() {
          this.steps.forEach((step, index) => {
            const isHidden = index !== this.currentIndex;
            if(step.el.hidden !== isHidden) {
              step.el.hidden = isHidden;
            }
          });
        },
        getStep(el) {
          let step = el._x_step;
          if(!step) {
            step = el._x_step = { el, title: '', isComplete: true };

            this.steps.push(step);
            this.render();
          }
          return step;
        },
      }, root);
    }
    return root._x_wizard;
  }

  /**
   * Copies a string to the clipboard, e.g. `@click="$copy('Some text', ['is-copied'])"`.
   *
   * @since 1.0
   */
  Youla.method('copy', (e, el) => (subject, classes) => {
    window.navigator.clipboard.writeText(subject).then(() => {
      const classes       = classes || ['ph-copy', 'ph-check'];
      const classesToggle = () => classes.forEach(s => el.classList.toggle(s));

      classesToggle();
      setTimeout(classesToggle, 1000);
    });
  });

  /**
   * Selfie: `$stream` (one instance per `v-data` root) wraps `getUserMedia` into a
   * preview -> snapshot -> canvas -> image flow. Registered as a `Youla.variable()` so its
   * properties are reachable from any expression, not just `@event` ones.
   *
   * @since 1.0
   */
  Youla.variable('stream', (root) => {
    if (!root._x_stream) {
      root._x_stream = Youla.reactive({
        error: null,
        canvas: null,
        get refs() {
          return {
            video:  root.querySelector('[v-ref="video"]'),
            image:  root.querySelector('[v-ref="image"]'),
            canvas: root.querySelector('[v-ref="canvas"]'),
          };
        },
        check() {
          const { video, image } = this.refs;

          if (!video) {
            console.error('Video for selfie preview is undefined');
            return false;
          }

          if (!image) {
            console.error('Image for output selfie is undefined');
            return false;
          }

          return true;
        },
        getCanvas() {
          return this.refs.canvas || (this.canvas || (this.canvas = document.createElement('canvas')));
        },
        isVisible(element) {
          const styles = window.getComputedStyle(element);
          if (styles) {
            return !(styles.visibility === 'hidden' || styles.display === 'none' || parseFloat(styles.opacity) === 0);
          }
          return false;
        },
        async requestStream(video) {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.error = 'unsupported';
            return;
          }

          try {
            video.srcObject = video._x_stream = await navigator.mediaDevices.getUserMedia({video: true});
            this.error = null;
          } catch (error) {
            this.error = error.name === 'NotAllowedError' || error.name === 'SecurityError' ? 'denied' : 'unavailable';
          }
        },
        start() {
          const video = this.refs.video;
          if (video._x_stream || video._x_streamObserver) {
            return;
          }

          if (this.isVisible(video)) {
            this.requestStream(video);
            return;
          }

          video._x_streamObserver = new IntersectionObserver(entries => {
            if (entries.some(entry => entry.isIntersecting) && this.isVisible(video)) {
              video._x_streamObserver.disconnect();
              video._x_streamObserver = null;
              this.requestStream(video);
            }
          });
          video._x_streamObserver.observe(video);
        },
        snap() {
          if (!this.check()) {
            return null;
          }
          this.start();

          const canvas = this.getCanvas();
          const { video, image } = this.refs;

          let imageStyles = window.getComputedStyle(image),
            targetRatio = parseInt(imageStyles.width, 10) / parseInt(imageStyles.height, 10);

          let videoWidth  = video.videoWidth,
            videoHeight = video.videoHeight,
            videoRatio  = videoWidth / videoHeight;

          let sWidth, sHeight;
          if (videoRatio > targetRatio) {
            sHeight = videoHeight;
            sWidth  = videoHeight * targetRatio;
          } else {
            sWidth  = videoWidth;
            sHeight = videoWidth / targetRatio;
          }

          let sx = (videoWidth - sWidth) / 2,
            sy = (videoHeight - sHeight) / 2;

          canvas.width  = sWidth;
          canvas.height = sHeight;

          let ctx = canvas.getContext('2d');

          // 1:1 pixel copy of the native camera resolution — no resampling, so no quality is lost
          ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

          let imageData = canvas.toDataURL('image/png');
          if ( imageData ) {
            image.src = imageData;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
          }
          return imageData;
        },
        stop() {
          const video = this.refs.video;
          if (video._x_streamObserver) {
            video._x_streamObserver.disconnect();
            video._x_streamObserver = null;
          }
          if (video._x_stream) {
            video._x_stream.getTracks().forEach(track => track.stop());
          }
          video._x_stream = null;
        },
      }, root);
    }
    return root._x_stream;
  });

  Youla.method('mask', (e, el) => mask =>  {
    if( typeof mask === 'undefined' ) {
      let type = el.getAttribute( 'type' );
      if( type ) {
        let exp = '';
        switch( type ) {
          case 'tel':
            exp = /[^ \-()+\d]/g;
            break;
          case 'number':
            exp = /[^.-\d]/g;
            break;
          case 'color':
            exp = /[^ a-zA-Z(),\d]/g;
            break;
          // TODO: validate domains and subdomains, see https://stackoverflow.com/questions/26093545
          case 'domain':
            break;
        }

        if ( exp ) {
          el.value = el.value.replace( exp, '' );
        }
      }
    } else if( mask === Object( mask ) ) {
      el.value = el.value.replace( mask, '' );
    }
    // Validation by mask, see //javascript.ru/forum/dom-window/82008-kak-preobrazovat-stroku-v-massiv.html
    else {
      try {
        function limit( position, symbol, max ) {
          let pos = position;

          max = max.toString();
          if( mask.charAt( --pos ) === symbol ) {
            if( el.value.charAt( pos ) === max.charAt(0) ) {
              return new RegExp( '[0-' + max.charAt(1) + ']' );
            } else {
              return /\d/;
            }
          }
          return new RegExp( '[0-' + max.charAt(0) + ']' );
        }

        let maskArr  = mask.match( /(\{[^}]+?\})|(.)/g ),
          position = -1;
        maskArr = maskArr.map( symbol => {
          ++position;
          switch( symbol ) {
            case 'i':
              return limit( position, symbol, 59 );
            case 'H':
              return limit( position, symbol, 23 );
            case 'D':
              return limit( position, symbol, 31 );
            case 'M':
              return limit( position, symbol, 12 );
            case 'Y': case '0':
              return /\d/;
            default:
              if( /\{[^}]+?\}/.test( symbol ) ) {
                return new RegExp( symbol.slice( 2, -2 ) );
              }
              return symbol;
          }
        });

        vanillaTextMask.maskInput({
          inputElement: el,
          guide: false,
          mask: maskArr,
        });
      } catch( e ) {
        console.error( 'Youla.js: "vanillaTextMask" is not defined. Details: https:://github.com/text-mask/text-mask' );
      }
    }
  });

  /**
   * An accessible dialog window: modal, alert, dialog, popup
   *
   * @since 1.0
   */
  Youla.method('modal', (e, el) => {
    return {
      open: (id, animation) => {
        setTimeout( () => {
          let modal = document.getElementById(id);
          if( modal ) {
            modal.classList.add('is-active', animation || 'fade');
          }
          document.body.style.overflow = 'hidden';
        }, 25 );
      },
      close: animation => {
        let modal = el.closest( '.modal' );
        if( modal !== null && modal.classList.contains( 'is-active' ) ) {
          modal.classList.remove('is-active', animation || 'fade');
          document.body.style.overflow = '';
        }
      }
    }
  });

  /**
   * Notifications system: a single `v-data="notice"` container (parts/footer.html) holds
   * the queue. `$notice` always resolves to that container's data, so `$notice.info('Saved')`
   * works from any `v-data` on the page.
   *
   * @since 1.0
   */
  Youla.variable('notice', () => document.querySelector('[v-data="notice"]')?.__x?.data);

  Youla.data('notice', () => ({
    items: {},
    duration: 7000,
    hovering: false,
    info( message ) {
      this.add( message, 'info' );
    },
    success( message ) {
      this.add( message, 'success' );
    },
    warning( message ) {
      this.add( message, 'warning' );
    },
    error( message ) {
      this.add( message, 'error' );
    },
    loading( message ) {
      this.add( message, 'loading' );
    },
    // @mouseenter on the container: freezes every item's countdown where it stood.
    pause() {
      this.hovering = true;

      Object.values(this.items).forEach(item => {
        if ( item.timer ) {
          clearTimeout( item.timer );
          item.timer     = null;
          item.remaining = Math.max( 0, item.remaining - ( Date.now() - item.startedAt ) );
        }
      });
    },
    // @mouseleave: picks every countdown back up from where pause() froze it.
    resume() {
      this.hovering = false;

      Object.keys(this.items).forEach( id => this.schedule(id) );
    },
    schedule( id ) {
      let item = this.items[id];
      if ( item && !item.timer ) {
        item.startedAt = Date.now();
        item.timer     = setTimeout( () => this.close(id), item.remaining );
      }
    },
    elapsed( item ) {
      return ( item.duration - item.remaining ) + ( item.timer ? Date.now() - item.startedAt : 0 );
    },
    close( id ) {
      let item = this.items[id];
      if ( typeof item !== 'undefined' ) {
        clearTimeout( item.timer );

        // v-each only re-renders when "items" itself is reassigned, not on a mutated nested key.
        this.items = { ...this.items, [id]: { ...item, selectors: [ ...item.selectors, 'hide' ] } };

        setTimeout( () => {
          let { [id]: omit, ...rest } = this.items;
          this.items = rest;
        }, 1000 )
      }
    },
    add( message, type ) {
      if ( message ) {
        let timestamp = Date.now();

        // Spinner is a real inline <svg> (parts/footer.html), animated via CSS, so it can be paused on :hover.
        this.items = { ...this.items, [timestamp]: {
          message: message,
          closable: true,
          selectors: [ type || 'info' ],
          duration: this.duration,
          remaining: this.duration,
          startedAt: Date.now(),
          timer: null,
          classes() {
            return this.selectors.map( x => 'notice__item--' + x ).join(' ')
          },
        } };

        if ( !this.hovering ) {
          this.schedule(timestamp);
        }
      }
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

    wrapper.className = `language-${lang}`;
    wrapper.append(...el.childNodes);

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
   * Pins a sidebar within its `position: relative` parent's bounds as it scrolls, instead
   * of sticking to the viewport — a taller-than-viewport sidebar scrolls internally.
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

      // Only slide while actually stuck — rect.top runs ahead of "top" otherwise.
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
   * Expands or collapses an element with a smooth slide animation, driven by the
   * directive's truthiness (`v-collapse="open"`) rather than a CSS class.
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
   * Animates `--youla-progress` into view once the element enters the viewport, from/to
   * modifiers as percentages (`v-progress.20.80.600ms`). `to` can also be a reactive bound
   * value, e.g. `v-progress.0.600ms="percent"`. Skips the transition on reduced motion.
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
   * Adapter for SlimSelect — turns `<option>`s (with optional data-image/data-icon/
   * data-description) and optgroups into SlimSelect's data format. Requires SlimSelect to
   * be loaded; this project doesn't bundle it.
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
});