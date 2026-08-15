import { Youla } from '../scripts/index';
import { register } from './registry';

export function directive(name, callback) {
  register('directive', Youla.directives, `v-${name}`, callback);
}
