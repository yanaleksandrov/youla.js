document.addEventListener('youla:init', ()=> {
  /**
   * Multi-step wizard: `v-step="condition"` marks a panel's completion
   * state from the bound expression; `$step` (one state machine per wizard
   * root, cached on the root element itself) drives navigation — `$step.goNext()`,
   * `$step.goBack()`, and the read-only helpers below. Registered as a
   * `Youla.variable()` rather than a `Youla.method()` — unlike most custom
   * methods, that makes it reachable from any expression (`v-show`,
   * `:attribute`, `v-text`), not just `@event` ones.
   *
   * Its state still lives outside the reactive data, though, so nothing
   * would otherwise mark a binding reading `$step` as dirty. `Youla.reactive()`
   * wraps the wizard object below for exactly that: writing `this.currentIndex`
   * (in `goto()`) or pushing onto `this.steps` (in `getStep()`) force-refreshes
   * the owning component on its own — see `Component#refresh(force)` and
   * `helpers.js#reactive`.
   *
   * The directive itself is the one exception: it mutates a step object
   * stashed directly on the element (`el._x_step`), which bypasses that
   * wrapper entirely (it's never read back through the wizard's own
   * properties), so it still force-refreshes by hand via `Youla.forceRefresh()`.
   *
   * @since 1.0
   */
  Youla.directive('step', (el, output, _, component) => {
    const wizard = getWizard(el, component);
    const step   = wizard.getStep(el);
    const isComplete = !!output;

    if (step.isComplete !== isComplete) {
      step.isComplete = isComplete;
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
   * Copy any string data to clipboard.
   *
   * Usage example: @click="$copy('Some text', ['is-copied', 'is-'])"
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
   * Selfie
   *
   * `$stream` (one instance per `v-data` root, cached on the root element
   * itself, like `$step`) wraps `getUserMedia` into a ready-made
   * preview → snapshot → canvas → image scenario. Registered as a
   * `Youla.variable()` rather than a `Youla.method()` — unlike most custom
   * methods, that makes `error` (and every other property here) reachable
   * from any expression (`v-show`, `:src`), not just `@event` ones.
   *
   * Its state still lives outside the reactive data, though, so nothing
   * would otherwise mark a binding reading it as dirty — `Youla.reactive()`
   * wraps the object below so writing `this.error` (in `requestStream()`)
   * force-refreshes the owning component on its own, the same way `$step`
   * relies on it for `this.currentIndex` and `this.steps`.
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
        // validation based on the field type
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
          // TODO: validate domains and subdomains
          // @see https://stackoverflow.com/questions/26093545/how-to-validate-domain-name-using-regex
          case 'domain':
            break;
        }

        // removing forbidden characters
        if ( exp ) {
          el.value = el.value.replace( exp, '' );
        }
      }
    } else if( mask === Object( mask ) ) {
      el.value = el.value.replace( mask, '' );
    }
    /**
     * Validation by mask.
     *
     * @see discussion //javascript.ru/forum/dom-window/82008-kak-preobrazovat-stroku-v-massiv.html
     */
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
          //var maskArr  = mask.match( /(\{[^\s]+\})|(\+)|([()])|(.)|(\s+)/g ),
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

        //console.log( maskArr );
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
   * Notifications system: a single `v-data="notice"` container, rendered once in
   * parts/footer.html, holds the real queue. `$notice` (registered below as a `Youla.variable()`
   * rather than a `Youla.method()`, so it's reachable from any expression — not just `@event`
   * ones) always resolves to *that* container's own reactive data, no matter which component the
   * calling expression happens to live in — so `$notice.info('Saved')` works from literally any
   * `v-data` on the page, not just from inside the notice container itself.
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
    // @mouseenter on the container: freezes every item's countdown where it stood, so hovering
    // in to read one doesn't lose the others to a timer race either.
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
    // @mouseleave: picks every countdown back up from where pause() froze it (including any
    // item that arrived while hovering and was never scheduled in the first place).
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

        // v-each only re-renders when "items" itself is reassigned (see toasts.html's demo for
        // the same pattern) — mutating a nested key in place never marks it as changed.
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

        // No per-item spinner markup here on purpose: it's a real inline <svg> in the template
        // (see parts/footer.html), animated in CSS off "duration" — a real DOM animation, unlike
        // a background-image SVG, can actually be paused (see the ":hover" rule in styles.scss).
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
});