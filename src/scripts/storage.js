// Unlike cookies, localStorage has no native expiration, so a TTL is faked by
// wrapping the value in a small envelope carrying the absolute expiry time.
// The key is namespaced to make collisions with a plain, pre-existing stored
// value (from before TTL support existed, or set without an expiration)
// vanishingly unlikely.
const TTL_KEY = '__youla_expires';
const EXPIRED = Symbol('expired');

/**
 * Wraps a value with an absolute expiry time, for storing in localStorage.
 *
 * @param {*} value - The value to wrap (already JSON-encoded, if it was an object).
 * @param {Date} expires - When the value should be considered expired.
 * @returns {string} The JSON-encoded envelope to pass to localStorage.setItem.
 */
function wrapWithTTL(value, expires) {
  return JSON.stringify({ [TTL_KEY]: expires.getTime(), value });
}

/**
 * Unwraps a value previously wrapped by wrapWithTTL().
 *
 * @param {string} raw - The raw string read from localStorage.
 * @returns {*} The unwrapped value; the EXPIRED symbol if its TTL has passed; or `undefined`
 * if "raw" isn't one of our envelopes (a plain value stored without an expiration).
 */
function unwrapTTL(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && TTL_KEY in parsed) {
      return Date.now() > parsed[TTL_KEY] ? EXPIRED : parsed.value;
    }
  } catch (error) {}

  return undefined;
}

export const storage = {
  /**
   * Reads a previously stored value. A localStorage entry set with an
   * expiration is removed and treated as missing once that time has passed.
   *
   * @param {string} name - The key (localStorage) or cookie name to read.
   * @param {'local'|'cookie'} [type] - Which storage to read from.
   * @returns {*} The parsed value (JSON-decoded when possible for cookies), or undefined if not found or expired.
   */
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
      const raw = localStorage.getItem(name);
      if (raw === null) {
        return;
      }

      const unwrapped = unwrapTTL(raw);
      if (unwrapped === EXPIRED) {
        localStorage.removeItem(name);
        return;
      }

      return unwrapped !== undefined ? unwrapped : raw;
    }
  },
  /**
   * Persists a value to localStorage or a cookie, JSON-encoding it first if it's an object.
   * Passing a falsy "value" clears the existing entry instead of writing one.
   *
   * @param {string} name - The key (localStorage) or cookie name to write.
   * @param {*} value - The value to store; falsy clears the existing entry.
   * @param {'local'|'cookie'} [type] - Which storage to write to.
   * @param {object} [options] - For a cookie: its attributes — "expires" (Date) is converted to a
   * UTC string, every other key (e.g. "path", "domain", "secure", "samesite") is appended as
   * "key=value", or as a bare flag when its value is exactly true. For localStorage, only
   * "expires" (Date) is used, to fake a TTL — everything else is ignored. Omitting "expires"
   * makes a cookie a session cookie and a localStorage entry permanent.
   * @returns {void}
   */
  set: (name, value, type = 'local', options = {path: '/'}) => {
    if (!name) return;

    if (value instanceof Object) {
      value = JSON.stringify(value);
    }

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
        localStorage.setItem(name, options && options.expires instanceof Date ? wrapWithTTL(value, options.expires) : value);
      } else {
        localStorage.removeItem(name);
      }
    }
  }
}

/**
 * Converts a relative duration string (e.g. "365d", "1y") into an absolute Date, by adding the
 * given amount to the current date and time.
 *
 * @param {string} str - A number followed by a unit: "y" (years), "m" (months), "d" (days), "h" (hours), "i" (minutes), or "s" (seconds).
 * @returns {Date|null} The resulting Date, or null if the string doesn't end in a recognized unit.
 */
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

/**
 * Checks whether an attribute's modifiers request persistence (".local" or ".cookie").
 *
 * @param {string[]} modifiers - The attribute's modifier list.
 * @returns {boolean} True if either persistence modifier is present.
 */
export function isStorageModifier(modifiers) {
  return ['cookie', 'local'].some(modifier => modifiers.includes(modifier))
}

/**
 * Picks which storage an attribute's modifiers request, defaulting to localStorage.
 *
 * @param {string[]} modifiers - The attribute's modifier list.
 * @returns {'cookie'|'local'} "cookie" if ".cookie" is present, otherwise "local".
 */
export function getStorageType(modifiers) {
  return modifiers.includes('cookie') ? 'cookie' : 'local'
}

/**
 * Coerces a persisted (string) value back to the type of an existing reference value "a" — used
 * to restore a stored value into the same shape it had before it was persisted.
 *
 * @param {*} a - A reference value whose type "value" should be converted to.
 * @param {*} value - The raw value to convert (typically a string read back from storage).
 * @returns {*} "value" converted to match the type of "a".
 */
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
