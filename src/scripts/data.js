let datas = {}

export function data(name, callback) {
  datas[name] = callback
}

export function injectDataProviders(obj, context) {
  Object.entries(datas).forEach(([name, callback]) => Object.defineProperty(obj, name, {
    get: () => (...args) => callback.call(context, ...args),
    enumerable: false,
  }));

  return obj;
}
