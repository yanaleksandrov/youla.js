export const storage = {
  get: (name, type = 'local') => {
    if (!name) return;

    if (type === 'cookie') {
      let matches = document.cookie.match(new RegExp(
        "(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/+^])/g, '\\$1') + "=([^;]*)"
      ));

      if (matches) {
        let res = decodeURIComponent(matches[1]);
        try {
          return JSON.parse(res);
        } catch(e) {
          return res;
        }
      }
    }

    if (type === 'local') {
      return localStorage.getItem(name);
    }
  },
  set: (name, value, type = 'local', options = {path: '/'}) => {
    if (!name) return;

    if (value instanceof Object) {
      value = JSON.stringify(value);
    }

    /*
    Sets a cookie with specified name (str), value (str) & options (dict)

    options keys:
      - path (str) - URL, for which this cookie is available (must be absolute!)
      - domain (str) - domain, for which this cookie is available
      - expires (Date object) - expiration date&time of cookie
      - max-age (int) - cookie lifetime in seconds (alternative for expires option)
      - secure (bool) - if true, cookie will be available only for HTTPS.
                        IT CAN'T BE FALSE
      - samesite (str) - XSRF protection setting.
                         Can be strict or lax
                         Read https://web.dev/samesite-cookies-explained/ for details
      - httpOnly (bool) - if true, cookie won't be available for using in JavaScript
                          IT CAN'T BE FALSE
    */
    if (type === 'cookie') {
      options = options || {};

      if (options.expires instanceof Date) {
        options.expires = options.expires.toUTCString();
      }

      let updatedCookie = encodeURIComponent(name) + "=" + encodeURIComponent(value);
      for (let optionKey in options) {
        updatedCookie += "; " + optionKey;
        let optionValue = options[optionKey];
        if (optionValue !== true) {
          updatedCookie += "=" + optionValue;
        }
      }
      document.cookie = updatedCookie;
    }

    if (type === 'local') {
      if (value) {
        localStorage.setItem(name, value);
      } else {
        localStorage.removeItem(name);
      }
    }
  }
}

export function computeExpires(str) {
  let lastCh = str.charAt(str.length - 1),
    value  = parseInt(str, 10);

  const methods = {
    y: 'FullYear',
    m: 'Month',
    d: 'Date',
    h: 'Hours',
    i: 'Minutes',
    s: 'Seconds',
  }

  if (lastCh in methods) {
    const date   = new Date();
    const method = methods[lastCh];
    date[`set${method}`](date[`get${method}`]() + value);

    return date;
  }

  return null;
}

export function isStorageModifier(modifiers) {
  return ['cookie', 'local'].some(modifier => modifiers.includes(modifier))
}

export function getStorageType(modifiers) {
  return modifiers.includes('cookie') ? 'cookie' : 'local'
}

export function castToType(a, value) {
  const type = typeof a;
  switch (type) {
    case 'string':
      return String(value);
    case 'number':
      return Number.isInteger(a) ? parseInt(value, 10) : parseFloat(value);
    case 'boolean':
      return Boolean(value);
    case 'object':
      if (a instanceof Date) {
        return new Date(value);
      } else if (Array.isArray(a)) {
        return Array.from(value);
      } else {
        return Object(value);
      }
    case 'undefined':
      if (a === null) {
        return null;
      }
      return value === 'true' ? true : (value === 'false' ? false : value);
    default:
      return value;
  }
}
