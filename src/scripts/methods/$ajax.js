import { method } from '../methods';

const BYTES_IN_MB = 1048576;

/**
 * Registers `$ajax(url, options, callback)`, callable from any expression
 * (e.g. `@click="$ajax('/api/cart', {}, res => ...)"`). Submits the bound
 * element as form data — the whole form (including any file inputs) if it's
 * a `<form>`, or just that one field's value otherwise — toggles an
 * `is-load` class on the element and any `[type="submit"]` descendants
 * while the request is in flight, and invokes `callback` with a normalized
 * progress/response object (see onProgress) during upload and again once
 * the request completes.
 *
 * @param {Event} e - The triggering event (unused directly; part of every method's call signature).
 * @param {HTMLElement} el - The element `$ajax` was called on.
 * @returns {Function} `(url: string, options?: {headers?, credentials?}, callback?: Function) => Promise`
 */
method('ajax', (e, el) => (url, options = {}, callback) => {
  let tagName = el.tagName.toLowerCase(),
      method  = tagName === 'form' ? 'post' : 'get',
      data    = tagName === 'form' ? new FormData(el) : new FormData(),
      xhr     = new XMLHttpRequest();

  // fill formData in accordance with the type of fields
  switch (tagName) {
    case 'form':
      Array.from(el.querySelectorAll("input[type='file']")).forEach(input => {
        input.files && [...input.files].forEach(file => data.append(input.name, file));
      });
      break;
    case 'textarea':
    case 'select':
    case 'input':
      if (el.type === 'file' && el.files) {
        Array.from(el.files).forEach(file => data.append(el.name, file));
      } else {
        el.name && data.append(el.name, el.value);
      }
      break;
  }

  let elements = [el, ...el.querySelectorAll('[type="submit"]')];

  elements.forEach(element => element.classList.add('is-load'));

  return new Promise(resolve => {
    xhr.open(method, url);

    for (const i in options.headers) {
      if (options.headers.hasOwnProperty(i)) {
        xhr.setRequestHeader(i, options.headers[i]);
      }
    }

    xhr.withCredentials = options.credentials === 'include';

    // regular ajax sending & request with file uploading
    xhr.onloadstart = xhr.upload.onprogress = event => callback?.(onProgress(event, xhr));
    xhr.onloadend   = event => resolve(() => callback?.(onProgress(event, xhr)));

    xhr.send(data);
  }).then(response => {
    elements.forEach(element => element.classList.remove('is-load'));

    return response();
  });
});

/**
 * Normalizes an XHR upload/load event plus its XHR instance into the plain
 * object passed to `$ajax`'s callback.
 *
 * @param {ProgressEvent} event - The upload/load event ("loadstart", "progress", or "loadend").
 * @param {XMLHttpRequest} xhr - The request the event belongs to.
 * @returns {Object} `{ blob, json, raw, status, url, loaded, total, percent, start, progress, end }`.
 */
function onProgress(event, xhr) {
  const { loaded = 0, total = 0, type } = event;
  const { response = '', responseText = '', status = '', responseURL = '' } = xhr;

  return {
    blob: new Blob([response]),
    json: JSON.parse(responseText || '[]'),
    raw: response,
    status,
    url: responseURL,
    loaded: convertTo(loaded),
    total: convertTo(total),
    percent: total > 0 ? Math.round((loaded / total) * 100) : 0,
    start: type === 'loadstart',
    progress: type === 'progress',
    end: type === 'loadend',
  }
}

/**
 * Converts a byte count to megabytes, rounded to 2 decimal places.
 *
 * @param {number} number - A size in bytes.
 * @returns {number} The equivalent size in megabytes.
 */
function convertTo(number) {
  return Math.round(number / BYTES_IN_MB * 100) / 100;
}
