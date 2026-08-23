document.addEventListener('youla:init', ()=> {
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
   * @since 1.0
   */
  let stream = null;
  Youla.method('stream', () => {
    return {
      check(refs) {
        let canvas = refs.canvas,
          video  = refs.video,
          image  = refs.image;

        if (!canvas) {
          console.error('Canvas element is undefined');
          return false;
        }

        if (!video) {
          console.error('Video for selfie preview is undefined');
          return false;
        }

        if (!image) {
          console.error('Image for output selfie is undefined');
          return false;
        }
      },
      isVisible(element) {
        const styles = window.getComputedStyle(element);
        if (styles) {
          return !(styles.visibility === 'hidden' || styles.display === 'none' || parseFloat(styles.opacity) === 0);
        }
        return false;
      },
      start(refs) {
        let video = refs.video;
        const observer = new MutationObserver( mutations => {
          for (let mutation of mutations) {
            if (mutation.target === document.body && !stream ) {
              setTimeout(async () => {
                if (this.isVisible(video)) {
                  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                    video.srcObject = stream = await navigator.mediaDevices.getUserMedia({video: true});
                  } else {
                    console.error('The browser does not support the getUserMedia API');
                  }
                }
              }, 500);
            }
          }
        });
        observer.observe(document, {childList: true,subtree: true,attributes: true});
      },
      snapshot(refs) {
        this.check(refs);
        this.start(refs);

        let canvas = refs.canvas,
          video  = refs.video,
          image  = refs.image;

        let width  = video.offsetWidth,
          height = video.offsetHeight;

        let imageStyles = window.getComputedStyle(image),
          imageWidth  = parseInt(imageStyles.width, 10),
          imageHeight = parseInt(imageStyles.height, 10);

        canvas.width  = imageWidth;
        canvas.height = imageHeight;

        let offsetTop  = ( height - imageHeight ) / 2,
          offsetLeft = ( width - imageWidth ) / 2;

        let ctx = canvas.getContext('2d');

        ctx.imageSmoothingQuality = 'low';

        //let scale = height / imageHeight;
        //console.log((offsetTop + offsetLeft) / 2)
        //ctx.drawImage(video, 0, 0, width * 2, height * 2, 0, 0, width, height);
        //ctx.drawImage(video, 0, 0, imageWidth, imageHeight);
        ctx.drawImage(video, offsetLeft * 1.5, offsetTop * 1.5, height * 1.5, height * 1.5, 0, 0, imageWidth, imageHeight);

        let imageData = canvas.toDataURL('image/png');
        if ( imageData ) {
          image.src = imageData;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        return imageData;
      },
      stop() {
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        stream = null;
      }
    }
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