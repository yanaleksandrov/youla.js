import { directive } from './scripts/directives';
import { method } from './scripts/methods';
import { data } from './scripts/data';
import { store } from './scripts/store';
import { pulsate } from './scripts/utils';
import { extend } from './scripts/extensions';
import { reactive, effect } from './scripts/reactivity';

document.addEventListener('x:init', e=> {
  const x = e.detail.x;

  /**
   * Sticky sidebar
   *
   * @since 1.0
   */
  directive('sticky', (el, expression, attribute, x, component) => {
    let style = el.parentElement.currentStyle || window.getComputedStyle(el.parentElement);
    if (style.position !== 'relative') {
      return false;
    }

    let rect = el.getBoundingClientRect();
    let diff = rect.height - document.scrollingElement.offsetHeight;

    let paddingTop    = parseInt(style.paddingTop) + 42;
    let paddingBottom = parseInt(style.paddingBottom);

    let lastScroll  = 0;
    let bottomPoint = 0;
    let value       = 'top: ' + paddingTop + 'px';

    function calcPosition() {
      if ( diff > 0 ) {
        let y = document.scrollingElement.scrollTop;
        // scroll to down
        if ( window.scrollY > lastScroll ) {
          if (y > diff) {
            bottomPoint = ( diff * -1 - paddingBottom );

            value = 'top: ' + bottomPoint + 'px';
          } else {
            value = 'top: ' + ( y * -1 - paddingBottom ) + 'px';
          }
        } else {
          bottomPoint = bottomPoint + (lastScroll - window.scrollY);
          if (bottomPoint < paddingTop) {
            value = 'top: ' + bottomPoint + 'px';
          }
        }
      }
      el.setAttribute('style', 'position: sticky;' + value);

      lastScroll = window.scrollY;
    }

    ['load', 'scroll', 'resize'].forEach(event => window.addEventListener(event, () => calcPosition()));
  });

  /**
   * Disable autocomplete
   *
   * @since 1.0
   */
  directive('autocomplete', (el, expression, attribute, x, component) => {
    el.setAttribute('readonly', true);
    el.onfocus = () => setTimeout(() => el.removeAttribute('readonly'), 10);
    el.onblur  = () => el.setAttribute('readonly', true);
  });

  /**
   * Code syntax highlight
   *
   * @since 1.0
   */
  directive('highlight', (el, expression, {modifiers}, x, component) => {
    let lang    = modifiers[0] || 'html',
      wrapper = document.createElement('code');

    wrapper.classList.add('language-' + lang);
    wrapper.innerHTML = el.innerHTML;

    el.classList.add('line-numbers');
    el.innerHTML = '';
    el.setAttribute('data-lang', lang.toUpperCase());
    el.appendChild(wrapper);
  });

  /**
   * Allows to expand and collapse elements using smooth animations.
   *
   * @since 1.0
   */
  directive('collapse', (el, expression, attribute, x, component) => {
    function slide(el, isDown, duration) {

      if (typeof duration === 'undefined') duration = 200;
      if (typeof isDown === 'undefined') isDown = false;

      el.style.overflow = 'hidden';
      if (isDown) {
        el.style.display = 'block';
      }

      let elProperties = ['height', 'paddingTop', 'paddingBottom', 'marginTop', 'marginBottom'];
      let elStyles     = window.getComputedStyle(el);

      let {
        height,
        paddingTop,
        paddingBottom,
        marginTop,
        marginBottom
      } = elProperties.reduce((acc, prop) => (acc[prop] = parseFloat(elStyles[prop]), acc), {});

      let stepHeight        = height        / duration;
      let stepPaddingTop    = paddingTop    / duration;
      let stepPaddingBottom = paddingBottom / duration;
      let stepMarginTop     = marginTop     / duration;
      let stepMarginBottom  = marginBottom  / duration;

      let start;

      function step(timestamp) {
        if (start === undefined) {
          start = timestamp;
        }

        let elapsed = timestamp - start;

        el.style.height        = `${isDown ? stepHeight * elapsed : height - stepHeight * elapsed}px`;
        el.style.paddingTop    = `${isDown ? stepPaddingTop * elapsed : paddingTop - stepPaddingTop * elapsed}px`;
        el.style.paddingBottom = `${isDown ? stepPaddingBottom * elapsed : paddingBottom - stepPaddingBottom * elapsed}px`;
        el.style.marginTop     = `${isDown ? stepMarginTop * elapsed : marginTop - stepMarginTop * elapsed}px`;
        el.style.marginBottom  = `${isDown ? stepMarginBottom * elapsed : marginBottom - stepMarginBottom * elapsed}px`;

        if (elapsed >= duration) {
          [...elProperties, 'overflow'].forEach(prop => el.style[prop] = '');
          if (!isDown) {
            el.style.display = 'none';
          }
        } else {
          window.requestAnimationFrame(step);
        }
      }

      window.requestAnimationFrame(step);
    }

    slide(el, expression);
  });

  /**
   * Smooth scrolling to the anchor
   * TODO: придостижении верха страницы, удалять анкор, то же при загрузке старницы
   *
   * @since 1.0
   */
  directive('anchor', (el, expression, attribute, x, component) => {
    let hash   = window.location.hash.replace( '#', '' ),
      anchor = el.innerText.toLowerCase().replaceAll( ' ', '-' );

    // scroll when init page
    if ( hash && hash === anchor ) {
      el.scrollIntoView({
        behavior: 'smooth',
      })
    }

    // click for copy url with hash
    el.addEventListener( 'click', e => {
      e.preventDefault();
      window.location.hash = anchor;
      el.scrollIntoView({
        behavior: 'smooth',
      })
    }, false )

    // watch the appearance of an anchor on the page and automatically add it to url
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting || entry.intersectionRatio !== 1) {
          return;
        }
        window.location.hash = anchor;
      });
    }, {
      threshold: 1
    });
    observer.observe(el);
  });

  /**
   * Listen audio
   *
   * @since 1.0
   */
  directive('listen', (el, expression, attribute, x, component) => {
    if ( ! expression ) {
      return false;
    }

    let name = 'listen-node';

    function _play( aud, icn ) {
      icn.classList.add('playing');
      aud.play();
      aud.setAttribute( 'data-playing', "true" );
      aud.addEventListener('ended', function() {
        _pause( aud, icn );
        aud.parentNode.style.background = null;
        return false;
      });
    }

    function _pause( aud, icn ) {
      aud.pause();
      aud.setAttribute( 'data-playing', 'false' );
      icn.classList.remove('playing');
    }

    let aud, icn;
    let css = document.createElement('style');
    css.type = 'text/css';
    css.innerHTML = '.listen-node {display: inline-block; background:rgba(0, 0, 0, 0.05); padding: 1px 8px 2px; border-radius:3px; cursor: pointer;} .listen-node i {font-size: 0.65em; border: 0.5em solid transparent; border-left: 0.75em solid; display: inline-block; margin-right: 2px;margin-bottom: 1px;} .listen-node .playing { border: 0; border-left: 0.75em double; border-right: 0.5em solid transparent; height: 1em;}';
    document.getElementsByTagName('head')[0].appendChild(css);

    aud = document.createElement( 'audio' );
    icn = document.createElement( 'i' );

    aud.src = el.getAttribute( 'data-src' );
    aud.setAttribute( 'data-playing', 'false' );

    el.id = name + '-' + i;
    el.insertBefore( icn, el.firstChild );
    el.appendChild( aud );

    document.addEventListener('click', e => {
      let aud, elm, icn;
      if ( e.target.className === name ) {
        aud = e.target.children[1];
        elm = e.target;
        icn = e.target.children[0];
      }
      else if ( e.target.parentElement && e.target.parentElement.className === name ) {
        aud = e.target.parentElement.children[1];
        elm = e.target.parentElement;
        icn = e.target;
      }

      if (aud && elm && icn) {
        aud.srt = parseInt( elm.getAttribute( 'data-start' ) ) || 0;
        aud.end = parseInt( elm.getAttribute( 'data-end' ) ) || aud.duration;

        if ( aud && aud.getAttribute( 'data-playing' ) === 'false' ) {
          if ( aud.srt > aud.currentTime || aud.end < aud.currentTime ) {
            aud.currentTime = aud.srt;
          }
          _play( aud, icn );
        } else {
          _pause( aud, icn );
        }

        (function loop() {
          let d = requestAnimationFrame( loop );
          let percent = (((aud.currentTime - aud.srt) * 100) / (aud.end - aud.srt));
          percent = percent < 100 ? percent : 100;
          elm.style.background = 'linear-gradient(to right, rgba(0, 0, 0, 0.1)' + percent + '%, rgba(0, 0, 0, 0.05)' + percent + '%)';

          if ( aud.end < aud.currentTime ) {
            _pause( aud, icn );
            cancelAnimationFrame( d );
          }
        })();
      }
    });
  });

  /**
   * Automatically adjust the height of the textarea while typing.
   *
   * @since 1.0
   */
  directive('textarea', (el, expression, attribute, x, component) => {
    if ( 'TEXTAREA' !== el.tagName.toUpperCase() ) {
      return false;
    }
    el.addEventListener('input', () => {
      let max  = parseInt(expression) || 99,
        rows = parseInt( el.value.split( /\r|\r\n|\n/ ).length );
      if ( rows > max ) {
        return false;
      }

      let styles = getComputedStyle( el, null ),
        border = parseInt( styles.getPropertyValue( 'border-width' ) ) * 4;

      el.style.height = 'auto';
      el.style.height = ( el.scrollHeight + border + 4 ) + 'px';
    }, false );
  });

  /**
   * Tooltips
   *
   * @since 1.0
   */
  directive('tooltip', (el, expression, { modifiers }, x, component) => {
    let position, trigger;
    if (modifiers) {
      modifiers.forEach( modifier => {
        position = [ 'top', 'right', 'bottom', 'left' ].includes( modifier ) ? modifier : 'top';
        trigger  = [ 'hover', 'click' ].includes( modifier ) ? modifier : 'hover';
      });
    }

    if (position && trigger) {
      try {
        new Drooltip({
          element: el,
          trigger: trigger,
          position: position,
          background: '#fff',
          color: 'var(--grafema-dark)',
          animation: 'bounce',
          content: content || null,
          callback: null
        });
      } catch (e) {
        console.warn('You forgot to connect the library Drooltip.js');
      }
    }
  });

  /**
   * Progress bar
   *
   * @since 1.0
   */
  directive('progress', (el, expression, { modifiers }, x, component) => {
    new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if(entry.isIntersecting) {
          let [value = 100, from = 0, to = 100, duration = '0ms'] = modifiers;

          let start = parseInt(from) / parseInt(value) * 100;
          let end   = parseInt(to) / parseInt(value) * 100;

          if (start > end) {
            [ end, start ] = [ start, end ];
          }

          el.style.setProperty('--grafema-progress', ( start < 0 ? 0 : start ) + '%');
          setTimeout(() => {
            el.style.setProperty('--grafema-transition', ' width ' + duration);
            el.style.setProperty('--grafema-progress', ( end > 100 ? 100 : end ) + '%');
          }, 500)

          // apply progress just once
          observer.unobserve(el);
        }
      });
    }).observe(el);
  });

  /**
   * Advanced select dropdown based on SlimSelect library.
   *
   * @see   https://github.com/brianvoe/slim-select
   * @since 1.0
   */
  directive('select', (el, expression, attribute, x, component) => {
    const settings = {
      showSearch: false,
      hideSelected: false,
      closeOnSelect: true,
    }

    if (el.hasAttribute('multiple')) {
      settings.hideSelected  = true;
      settings.closeOnSelect = false;
    }

    const custom = JSON.parse(expression || '{}');
    if (typeof custom === 'object') {
      Object.assign(settings, custom);
    }

    try {
      new SlimSelect({
        settings,
        select: el,
        data: Array.from(el.options).reduce((acc, option) => {
          let image       = option.getAttribute('data-image'),
            icon        = option.getAttribute('data-icon'),
            description = option.getAttribute('data-description') || '';

          let images       = image ? `<img src="${image}" alt />` : '',
            icons        = icon ? `<i class="${icon}"></i>` : '',
            descriptions = description ? `<span class="ss-description">${description}</span>` : '',
            html         = `${images}${icons}<span class="ss-text">${option.text}${descriptions}</span>`;

          let optionData = {
            text: option.text,
            value: option.value,
            html: html,
            selected: option.selected,
            display: true,
            disabled: false,
            mandatory: false,
            placeholder: false,
            class: '',
            style: '',
            data: {}
          }

          if (option.parentElement.tagName === 'OPTGROUP') {
            const optgroupLabel = option.parentElement.getAttribute('label');
            const optgroup      = acc.find(item => item.label === optgroupLabel);
            if (optgroup) {
              optgroup.options.push(optionData);
            } else {
              acc.push({
                label: optgroupLabel,
                options: [optionData]
              });
            }
          } else {
            acc.push(optionData);
          }
          return acc;
        }, []),
      });
    } catch {
      console.error('The SlimSelect library is not connected');
    }
  });

  /**
   * Multistep
   *
   * @since 1.0
   * @see based on https://github.com/glhd/alpine-wizard
   */
  extend(
    () => directive('step', (el, expression, attribute, x, component) => {
      const wizard = getWizard(el, component);
      const step   = wizard.getStep(el);

      const evaluateCheck = () => [!!expression, {}];
      if (step) {
        [step.isComplete, step.errors] = evaluateCheck();

        effect(() => {
          //console.log(step)
          console.log('Current Index:', wizard.currentIndex);
          component.refresh();
        }, Object.keys(wizard));

        // if (step.isComplete) {
        //   wizard.currentIndex++
        // } else {
        //   wizard.currentIndex--
        // }
      }
    }),
    () => method('step', (e, el, component) => getWizard(el, component)),
  );
  let wizards   = new WeakMap();
  let getWizard = (el, {root}) => {
    if (!wizards.has(root)) {
      wizards.set(root, reactive({
        steps: [],
        currentIndex: 0,
        progress() {
          let current  = 0;
          let complete = 0;
          let total    = 0;
          for (let index = 0; index < this.steps.length; index++) {
            const step = this.steps[index];
            total++;
            if (index <= this.currentIndex) {
              current++;
            }
            if (index <= this.currentIndex && step.isComplete) {
              complete++;
            }
          }

          return {
            total,
            complete,
            current,
            incomplete: total - complete,
            progress: `${Math.floor(current / total * 100)}%`,
            completion: `${Math.floor(complete / total * 100)}%`,
            percentage: Math.floor(complete / total * 100)
          }
        },
        current() {
          return this.steps[this.currentIndex] || { el: null, title: null };
        },
        previous() {
          return this.steps[this.previousIndex()] || { el: null, title: null };
        },
        next() {
          return this.steps[this.nextIndex()] || { el: null, title: null };
        },
        previousIndex() {
          return findNextIndex(this.steps, this.currentIndex, -1);
        },
        nextIndex() {
          return findNextIndex(this.steps, this.currentIndex, 1);
        },
        isStep(index) {
          if (!Array.isArray(index)) {
            index = [index]
          }
          return index.includes(this.currentIndex);
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
        goNext() {
          this.goto(this.nextIndex());
        },
        canGoNext() {
          return this.current().isComplete && this.nextIndex() !== null;
        },
        cannotGoNext() {
          return !this.canGoNext();
        },
        goBack() {
          this.goto(this.previousIndex());
        },
        canGoBack() {
          return this.previousIndex() !== null;
        },
        cannotGoBack() {
          return !this.canGoBack();
        },
        goto(index) {
          if (index !== null && this.steps[index] !== void 0) {
            this.currentIndex = index;

            let action = this.steps[index].action || '';
            if (action) {
              this.steps[index].evaluate(action);
            }
          }
          return this.current();
        },
        getStep(el) {
          let step = this.steps.find(step => step.el === el);
          if (!step) {
            el.setAttribute('v-show', 'console.log($step.current());$step.current().el === $el');
            step = {
              el,
              title: '',
              isComplete: true,
              errors: {},
            }
            this.steps.push(step);
          }
          return step;
        }
      }));
    }
    return wizards.get(root);
  };
  let findNextIndex = (steps, current, direction = 1) => {
    for (let index = current + direction; index >= 0 && index < steps.length; index += direction) {
      if (steps[index]) {
        return index;
      }
    }
    return null;
  };

  /**
   * Date picker with Datepicker.js
   *
   * @see     https://github.com/wwilsman/Datepicker.js
   * @since   1.0
   */
  method('pickadate', (e, el) => options => {
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
      console.error( 'X.js: "Datepicker" is not defined. Details: https:://github.com/text-mask/text-mask' );
    }
  });

  /**
   * Copy any string data to clipboard.
   *
   * Usage example: @click="$copy('Some text', ['is-copied', 'is-'])"
   *
   * @since 1.0
   */
  method('copy', (e, el) => (subject, classes) => {
    window.navigator.clipboard.writeText(subject).then(() => {
      const classes       = classes || ['ph-copy', 'ph-check'];
      const classesToggle = () => classes.forEach(s => el.classList.toggle(s));

      classesToggle();
      setTimeout(classesToggle, 1000);
    });
  });

  /**
   * Countdown magic
   *
   * @since 1.0
   */
  let seconds = 0, isCountingDown = false;
  method('countdown', () => {
    return {
      start: (initialSeconds, processCallback, endCallback) => {
        if (isCountingDown) {
          return;
        }
        seconds = initialSeconds;
        isCountingDown = true;
        function countdown() {
          processCallback && processCallback(true);
          if (seconds === 0) {
            endCallback && endCallback(true);
            isCountingDown = false;
          } else {
            seconds--;
            setTimeout(countdown, 1000);
          }
        }
        countdown();
      },
      second: seconds,
    }
  });

  /**
   * Selfie
   *
   * @since 1.0
   */
  let stream = null;
  method('stream', () => {
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
  method('password', () => {
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

  method('mask', (e, el) => mask =>  {
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
        console.error( 'X.js: "vanillaTextMask" is not defined. Details: https:://github.com/text-mask/text-mask' );
      }
    }
  });

  /**
   * An accessible dialog window: modal, alert, dialog, popup
   *
   * @since 1.0
   */
  method('modal', (e, el) => {
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
  method( 'notice', (e, el) => {
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
  store('notice', {
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
  });










  /**
   * Counting time in four different units: seconds, minutes, hours and days.
   *
   * @since 1.0
   */
  data( 'timer', ( endDate, startDate ) => ({
    timer: null,
    end: endDate, // format: '2021-31-12T14:58:31+00:00'
    day:  '01',
    hour: '01',
    min:  '01',
    sec:  '01',
    init() {
      let start = startDate || new Date().valueOf(),
        end   = new Date( this.end ).valueOf();

      // if the start date is earlier than the end date
      if( start < end ) {
        // number of seconds between two dates
        let diff = Math.round( ( end - start ) / 1000 );

        let t = this;
        this.timer = pulsate(() => {
          t.day  = ( '0' + parseInt( diff / ( 60 * 60 * 24 ), 10 ) ).slice(-2);
          t.hour = ( '0' + parseInt( ( diff / ( 60 * 60 ) ) % 24, 10 ) ).slice(-2);
          t.min  = ( '0' + parseInt( ( diff / 60 ) % 60, 10 ) ).slice(-2);
          t.sec  = ( '0' + parseInt( diff % 60, 10 ) ).slice(-2);

          if( --diff < 0 ) {
            t.days = t.hour = t.min = t.sec = '00';
          }
        }, 1000, true);
      }
    },
  }));

  data('dropdown', () => ({
    open: false,
    toggle() {
      console.log(this)
      this.open = ! this.open
    },
  }))

  /**
   * Avatar
   *
   * @since 1.0
   */
  data('avatar', () => ({
    content: '',
    image: '',
    add(event, callback) {
      let file = event.target.files[0];
      if (file) {
        let reader = new FileReader();
        reader.onload = e => {
          this.image = e.target.result;
        };
        reader.readAsDataURL(file);
      }

      if (callback) {
        callback();
      }
    },
    remove() {
      let root  = this.$el.closest('[v-data]'),
        input = root && root.querySelector('input[type="file"]');
      if (input) {
        input.value = '';
      }
      this.image = '';
    },
    getInitials( string, letters = 2 ) {
      const wordArray = string.split(' ').slice( 0, letters );
      if ( wordArray.length >= 2 ) {
        return wordArray.reduce( ( accumulator, currentValue ) => `${accumulator}${currentValue[0].charAt(0)}`.toUpperCase(), '' );
      }
      return wordArray[0].charAt(0).toUpperCase();
    },
  }))

  /**
   * Custom fields builder.
   *
   * @since 1.0
   */
  data('builder', () => ({
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
  }))

  /**
   * Table checkboxes
   *
   * @since 1.0
   */
  data('table', () => ({
    init() {
      document.addEventListener( 'keydown', e => {
        let key = window.event ? event : e;
        if ( !!key.shiftKey ) {
          this.selection.shift = true;
        }
      });
      document.addEventListener( 'keyup', e => {
        let key = window.event ? event : e;
        if ( !key.shiftKey ) {
          this.selection.shift = false;
        }
      });
    },
    selection: {
      box: {},
      shift: false,
      addMore: true,
    },
    items: [],
    trigger: {
      ['@change']( e ) {
        let inputs = document.querySelectorAll( 'input[name="item[]"]' );
        if (inputs.length) {
          inputs.forEach(input => input.checked = e.target.checked);
        }
      },
    },
    switcher: {
      ['@click']( e ) {
        let checkboxes = document.querySelectorAll( 'input[name="item[]"]' );
        let nodeList   = Array.prototype.slice.call( document.getElementsByClassName( 'cb' ) );

        this.selection.addMore = !!e.target.checked;
        if ( this.selection.shift ) {
          this.selection.box[1] = nodeList.indexOf( e.target.parentNode );

          let i = this.selection.box[0],
            x = this.selection.box[1];

          if ( i > x ) {
            for ( ; x < i; x++ ) {
              checkboxes[x].checked = this.selection.addMore;
            }
          }
          if ( i < x ) {
            for ( ; i < x; i++ ) {
              checkboxes[i].checked = this.selection.addMore;
            }
          }
          this.selection.box[0] = undefined;
          this.selection.box[1] = undefined;
        } else {
          this.selection.box[0] = nodeList.indexOf( e.target.parentNode );
        }
      },
    }
  }))
});