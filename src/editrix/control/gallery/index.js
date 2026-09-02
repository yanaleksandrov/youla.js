// Toolbox > "Page" panel's featured-image gallery control — fixed, single-instance, so its own
// state ("thumbnails") lives here rather than through getValue()/setValue() (controls/base.js).

export function createGalleryControl() {
  return {
    // Each entry is an <img> src (a data: URL once uploaded via galleryInput below).
    thumbnails: [],

    // Reads selected images with FileReader and appends each as a data URL to "thumbnails" (by assignment, never .push(), so v-each picks up the change).
    galleryInput: {
      '@change'(e) {
        const files = [...e.target.files].filter((file) => file.type.startsWith('image/'));
        e.target.value = '';

        files.forEach((file) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            this.thumbnails = [...this.thumbnails, event.target.result];
          };
          reader.readAsDataURL(file);
        });
      },
    },

    // Removes an item by index (from `:data-index`) rather than the DOM node, keeping "thumbnails" the source of truth.
    galleryRemove: {
      '@click'() {
        const index = +this.$el.closest('.editrix-gallery-item').dataset.index;
        this.thumbnails = this.thumbnails.filter((_, i) => i !== index);
      },
    },
  };
}
