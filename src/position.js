document.addEventListener('youla:init', ()=> {
  Youla.data('dropdown', () => ({
    open: false,
    trigger: {
      '@click': () => {
        console.log(423435235)
        this.open = ! this.open
      },
    },
    dialogue: {
      'v-show': () => {
        return this.open
      },
    },
  }));
})