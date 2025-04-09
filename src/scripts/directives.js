import { Youla } from '../scripts/index';

const prefix = 'v-';

export function directive(name, callback) {
  name = `${prefix}${name}`;
  if (!Youla.directives[name]) {
    Youla.directives[name] = callback;
  } else {
    console.warn(`Youla.js: directive '${name}' is already exists.`);
  }
}
