import { createControlsBase } from './base';
import { createDataControls } from './data';
import { createMultiValueControls } from './multi-value';
import { createUnitControls } from './unit';
import { createRepeaterControl } from './repeater';

/**
 * Assembles the whole control system into one object to spread into
 * `Youla.data('editrix', () => ({ ...createControlsSystem(), ... }))` — see youla-editrix.js.
 *
 * Kept as several small factories rather than one file so each category can grow independently;
 * merged here with a collision check, so two factories accidentally sharing a name fail loudly.
 *
 * @returns {Object}
 */
export function createControlsSystem() {
  const parts = [createControlsBase(), createDataControls(), createMultiValueControls(), createUnitControls(), createRepeaterControl()];
  const merged = {};

  parts.forEach((part) => {
    Object.keys(part).forEach((key) => {
      if (key in merged) {
        console.warn(`Youla.js: editrix control system — "${key}" is defined more than once; the later definition wins.`);
      }
      merged[key] = part[key];
    });
  });

  return merged;
}
