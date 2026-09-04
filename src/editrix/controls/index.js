import { createControlsBase } from './base';
import { createMultiValueControls } from './multi-value';
import { createUnitControls } from './unit';
import { createSectionRepeaterControl } from './section-repeater';
import { createTextControl } from '../control/text';
import { createTextareaControl } from '../control/textarea';
import { createSwitcherControl } from '../control/switcher';
import { createSelectControl } from '../control/select';
import { createColorControl } from '../control/color';
import { createImageControl } from '../control/image';
import { createRepeaterControl } from '../control/repeater';
import { createGalleryControl } from '../control/gallery';
import { createMetaControl } from '../control/meta';
import { createCategoriesControl } from '../control/categories';
import { createBordersControl } from '../control/borders';
import { createCustomCssControl } from '../control/custom-css';

/**
 * Assembles the whole control system into one object, spread into `Youla.data('editrix', ...)`.
 * Kept as several small factories rather than one file; merged here with a collision check.
 *
 * @param {Object} [options]
 * @param {Object} [options.meta] - statuses/visibilities/discussions/authors — see control/meta's createMetaControl().
 * @returns {Object}
 */
export function createControlsSystem({ meta } = {}) {
  const parts = [
    createControlsBase(),
    createMultiValueControls(),
    createUnitControls(),
    createTextControl(),
    createTextareaControl(),
    createSwitcherControl(),
    createSelectControl(),
    createColorControl(),
    createImageControl(),
    createRepeaterControl(),
    createSectionRepeaterControl(),
    createGalleryControl(),
    createMetaControl(meta),
    createCategoriesControl(),
    createBordersControl(),
    createCustomCssControl(),
  ];
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
