import { method } from '../methods';
import { eventCreate } from '../helpers';

method('dispatch', (e, el) => (name, detail = {}) => {
  el.dispatchEvent(eventCreate(name, detail));
});
