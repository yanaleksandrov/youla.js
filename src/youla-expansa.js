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
      ':title': 'name',
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
  }));

  /**
   * Table checkboxes
   *
   * @since 1.0
   */
  Youla.data('table', () => ({
    anchor: null,
    trigger: {
      '@change': 'selectAll($el, $root)',
    },
    item: {
      '@click': 'selectItem($el, $root, $event)',
    },
    items(root) {
      return [...root.querySelectorAll('[v-bind~="item"]')];
    },
    selectAll(el, root) {
      this.items(root).forEach(input => input.checked = el.checked);
    },
    selectItem(el, root, event) {
      let items   = this.items(root);
      let index   = items.indexOf(el);
      let checked = el.checked;
      let start   = event.shiftKey && this.anchor !== null ? this.anchor : index;

      for (let i = Math.min(start, index); i <= Math.max(start, index); i++) {
        items[i].checked = checked;
      }
      this.anchor = index;
    },
  }));
});