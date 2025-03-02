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

  el.classList.add('is-load');

  let submits = el.querySelectorAll('[type="submit"]');
  submits.forEach(submit => Object.assign(submit.style, {
    "background-image":
      "url(\"data:image/svg+xml;charset=UTF-8,%3csvg width='16' height='16' fill='none' xmlns='http://www.w3.org/2000/svg'%3e%3cstyle%3ecircle %7b animation: 4s a infinite linear, 3s o infinite linear;%7d%40keyframes a %7bfrom%7bstroke-dasharray:100 0%7d50%25%7bstroke-dasharray:0 100%7dto%7bstroke-dasharray:100 0%7d%7d%40keyframes o %7bfrom%7bstroke-dashoffset:75%7dto%7bstroke-dashoffset:375%7d%7d%3c/style%3e%3cpath d='M15 8A7 7 0 111 8a7 7 0 0114 0z' stroke='%23fff' stroke-opacity='.2' stroke-width='2'/%3e%3ccircle cx='8' cy='8' r='7' stroke='%23fff' stroke-opacity='.3' stroke-width='2'/%3e%3c/svg%3e\")",
    "background-repeat": "no-repeat",
    "background-position": "center center",
    "background-size": "1.25em",
    "pointer-events": "none",
    "color": "transparent",
    "transition": "none",
  }));

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
    el.classList.remove('is-load');

    submits.forEach(submit => submit.removeAttribute('style'));

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
