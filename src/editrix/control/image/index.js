// The "image" control — a Filler swatch locked to its image source (upload, crop, filters), used
// for any single-image field (see editrix/blocks/*/config.json's "type": "image" fields, and
// youla-editrix.js's blockImage() binding, which reads this value's own "dataUrl" back onto the
// canvas). "name" comes from the closest ".editrix-field" wrapper's own "data-name".

import { fieldName } from '../../controls/base';

export function createImageControl() {
  return {
    image() {
      return {
        'v-filler'() {
          const name = fieldName(this.$el);

          return {
            sources: ['image'],
            // Restores a previously picked image's dataUrl/fit/rotation/filters — Filler's own
            // shape (see youla-filler.js's "options.image").
            image: this.getValue(name) ?? undefined,
            onMediaChange: (type, media) => {
              if (type === 'image') {
                this.setValue(name, media?.dataUrl ? media : null);
              }
            },
          };
        },
      };
    },
  };
}
