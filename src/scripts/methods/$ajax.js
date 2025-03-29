import { method } from '../methods';

const BYTES_IN_MB = 1048576;

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

function convertTo(number) {
  return Math.round(number / BYTES_IN_MB * 100) / 100;
}
