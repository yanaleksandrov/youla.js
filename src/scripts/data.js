let datas = {}

export function data(name, callback) {
  datas[name] = callback
}

// export function injectDataProviders(obj = {}, context) {
//   Object.entries(datas).forEach(([name, callback]) => Object.defineProperty(obj, name, {
//     get: () => (...args) => callback.call(context, ...args),
//     enumerable: false,
//   }));
//   console.log(obj)
//   return obj;
// }

export function injectDataProviders(context, obj = {}) {
  Object.entries(datas).forEach(([name, callback]) => {
    obj[name] = callback.call(context);
  });
  return obj;
}