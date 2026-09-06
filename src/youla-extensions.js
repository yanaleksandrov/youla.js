document.addEventListener('youla:init', ()=> {
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
   * Data sanitizing.
   *
   * @since 1.0
   */
  Youla.method('safe', () => ({
    slug(value) {
      return value
        .toString()                                                // Convert the input to a string
        .normalize('NFD')                                    // Normalize the string (separate characters and diacritical marks)
        .replace(/[\u0300-\u036f]/g, '')    // Remove diacritical marks
        .replace(/[^\p{L}\p{N}\s-]/gu, '')  // Remove everything except letters, numbers, spaces, and hyphens (Unicode support)
        .trim()                                                   // Trim leading and trailing whitespace
        .replace(/\s+/g, '-')               // Replace spaces with hyphens
        .replace(/-+/g, '-')                // Remove consecutive hyphens
        .toLowerCase();                                           // Convert the string to lowercase
    },
  }));

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
    // Validation by mask, see //javascript.ru/forum/dom-window/82008-kak-preobrazovat-stroku-u-massiv.html
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
      console.warn('Youla.js: "u-sticky" requires its parent to have position: relative.');
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
   * directive's truthiness (`u-collapse="open"`) rather than a CSS class.
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
   * maximum number of rows (`u-textarea="6"`) — past that, it stops
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
   * modifiers as percentages (`u-progress.20.80.600ms`). `to` can also be a reactive bound
   * value, e.g. `u-progress.0.600ms="percent"`. Skips the transition on reduced motion.
   *
   * @since 1.0
   */
  Youla.directive('progress', (el, output, { modifiers, duration, expression }) => {
    const [rawFrom = 0, rawTo = 100] = modifiers;

    const from = parseInt(rawFrom);

    const bound = expression !== '' && !isNaN(parseFloat(output));
    const to    = bound ? parseFloat(output) : parseInt(rawTo);

    if (isNaN(from) || isNaN(to)) {
      console.warn('Youla.js: "u-progress" requires numeric from/to modifiers as percentages (or a numeric bound value), e.g. u-progress.20.80.600ms.');
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
});