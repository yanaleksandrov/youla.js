document.addEventListener('youla:init', ()=> {
  Youla.data('dropdown', () => ({
    open: false,
    trigger: {
      ['@click']() {
        this.open = ! this.open
      },
    },
    dialogue: {
      ['v-show']() {
        return this.open
      },
    },
  }));
})