import { Youla } from '../scripts/index';

const prefix = '$';

export function method(name, callback) {
  name = `${prefix}${name}`;
  if (!Youla.methods[name]) {
    Youla.methods[name] = callback;
  } else {
    console.warn(`Youla.js: method '${name}' is already exists.`);
  }
}
