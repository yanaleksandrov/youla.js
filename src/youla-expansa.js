document.addEventListener('youla:init', ()=> {
  /**
   * Password policy: checks a string against a fixed policy (minimum count per character
   * class, minimum length) and can generate a password that already satisfies it.
   *
   * @since 1.0
   */
  Youla.data('password', () => ({
    value: '',
    visible: false,
    progress: 0,
    labels: ['Слишком слабый', 'Слабый', 'Средний', 'Хороший', 'Отличный'],
    min: {
      lowercase: 2,
      uppercase: 2,
      special: 2,
      digit: 2,
      length: 12
    },
    valid: {
      lowercase: false,
      uppercase: false,
      special: false,
      digit: false,
      length: false
    },
    charsets: {
      lowercase: 'abcdefghijklmnopqrstuvwxyz',
      uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
      special: '!@#$%^&*(){|}~',
      digit: '0123456789'
    },
    toggle() {
      this.visible = !this.visible;
    },
    level() {
      return Math.min(4, Math.round(this.progress / 25));
    },
    label() {
      return this.labels[this.level()];
    },
    check(value) {
      // Whitespace isn't part of any charset above and would otherwise count toward length for free.
      if (/\s/.test(value)) {
        value = this.value = value.replace(/\s/g, '');
      }

      let matchCount = 0;
      // One point per character class plus one for the length rule — fixed, unlike the old
      // per-call total, which only counted the length rule's point when it passed. That let a
      // short password satisfying all 4 character classes read as 100% despite failing length.
      let totalWeight = Object.keys(this.charsets).reduce((sum, type) => sum + this.min[type], 0) + 1;

      for (const type in this.charsets) {
        let charsetRegex = new RegExp(`[${this.charsets[type]}]`, 'g');
        let charsetCount = (value.match(charsetRegex) || []).length;

        matchCount += Math.min(charsetCount, this.min[type]);
        this.valid[type] = charsetCount >= this.min[type];
      }

      this.valid.length = value.length >= this.min.length;
      if (this.valid.length) {
        matchCount += 1;
      }

      this.progress = (matchCount / totalWeight) * 100;

      return this.progress;
    },
    generate() {
      let pool = Object.values(this.charsets).join('');
      let password = '';

      for (const type in this.charsets) {
        for (let i = 0; i < this.min[type]; i++) {
          password += this.charsets[type][Math.floor(Math.random() * this.charsets[type].length)];
        }
      }

      while (password.length < this.min.length) {
        password += pool[Math.floor(Math.random() * pool.length)];
      }

      this.value = this.shuffle(password);
      this.check(this.value);

      return this.value;
    },
    shuffle(password) {
      let array = password.split('');

      for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
      }

      return array.join('');
    },
  }));

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
      'v-text'() {
        return this.name.trim().split(/\s+/).map(word => word[0]).slice(0, 2).join('').toUpperCase();
      },
    },
    uploader: {
      '@change'() {
        let file = this.$event.target.files[0];
        if (file) {
          let reader = new FileReader();
          reader.onload = e => this.image = e.target.result;
          reader.readAsDataURL(file);
        }
      },
    },
    remover: {
      'v-show': 'image',
      '@click'() {
        let input = this.$root.querySelector('input[type="file"]');
        if (input) {
          input.value = '';
        }
        this.image = '';
      },
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

  /**
   * Custom fields builder.
   *
   * @since 1.0
   */
  Youla.data('builder', () => {
    // Shared by addRule()/removeRule(): replaces group "key"'s rules with whatever "transform"
    // returns, leaving every other group untouched. Reassigning "groups" wholesale (not the
    // group/its rules in place) is what makes v-each notice the change and re-render.
    const updateRules = (groups, key, transform) => groups.map((group, index) => index !== key ? group : {
      ...group,
      rules: transform(group.rules),
    });

    return {
      default: {
        field: 'post',
        operator: '===',
        value: '',
      },
      groups: [],
      addGroup() {
        this.groups = [ ...this.groups, { rules: [ { ...this.default } ] } ];
      },
      removeGroup(index) {
        this.groups = this.groups.filter((group, key) => key !== index);
      },
      addRule(key) {
        this.groups = updateRules(this.groups, key, rules => [ ...rules, { ...this.default } ]);
      },
      removeRule(key, index) {
        this.groups = updateRules(this.groups, key, rules => rules.filter((rule, ruleIndex) => ruleIndex !== index));
      },
      submit() {
        console.log(JSON.parse(JSON.stringify(this.groups)));
      },
    };
  });
});