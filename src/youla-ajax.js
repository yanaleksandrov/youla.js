document.addEventListener('youla:init', () => {
  const BYTES_IN_MB = 1048576;

  // Prefix for a non-absolute `route`; left blank, routes resolve relative to the page.
  Youla.baseURL ??= '';

  /**
   * Registers `$ajax(route, payload, onProgress, options)`. Dispatches an `ajax:${route}`
   * CustomEvent on `document` once the response arrives; an array `data` response is treated
   * as fragment instructions (see applyFragment). Calling again on the same element cancels
   * any request still in flight.
   *
   * @param {Event} e - Triggering event (unused).
   * @param {HTMLElement} el - Element `$ajax` was called on.
   * @returns {Function} `(route, payload?, onProgress?, options?) => Promise`
   */
  Youla.method('ajax', (e, el) => (route, payload, onProgress, options = {}) => {
    abortPrevious(el);

    const xhr = el.__ajax = new XMLHttpRequest();
    const url = /^https?:\/\//.test(route) ? route : Youla.baseURL + route;
    const done = toggleLoading(el);

    xhr.open((el.getAttribute('method') || (el.tagName === 'FORM' ? 'POST' : 'GET')).toUpperCase(), url);
    xhr.withCredentials = options.credentials ?? true;

    Object.entries(options.headers || {}).forEach(([name, value]) => xhr.setRequestHeader(name, value));

    // Regular sends and file uploads both funnel through the same normalizer.
    xhr.onloadstart = xhr.upload.onprogress = event => onProgress?.(readProgress(event, xhr));
    xhr.onloadend   = event => { onProgress?.(readProgress(event, xhr)); done(); };

    return new Promise((resolve, reject) => {
      xhr.__reject = reject;

      xhr.onerror = () => reject(new Error('Youla.js: "$ajax" network error.'));
      xhr.onload  = () => {
        const parsed = parseJSON(xhr.responseText);

        if (xhr.status < 200 || xhr.status >= 300) {
          reject(Object.assign(
            new Error(`Youla.js: "$ajax" failed with status ${xhr.status}.`),
            { status: xhr.status, data: parsed ?? xhr.responseText }
          ));
          return;
        }

        const data = parsed?.data ?? parsed ?? xhr.responseText;

        // A listener can override the resolution synchronously via "resolve"; otherwise it falls through below.
        let settled = false;
        const override = value => { settled = true; resolve(value); };

        try {
          document.dispatchEvent(new CustomEvent(`ajax:${route}`, {
            detail: { data, el, resolve: override },
            bubbles: true,
            // Allows the event to pass the shadow DOM barrier.
            composed: true,
            cancelable: true,
          }));

          if (Array.isArray(data)) {
            data.forEach(applyFragment);
          }
        } catch (error) {
          console.error('Youla.js: "$ajax" fragment handling failed.', error);
        }

        if (!settled) {
          resolve(data);
        }
      };

      xhr.send(buildRequestBody(el, payload));
    });
  });

  /**
   * Aborts and rejects the in-flight request (if any) tracked on "el", clearing its
   * handlers first so the abort doesn't toggle off the loading class for the new request.
   *
   * @param {HTMLElement} el - Element to check for a tracked request.
   * @returns {void}
   */
  function abortPrevious(el) {
    const xhr = el.__ajax;
    if (!xhr) {
      return;
    }

    xhr.onload = xhr.onerror = xhr.onloadstart = xhr.onloadend = xhr.upload.onprogress = null;
    xhr.abort();
    xhr.__reject?.(new DOMException('Superseded by a new "$ajax" call on the same element.', 'AbortError'));
  }

  /**
   * Toggles an `is-load` class on "el" and any `[type="submit"]` descendants.
   *
   * @param {HTMLElement} el - Element the request was made from.
   * @returns {Function} Call once the request settles to remove the class.
   */
  function toggleLoading(el) {
    const elements = [el, ...el.querySelectorAll('[type="submit"]')];

    elements.forEach(element => element.classList.add('is-load'));

    return () => elements.forEach(element => element.classList.remove('is-load'));
  }

  /**
   * Builds the request body from "el": every field for a `<form>`, or just "el" itself
   * otherwise. "payload"'s entries are appended last, on top of the field data.
   *
   * @param {HTMLElement} el - Form or field the request was made from.
   * @param {Object} [payload] - Extra key/value pairs to append.
   * @returns {FormData}
   */
  function buildRequestBody(el, payload) {
    const isForm   = el.tagName === 'FORM';
    const formData = isForm ? new FormData(el) : new FormData();

    if (!isForm && el.name) {
      if (el.type === 'file') {
        Array.from(el.files || []).forEach(file => formData.append(el.name, file));
      } else {
        formData.append(el.name, el.value);
      }
    }

    if (payload && typeof payload === 'object') {
      Object.entries(payload).forEach(([key, value]) => formData.append(key, value));
    }

    return formData;
  }

  /**
   * Normalizes an XHR upload/load event plus its XHR instance into the plain object passed
   * to `$ajax`'s `onProgress` callback.
   *
   * @param {ProgressEvent} event - Upload/load event ("loadstart", "progress", or "loadend").
   * @param {XMLHttpRequest} xhr - Request the event belongs to.
   * @returns {Object} `{ raw, json, blob, status, url, loaded, total, percent, start, progress, end }`.
   */
  function readProgress(event, xhr) {
    const { loaded = 0, total = 0, type } = event;
    const { responseText: raw = '', status = 0, responseURL: url = '' } = xhr;

    return {
      raw,
      json: parseJSON(raw),
      blob: new Blob([raw]),
      status,
      url,
      loaded: toMegabytes(loaded),
      total: toMegabytes(total),
      percent: total > 0 ? Math.round((loaded / total) * 100) : 0,
      start: type === 'loadstart',
      progress: type === 'progress',
      end: type === 'loadend',
    };
  }

  /**
   * Parses "text" as JSON, or returns null if it's empty or malformed.
   *
   * @param {string} text - Text to parse.
   * @returns {*} Parsed value, or null.
   */
  function parseJSON(text) {
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }

  /**
   * Converts a byte count to megabytes, rounded to 2 decimal places.
   *
   * @param {number} bytes - A size in bytes.
   * @returns {number} The equivalent size in megabytes.
   */
  function toMegabytes(bytes) {
    return Math.round(bytes / BYTES_IN_MB * 100) / 100;
  }

  /**
   * Applies one fragment instruction to every element matching "target". Each key names an
   * action, optionally suffixed with a `:delay` in ms (e.g. `"update:300"`). "target" is
   * optional for page-global actions ("notify", "redirect", "reload", "changeURL").
   *
   * @param {Object} item - `{ target?: string, [action: string]: * }`.
   * @returns {void}
   */
  function applyFragment(item) {
    const { target, ...actions } = item;
    const targets = target ? document.querySelectorAll(target) : [null];

    targets.forEach(target => {
      Object.entries(actions).forEach(([key, value]) => {
        const [action, delay] = key.split(':');

        setTimeout(() => runFragmentAction(action, target, value), Number(delay) || 0);
      });
    });
  }

  /**
   * Runs a single fragment action against "target". Unrecognized actions are silently ignored.
   *
   * @param {string} action - Action name, e.g. "update" or "classList.add".
   * @param {HTMLElement} target - Element the action applies to.
   * @param {*} value - Action's payload (shape depends on the action).
   * @returns {void}
   */
  function runFragmentAction(action, target, value) {
    switch (action) {
      case 'changeURL':
        window.history.pushState(null, '', value || '');
        break;
      case 'redirect':
        window.location = value || '';
        break;
      case 'reload':
        window.location.reload();
        break;
      case 'scrollTo':
        window.scrollBy({ top: target.getBoundingClientRect().top, behavior: 'smooth' });
        break;
      case 'scrollIntoView':
        target.scrollIntoView(value);
        break;
      case 'value':
        target.value = value || '';
        // Lets a v-prop-bound field pick up the change too.
        target.dispatchEvent(new Event('input', { bubbles: true }));
        break;
      case 'update':
        target.innerHTML = value || '';
        break;
      case 'replace':
        target.outerHTML = value || '';
        break;
      case 'remove':
        target.remove();
        break;
      case 'before':
      case 'prepend':
      case 'append':
      case 'after':
        target.insertAdjacentHTML({
          before: 'beforebegin',
          prepend: 'afterbegin',
          append: 'beforeend',
          after: 'afterend'
        }[action], value || '');
        break;
      case 'classList.add':
        target.classList.add(value || '');
        break;
      case 'classList.remove':
        target.classList.remove(value || '');
        break;
      case 'setAttribute': {
        const [name, attrValue] = value || [];
        if (name) {
          target.setAttribute(name, attrValue || '');
        }
        break;
      }
      case 'removeAttribute':
        target.removeAttribute(value || '');
        break;
      case 'notify':
        if (value) {
          document.dispatchEvent(new CustomEvent('ajax:notify', { detail: value, bubbles: true }));
        }
        break;
    }
  }
});
