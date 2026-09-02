/**
 * "Multi-value" controls — a setting whose value is itself an object with a few named parts
 * (Elementor's url/box_shadow controls work the same way). No wrapper factory of their own here: a
 * compound control's wrapper is just `field(name, title, tooltip, { type: 'url', ... })` like any
 * other (controls/base.js), and part()/partSwitch() below are its parts.
 *
 * Value shapes, for reference:
 *   url: { url: '', is_external: false, nofollow: false }
 */

import { fieldName } from './base';

export function createMultiValueControls() {
  return {
    // v-bind="e.part('url')" on a text-like input for one part of a compound value — "name" comes
    // from the closest ".editrix-field" wrapper's own "data-name" (controls/base.js's fieldName()),
    // not an argument, so a control's own markup (control/url/index.html) stays fully static.
    part(key) {
      return {
        ':value'() {
          const name = fieldName(this.$el);
          return (this.getValue(name) || {})[key] ?? '';
        },
        '@input'(e) {
          const name = fieldName(this.$el);
          this.patchValue(name, { [key]: e.target.value });
        },
      };
    },

    // v-bind="e.partSwitch('is_external')" on a checkbox for one boolean part.
    partSwitch(key) {
      return {
        ':checked'() {
          const name = fieldName(this.$el);
          return !!(this.getValue(name) || {})[key];
        },
        '@change'(e) {
          const name = fieldName(this.$el);
          this.patchValue(name, { [key]: e.target.checked });
        },
      };
    },
  };
}
