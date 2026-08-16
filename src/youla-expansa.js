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
    initials: {
      'v-show': '!image',
      'v-text': `name && getInitials(name)`,
    },
    uploader: {
      '@change': 'add($event)',
    },
    remover: {
      '@click': 'remove($root)',
      'v-show': 'image',
    },
    add(event, callback) {
      let file = event.target.files[0];
      if (file) {
        let reader = new FileReader();
        reader.onload = e => this.image = e.target.result;
        reader.readAsDataURL(file);
      }
      callback?.();
    },
    remove(root) {
      let input = root.querySelector('input[type="file"]');
      if (input) {
        input.value = '';
      }
      this.image = '';
    },
    getInitials(string, letters = 2) {
      return string.split(' ', letters).map(word => word.charAt(0)).join('').toUpperCase();
    },
  }))
});