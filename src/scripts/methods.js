import { Youla } from '../scripts/index';
import { register } from './registry';

export function method(name, callback) {
  register('method', Youla.methods, `$${name}`, callback);
}
