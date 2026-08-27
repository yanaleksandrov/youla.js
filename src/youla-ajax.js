document.addEventListener('youla:init', () => {
  const BYTES_IN_MB = 1048576;

  // Prefix for a non-absolute `route`, e.g. `Youla.baseURL = 'https://api.example.com'`
  // in your own `youla:init` listener. Left blank, routes resolve relative to the page.
  Youla.baseURL ??= '';

  /**
   * Registers `$ajax(route, payload, onProgress, options)`, Youla.js's request method.
   *
   * `route` is appended to `Youla.baseURL` unless already absolute, and also becomes the
   * `ajax:${route}` CustomEvent dispatched on `document` once the response arrives —
   * listeners can react to it or replace the value the returned promise resolves with.
   *
   * The response is parsed as JSON when possible, plain text otherwise. An object response
   * with a `data` property resolves as `data` instead of the whole object; if that `data` is
   * an array, each entry is treated as a fragment instruction that updates part of the page
   * (see applyFragment).
   *
   * The request body comes from the element `$ajax` was called on (see buildRequestBody): the
   * whole form for a `<form>`, or just that field otherwise. The element gets an `is-load`
   * class for the request's duration. The HTTP method defaults to `POST` for a `<form>` and
   * `GET` otherwise, unless a `method` attribute is set.
   *
   * Calling `$ajax` again on the same element cancels any request still in flight, so
   * overlapping responses can't apply out of order.
   *
   * @param {Event} e - The triggering event (unused; part of every method's call signature).
   * @param {HTMLElement} el - The element `$ajax` was called on.
   * @returns {Function} `(route: string, payload?: object, onProgress?: Function, options?: {headers?: Object, credentials?: boolean}) => Promise`
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

        // A listener overriding the resolution (see the "override" case in
        // the docs) settles it synchronously here; the fallback below only
        // fires if nothing did.
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
   * Aborts the in-flight request (if any) still tracked on "el" from a
   * previous `$ajax` call — clearing its handlers first so the abort
   * itself doesn't also toggle the loading class off for the new request
   * that's about to start, and rejecting its promise so it doesn't just
   * hang forever.
   *
   * @param {HTMLElement} el - The element to check for a tracked request.
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
   * Toggles an `is-load` class on "el" and any `[type="submit"]`
   * descendants for the lifetime of a request.
   *
   * @param {HTMLElement} el - The element the request was made from.
   * @returns {Function} Call with no arguments once the request settles, to remove the class again.
   */
  function toggleLoading(el) {
    const elements = [el, ...el.querySelectorAll('[type="submit"]')];

    elements.forEach(element => element.classList.add('is-load'));

    return () => elements.forEach(element => element.classList.remove('is-load'));
  }

  /**
   * Builds the request body from "el": every field for a `<form>`
   * (`FormData(form)` already includes file inputs, keyed by their `name`),
   * or just "el" itself otherwise — its value, or its selected files if
   * it's a lone `input[type="file"]`. "payload"'s own entries are appended
   * last, so they can add to (but not silently vanish behind) the field data.
   *
   * @param {HTMLElement} el - The form or field the request was made from.
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
   * Normalizes an XHR upload/load event plus its XHR instance into the
   * plain object passed to `$ajax`'s `onProgress` callback. "raw"/"json"/
   * "blob" read as empty/null/blank until the response body actually
   * arrives (the "loadend" tick).
   *
   * @param {ProgressEvent} event - The upload/load event ("loadstart", "progress", or "loadend").
   * @param {XMLHttpRequest} xhr - The request the event belongs to.
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
   * Parses "text" as JSON, or returns null if it's empty or malformed —
   * lets a response be treated as JSON when possible without a caller
   * having to guard every `$ajax` call with its own try/catch.
   *
   * @param {string} text - The text to parse.
   * @returns {*} The parsed value, or null.
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
   * Applies one fragment instruction — `{ target, "action:delay"?: value }`
   * — to every element matching the "target" selector: each of its own
   * keys names an action (optionally suffixed with a `:delay` in ms, e.g.
   * `"update:300"`) run against that element with "value". "target" is
   * optional — page-global actions ("notify", "redirect", "reload",
   * "changeURL") don't touch any element, so there's nothing to select and
   * the action just runs once against `null`.
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
   * Runs a single fragment action against "target". Unrecognized actions
   * are silently ignored, so an older client can safely receive an action
   * name a newer server started sending.
   *
   * @param {string} action - The action name, e.g. "update" or "classList.add".
   * @param {HTMLElement} target - The element the action applies to.
   * @param {*} value - The action's payload (shape depends on the action).
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
        // Lets a v-prop-bound field pick up the change too, instead of its
        // underlying data silently drifting out of sync with the DOM.
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
