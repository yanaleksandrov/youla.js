document.addEventListener('x:init', e=> {
  const x = e.detail.x;

  console.log(x)

  x.data('dropdown', () => ({
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