document.addEventListener('youla:init', ()=> {
  /**
   * Avatar uploader.
   *
   * @since 1.0
   */
  Youla.data('avatar', () => ({
    name: '',
    image: '',
    field: {
      'v-prop': 'name',
    },
    picture: {
      ':style': "image && `background-image:url(${image})`",
    },
    initials(letters = 2) {
      return {
        'v-show': '!image',
        'v-text': `name && getInitials(name, ${letters})`,
      }
    },
    uploader: {
      '@change': 'add($event)',
    },
    remover: {
      '@click': 'remove($event)',
      'v-show': 'image',
    },
    add(event, callback) {
      let file = event.target.files[0];
      if (file) {
        let reader = new FileReader();
        reader.onload = e => {
          this.image = e.target.result;
        };
        reader.readAsDataURL(file);
      }

      if (callback) {
        callback();
      }
    },
    remove(event) {
      let root  = event.target.closest('[v-data]'),
        input = root && root.querySelector('input[type="file"]');
      if (input) {
        input.value = '';
      }
      this.image = '';
    },
    getInitials(string, letters = 2) {
      const wordArray = string.split(' ').slice(0, letters);
      if (wordArray.length >= 2) {
        return wordArray.reduce((accumulator, currentValue) => `${accumulator}${currentValue[0].charAt(0)}`.toUpperCase(), '');
      }
      return wordArray[0].charAt(0).toUpperCase();
    },
  }))
});