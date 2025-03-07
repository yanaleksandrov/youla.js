// TODO: create plugins system
import { directive } from '../directives';

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

directive('starter', (el, expression, attribute, x, component) => {

});
