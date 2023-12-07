import { method } from '../methods';

method('fetch', (e, el) => (url, options = {}, callback) => {
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

  return new Promise((resolve, reject) => {
    xhr.open(method, url);

    for (const i in options.headers) {
      xhr.setRequestHeader(i, options.headers[i]);
    }

    xhr.onerror         = reject;
    xhr.withCredentials = options.credentials === 'include';

    // send ajax request with file uploading
    xhr.upload.onprogress = event => callback && callback(onProgress(event));

    // regular ajax sending
    xhr.onloadstart = event => callback && callback(onProgress(event));
    xhr.onload      = event => resolve(() => onProgress(xhr));
    xhr.onloadend   = event => callback && callback(onProgress(event));

    xhr.send(data);
  }).then(response => {
    return response();
  });
});

function onProgress(data) {
  const BYTES_IN_MB = 1048576;
  if (data.loaded) {
    return {
      start: true,
      progress: false,
      end: false,
      loaded: (data.loaded/BYTES_IN_MB).toFixed(1),
      total: (data.total/BYTES_IN_MB).toFixed(1),
      percent: 0,
    }
  }

  return {
    blob: new Blob([data.response]),
    json: JSON.parse(data.responseText),
    response: data.response,
    status: data.status,
    statusText: data.statusText,
    text: data.responseText,
    url: data.responseURL,
  }
}
