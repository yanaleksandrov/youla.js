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
   * would otherwise mark a binding reading `$step` as dirty. Rather than
   * pushing that onto callers (a reactive property they must remember to
   * read and bump), `notify()` forces the owning component to re-run every
   * binding unconditionally — see `Component#refresh(force)` — whenever
   * navigation happens or a step's `isComplete` changes.
   *
   * @since 1.0
   */
  Youla.directive('step', (el, output, _, component) => {
    const wizard = getWizard(el, component);
    const step   = wizard.getStep(el);
    const isComplete = !!output;

    if (step.isComplete !== isComplete) {
      step.isComplete = isComplete;
      wizard.notify();
    }
  });
  Youla.variable('step', (root, el) => getWizard(el, { root }));

  function getWizard(el, { root }) {
    if(!root._x_wizard) {
      root._x_wizard = {
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
          this.notify();
          return this.current();
        },
        notify() {
          const root = this.root;
          setTimeout(() => {
            const component = root.__x;
            if(component) {
              component.refresh(true);
            }
          }, 0);
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
            this.notify();
          }
          return step;
        },
      };
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
   * would otherwise mark a binding reading it as dirty — `notify()` forces
   * the owning component to re-run every binding unconditionally whenever
   * `error` changes, the same way `$step` does.
   *
   * @since 1.0
   */
  Youla.variable('stream', (root) => {
    if (!root._x_stream) {
      root._x_stream = {
        root,
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
          console.log(this.$el);
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
        setError(error) {
          if (this.error !== error) {
            this.error = error;
            this.notify();
          }
        },
        async requestStream(video) {
          if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.setError('unsupported');
            return;
          }

          try {
            video.srcObject = video._x_stream = await navigator.mediaDevices.getUserMedia({video: true});
            this.setError(null);
          } catch (error) {
            this.setError(error.name === 'NotAllowedError' || error.name === 'SecurityError' ? 'denied' : 'unavailable');
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
        notify() {
          const root = this.root;
          setTimeout(() => {
            const component = root.__x;
            if (component) {
              component.refresh(true);
            }
          }, 0);
        },
      };
    }
    return root._x_stream;
  });

  /**
   * Password
   *
   * @since 1.0
   */
  Youla.method('password', () => {
    return {
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
      switch(value) {
        return !(!!value);
      },
      check(value) {
        let matchCount = 0;
        let totalCount = 0;

        for (const charset in this.charsets) {
          let requiredCount = this.min[charset],
            charsetRegex  = new RegExp(`[${this.charsets[charset]}]`, 'g'),
            charsetCount  = (value.match(charsetRegex) || []).length;

          matchCount += Math.min(charsetCount, requiredCount);
          totalCount += requiredCount;

          this.valid[charset] = charsetCount >= requiredCount;
        }

        if (value.length >= this.min.length) {
          matchCount += 1;
          totalCount += 1;
          this.valid.length = value.length >= this.min.length;
        }

        return Object.assign(
          {
            progress: totalCount === 0 ? totalCount : (matchCount / totalCount) * 100,
          },
          this.valid
        )
      },
      generate() {
        let password = '',
          types    = Object.keys(this.charsets);

        types.forEach(type => {
          let count   = Math.max(this.min[type], 0),
            charset = this.charsets[type];

          for (let i = 0; i < count; i++) {
            let randomIndex = Math.floor(Math.random() * charset.length);
            password += charset[randomIndex];
          }
        });

        while (password.length < this.min.length) {
          let randomIndex = Math.floor(Math.random() * types.length),
            charType    = types[randomIndex],
            charset     = this.charsets[charType],
            randomCharIndex = Math.floor(Math.random() * charset.length);
          password += charset[randomCharIndex];
        }
        this.check(password);

        return this.shuffle(password);
      },
      shuffle(password) {
        let array = password.split('');
        let currentIndex = array.length;
        let temporaryValue, randomIndex;

        while (currentIndex !== 0) {
          randomIndex = Math.floor(Math.random() * currentIndex);
          currentIndex -= 1;

          temporaryValue = array[currentIndex];
          array[currentIndex] = array[randomIndex];
          array[randomIndex] = temporaryValue;
        }

        return array.join('');
      },
    }
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
   * Notifications system
   *
   * @since 1.0
   */
  Youla.method( 'notice', (e, el) => {
    return {
      items: [],
      add(message) {
        this.items.push({ id: e.timeStamp, type: e.detail.type, message });
      },
      remove(notification) {
        console.log(notification)
        console.log(this.items)
        this.items = this.items.filter(i => i.id !== notification.id);
      },
    }
  })
  Youla.data('notice', () => ({
    items: {},
    duration: 4000,
    info( message ) {
      this.notify( message, 'info' );
    },
    success( message ) {
      this.notify( message, 'success' );
    },
    warning( message ) {
      this.notify( message, 'warning' );
    },
    error( message ) {
      this.notify( message, 'error' );
    },
    loading( message ) {
      this.notify( message, 'loading' );
    },
    close( id ) {
      if ( typeof this.items[id] !== 'undefined' ) {
        this.items[id].selectors.push( 'hide' );

        setTimeout( () => delete this.items[id], 1000 )
      }
    },
    add( message, type ) {
      if ( message ) {
        let animationName = Math.random().toString(36).replace(/[^a-z]+/g, '').substr(0, 5),
          timestamp     = Date.now();
        this.items[timestamp] = {
          anim: `url("data:image/svg+xml;charset=UTF-8,%3csvg width='24' height='24' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3cstyle%3ecircle %7b animation: ${this.duration}ms ${animationName} linear;%7d%40keyframes ${animationName} %7bfrom%7bstroke-dasharray:0 70%7dto%7bstroke-dasharray:70 0%7d%7d%3c/style%3e%3ccircle cx='12' cy='12' r='11' stroke='%23000' stroke-opacity='.2' stroke-width='2'/%3e%3c/svg%3e")`,
          message: message,
          closable: true,
          selectors: [ type || 'info' ],
          classes() {
            return this.selectors.map( x => 'notice__item--' + x ).join(' ')
          },
        }
        setTimeout( () => this.close(timestamp), this.duration );
      }
    },
  }));

  /**
   * Custom fields builder.
   *
   * @since 1.0
   */
  Youla.data('builder', () => ({
    default: {
      location: 'post',
      operator: '===',
      value: 'editor',
    },
    groups: [
      {
        rules: [
          {
            location: 'post_status',
            operator: '!=',
            value: 'contributor',
          },
        ]
      },
    ],
    addGroup() {
      let pattern = JSON.parse(JSON.stringify(this.default));
      this.groups.push({
        rules: [ pattern ]
      });
    },
    removeGroup(index) {
      this.groups.splice(index, 1);
    },
    addRule(key) {
      let pattern = JSON.parse(JSON.stringify(this.default));
      this.groups[key].rules.push(pattern);
    },
    removeRule(key,index) {
      this.groups[key].rules.splice(index, 1);
    },
    submit() {
      let groups = JSON.parse(JSON.stringify(this.groups));
      console.log(groups);
    },
  }));
});