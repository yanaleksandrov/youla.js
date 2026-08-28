import { createControlsBase } from './base';
import { createDataControls } from './data';
import { createMultiValueControls } from './multi-value';
import { createUnitControls } from './unit';

/**
 * Assembles the whole control system into one object to spread into `Youla.data('editrix', () =>
 * ({ ...createControlsSystem(), ...the rest of editrix's own state }))` — see youla-editrix.js.
 *
 * Kept as several small factories (base/data/multi-value/unit) rather than one file so each
 * category can grow independently; merged here, in dev, with a collision check, so two control
 * factories accidentally sharing a name fails loudly instead of one silently shadowing the other.
 *
 * @returns {Object}
 */
export function createControlsSystem() {
  const parts = [createControlsBase(), createDataControls(), createMultiValueControls(), createUnitControls()];
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
