document.addEventListener('youla:init', ()=> {
  /**
   * Multi-step wizard: `u-step="condition"` marks a panel's completion state; the `step`
   * data provider drives navigation via `goNext()`/`goBack()`. Use it as `u-data="step"` — any
   * `u-prop`-bound field referenced by a `u-step` condition (e.g. `name`) gets merged in
   * automatically by hydrateProps(), no need to declare it. It isn't a global `$step`, only local
   * to that `u-data`; spread it instead (`u-data="{ ...step, total: 0 }"`) only if you need a
   * field or method that isn't backed by a form input. The directive and the data provider are
   * grouped in one IIFE since neither is useful without the other.
   *
   * @since 1.0
   */
  (() => {
    Youla.directive('step', (el, output, _, component) => {
      const wizard = component.data;
      const step   = wizard.getStep(el);
      const isComplete = !!output;

      if (step.isComplete !== isComplete) {
        step.isComplete = isComplete;
        // step lives on el._x_step, outside u-data's own reactive wrapper, so refresh manually.
        component.refresh(true);
      }
    });

    Youla.data('step', () => ({
      steps: [],
      currentIndex: 0,
      progress() {
        const total   = this.steps.length;
        const current = Math.min(this.currentIndex + 1, total);

        let complete = 0;
        for(let index = 0; index < current; index++) {
          if(this.steps[index].isComplete) {
            complete++;
          }
        }
        return {
          total, complete, current,
          incomplete: total - complete,
          progress: `${Math.floor(current / total * 100)}%`,
          completion: `${Math.floor(complete / total * 100)}%`,
          percentage: Math.floor(complete / total * 100),
        };
      },
      stepAt(index) {
        return this.steps[index] || {
          el: null,
          title: null
        };
      },
      current() {
        return this.stepAt(this.currentIndex);
      },
      previous() {
        return this.stepAt(this.previousIndex());
      },
      next() {
        return this.stepAt(this.nextIndex());
      },
      previousIndex() {
        return this.currentIndex - 1 >= 0 ? this.currentIndex - 1 : null;
      },
      nextIndex() {
        return this.currentIndex + 1 < this.steps.length ? this.currentIndex + 1 : null;
      },
      isStep(index) {
        return Array.isArray(index) ? index.includes(this.currentIndex) : index === this.currentIndex;
      },
      isFirst() {
        return this.previousIndex() === null;
      },
      isNotFirst() {
        return !this.isFirst();
      },
      isLast() {
        return this.nextIndex() === null;
      },
      isNotLast() {
        return !this.isLast();
      },
      isCompleted() {
        return this.current().isComplete && this.nextIndex() === null;
      },
      isUncompleted() {
        return !this.isCompleted();
      },
      canGoNext() {
        return this.current().isComplete && this.nextIndex() !== null;
      },
      cannotGoNext() {
        return !this.canGoNext();
      },
      canGoBack() {
        return this.previousIndex() !== null;
      },
      cannotGoBack() {
        return !this.canGoBack();
      },
      getState() {
        return {
          currentIndex: this.currentIndex,
          isFirst: this.isFirst(),
          isNotFirst: this.isNotFirst(),
          isLast: this.isLast(),
          isNotLast: this.isNotLast(),
          canGoBack: this.canGoBack(),
          cannotGoBack: this.cannotGoBack(),
          canGoNext: this.canGoNext(),
          cannotGoNext: this.cannotGoNext(),
          isCompleted: this.isCompleted(),
          isUncompleted: this.isUncompleted(),
          progress: this.progress(),
        };
      },
      goNext() {
        this.goto(this.nextIndex());
      },
      goBack() {
        this.goto(this.previousIndex());
      },
      goto(index) {
        if(index !== null && this.steps[index] !== void 0) {
          this.currentIndex = index;
        }
        this.render();
        return this.current();
      },
      render() {
        this.steps.forEach((step, index) => {
          const isHidden = index !== this.currentIndex;
          if(step.el.hidden !== isHidden) {
            step.el.hidden = isHidden;
          }
        });
      },
      getStep(el) {
        let step = el._x_step;
        if(!step) {
          step = el._x_step = { el, title: '', isComplete: true };

          this.steps.push(step);
          this.render();
        }
        return step;
      },
    }));
  })();

  /**
   * Notifications system: a single `u-data="notice"` container (parts/footer.html) holds
   * the queue. `$notice` always resolves to that container's data, so `$notice.info('Saved')`
   * works from any `u-data` on the page. The variable and the data provider are grouped in one
   * IIFE since neither is useful without the other.
   *
   * @since 1.0
   */
  (() => {
    Youla.variable('notice', () => document.querySelector('[u-data="notice"]')?.__x?.data);

    Youla.data('notice', () => ({
      items: {},
      duration: 7000,
      hovering: false,
      info( message ) {
        this.add( message, 'info' );
      },
      success( message ) {
        this.add( message, 'success' );
      },
      warning( message ) {
        this.add( message, 'warning' );
      },
      error( message ) {
        this.add( message, 'error' );
      },
      loading( message ) {
        this.add( message, 'loading' );
      },
      // @mouseenter on the container: freezes every item's countdown where it stood.
      pause() {
        this.hovering = true;

        Object.values(this.items).forEach(item => {
          if ( item.timer ) {
            clearTimeout( item.timer );
            item.timer     = null;
            item.remaining = Math.max( 0, item.remaining - ( Date.now() - item.startedAt ) );
          }
        });
      },
      // @mouseleave: picks every countdown back up from where pause() froze it.
      resume() {
        this.hovering = false;

        Object.keys(this.items).forEach( id => this.schedule(id) );
      },
      schedule( id ) {
        let item = this.items[id];
        if ( item && !item.timer ) {
          item.startedAt = Date.now();
          item.timer     = setTimeout( () => this.close(id), item.remaining );
        }
      },
      elapsed( item ) {
        return ( item.duration - item.remaining ) + ( item.timer ? Date.now() - item.startedAt : 0 );
      },
      close( id ) {
        let item = this.items[id];
        if ( typeof item !== 'undefined' ) {
          clearTimeout( item.timer );

          // u-each only re-renders when "items" itself is reassigned, not on a mutated nested key.
          this.items = { ...this.items, [id]: { ...item, selectors: [ ...item.selectors, 'hide' ] } };

          setTimeout( () => {
            let { [id]: omit, ...rest } = this.items;
            this.items = rest;
          }, 1000 )
        }
      },
      add( message, type ) {
        if ( message ) {
          let timestamp = Date.now();

          // Spinner is a real inline <svg> (parts/footer.html), animated via CSS, so it can be paused on :hover.
          this.items = { ...this.items, [timestamp]: {
            message: message,
            closable: true,
            selectors: [ type || 'info' ],
            duration: this.duration,
            remaining: this.duration,
            startedAt: Date.now(),
            timer: null,
            classes() {
              return this.selectors.map( x => 'notice__item--' + x ).join(' ')
            },
          } };

          if ( !this.hovering ) {
            this.schedule(timestamp);
          }
        }
      },
    }));
  })();

  /**
   * Password policy: checks a string against a fixed policy (minimum count per character
   * class, minimum length) and can generate a password satisfying it.
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
      // Whitespace isn't part of any charset and would otherwise count toward length for free.
      if (/\s/.test(value)) {
        value = this.value = value.replace(/\s/g, '');
      }

      let matchCount = 0;
      // One point per character class plus one for the length rule.
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
      'u-prop': 'name',
    },
    picture: {
      ':title': 'name',
      ':style': "image && `background-image:url(${image})`",
    },
    initials: {
      'u-show': '!image',
      'u-text'() {
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
      'u-show': 'image',
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
      return [...root.querySelectorAll('[u-bind~="item"]')];
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
  Youla.data('builder', () => ({
    default: {
      field: 'post',
      operator: '===',
      value: '',
    },
    groups: [],
    addGroup() {
      this.groups.push({ rules: [ { ...this.default } ] });
    },
    removeGroup(index) {
      this.groups.splice(index, 1);
    },
    addRule(key) {
      this.groups[key].rules.push({ ...this.default });
    },
    removeRule(key, index) {
      this.groups[key].rules.splice(index, 1);
    },
    submit() {
      console.log(JSON.parse(JSON.stringify(this.groups)));
    },
  }));

  /**
   * Selfie: `u-data="stream"` (one instance per root) wraps `getUserMedia` into a
   * preview -> snapshot -> canvas -> image flow.
   *
   * @since 1.0
   */
  Youla.data('stream', (root) => ({
    error: null,
    canvas: null,
    videoRef: { 'u-ref': 'video' },
    imageRef: { 'u-ref': 'image' },
    canvasRef: { 'u-ref': 'canvas' },
    get refs() {
      return {
        video:  root.querySelector('[u-ref="video"]'),
        image:  root.querySelector('[u-ref="image"]'),
        canvas: root.querySelector('[u-ref="canvas"]'),
      };
    },
    check() {
      const { video, image } = this.refs;

      if (!video) {
        console.error('Video for selfie preview is undefined');
        return false;
      }

      if (!image) {
        console.error('Image for output selfie is undefined');
        return false;
      }

      return true;
    },
    getCanvas() {
      return this.refs.canvas || (this.canvas || (this.canvas = document.createElement('canvas')));
    },
    isVisible(element) {
      const styles = window.getComputedStyle(element);
      if (styles) {
        return !(styles.visibility === 'hidden' || styles.display === 'none' || parseFloat(styles.opacity) === 0);
      }
      return false;
    },
    async requestStream(video) {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.error = 'unsupported';
        return;
      }

      try {
        video.srcObject = video._x_stream = await navigator.mediaDevices.getUserMedia({video: true});
        this.error = null;
      } catch (error) {
        this.error = error.name === 'NotAllowedError' || error.name === 'SecurityError' ? 'denied' : 'unavailable';
      }
    },
    start() {
      const video = this.refs.video;
      if (video._x_stream || video._x_streamObserver) {
        return;
      }

      if (this.isVisible(video)) {
        this.requestStream(video);
        return;
      }

      video._x_streamObserver = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting) && this.isVisible(video)) {
          video._x_streamObserver.disconnect();
          video._x_streamObserver = null;
          this.requestStream(video);
        }
      });
      video._x_streamObserver.observe(video);
    },
    snap() {
      if (!this.check()) {
        return null;
      }
      this.start();

      const canvas = this.getCanvas();
      const { video, image } = this.refs;

      let imageStyles = window.getComputedStyle(image),
        targetRatio = parseInt(imageStyles.width, 10) / parseInt(imageStyles.height, 10);

      let videoWidth  = video.videoWidth,
        videoHeight = video.videoHeight,
        videoRatio  = videoWidth / videoHeight;

      let sWidth, sHeight;
      if (videoRatio > targetRatio) {
        sHeight = videoHeight;
        sWidth  = videoHeight * targetRatio;
      } else {
        sWidth  = videoWidth;
        sHeight = videoWidth / targetRatio;
      }

      let sx = (videoWidth - sWidth) / 2,
        sy = (videoHeight - sHeight) / 2;

      canvas.width  = sWidth;
      canvas.height = sHeight;

      let ctx = canvas.getContext('2d');

      // 1:1 pixel copy of the native camera resolution — no resampling, so no quality is lost
      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);

      let imageData = canvas.toDataURL('image/png');
      if ( imageData ) {
        image.src = imageData;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      return imageData;
    },
    stop() {
      const video = this.refs.video;
      if (video._x_streamObserver) {
        video._x_streamObserver.disconnect();
        video._x_streamObserver = null;
      }
      if (video._x_stream) {
        video._x_stream.getTracks().forEach(track => track.stop());
      }
      video._x_stream = null;
    },
  }));

  /**
   * Search box: `wrapper`/`button`/`input` are ready-made `u-bind` sets. `button`/`input`
   * carry their own `u-ref`, so the wrapper's Ctrl+K shortcut reaches the input via `$refs`
   * instead of Alpine's `x-init` (Youla.js has no such hook — `u-ref` + `$refs` is the native
   * way to grab an element reference, see /u-ref).
   *
   * @since 1.0
   */
  Youla.data('search', () => ({
    currentIdx: -1,
    links: [],
    wrapper: {
      '@click.outside'() {
        this.$el.removeAttribute('open');
      },
      '@keydown.escape'() {
        this.$el.removeAttribute('open');
      },
      '@keydown.prevent.window.ctrl.k'() {
        this.$refs.searchButton.click();
      },
    },
    button: {
      'u-ref': 'searchButton',
      '@click'() {
        setTimeout(() => this.$refs.searchInput.focus());
      },
    },
    input: {
      'u-ref': 'searchInput',
      '@keydown.up'() {
        this.currentIdx = this.currentIdx <= 0 ? this.links.length - 1 : this.currentIdx - 1;
        if (!this.links[this.currentIdx]?.url && this.currentIdx === 0) {
          this.currentIdx = this.links.length - 1;
        }
      },
      '@keydown.down'() {
        this.currentIdx = this.currentIdx >= this.links.length - 1 ? 0 : this.currentIdx + 1;
        if (!this.links[this.currentIdx]?.url) {
          this.currentIdx++;
        }
      },
      '@keydown.enter'() {
        this.links[this.currentIdx] && (window.location.href = this.links[this.currentIdx].url);
      },
    },
  }));

  /**
   * Tabs, synced with the page URL: `u-data="tab"` on the wrapper, `u-bind="tabButton('id')"` on
   * each tab button, `u-bind="tabContent('id')"` on each panel. The active tab is read from the
   * `?tab=` query param if present, else `data-tab` on the `u-data` element itself.
   *
   * @since 1.0
   */
  Youla.data('tab', (root) => ({
    tab: new URLSearchParams(window.location.search).get('tab') || root.dataset.tab || null,
    tabButton(id) {
      return {
        ':class'() {
          return this.tab === id ? 'active' : '';
        },
        '@click'() {
          this.tab = id;

          const url = new URL(window.location.href);
          url.searchParams.set('tab', id);
          window.history.pushState({}, '', url);
        },
      };
    },
    tabContent(id) {
      return {
        'u-show'() {
          return this.tab === id;
        },
      };
    },
  }));

  /**
   * `$dirty` — warns about unsaved form changes: tracks a form's initial serialized state
   * and compares it against the current one on every input/change, toggling `is-unsaved` (and a
   * brief `is-shake`) on `document.body`, and blocking in-page link clicks while any watched form
   * is dirty. Call `$dirty.watch($el)` once per form — e.g. `<form @load="$dirty.watch($el)">`,
   * `.load` being Youla's equivalent of Alpine's `x-init` — and `$dirty.remove($el)` after a
   * successful save to reset it back to clean (or on `reset`, handled automatically below).
   *
   * `resolveVariables()` re-invokes this factory on every single expression evaluation page-wide,
   * so nothing here can rely on a JS variable surviving between calls — "already watching this
   * form"/"is this form dirty" live as attributes on the form itself instead, which is what
   * actually persists. `sync()` re-derives "is-unsaved" from every watched form on the page, so
   * several independently-watched forms aggregate correctly, for free.
   *
   * @since 1.0
   */
  Youla.variable('dirty', () => {
    const serialize = form => JSON.stringify(Object.fromEntries(new FormData(form).entries()));

    const sync = () => {
      const isDirty = [...document.querySelectorAll('form[data-dirty-watch]')]
        .some(form => form.dataset.initialState !== serialize(form));

      document.body.classList.toggle('is-unsaved', isDirty);
    };

    return {
      watch(form) {
        if (!(form instanceof HTMLFormElement) || form.dataset.dirtyWatch !== undefined) {
          return;
        }
        form.dataset.dirtyWatch = '';

        // Only ever bound once, page-wide, regardless of how many forms call watch().
        if (document.body.dataset.dirtyBound === undefined) {
          document.body.dataset.dirtyBound = '';

          // Shakes the page instead of following the link, while any watched form is still dirty.
          window.addEventListener('click', e => {
            if (document.body.classList.contains('is-unsaved') && e.target.closest('a[href]')) {
              e.preventDefault();

              document.body.classList.add('is-shake');
              setTimeout(() => document.body.classList.remove('is-shake'), 500);
            }
          }, true);
        }

        // Deferred so any reactive hydration of the form's own fields settles first — otherwise
        // that initial fill-in would itself register as a "dirty" change.
        setTimeout(() => {
          form.dataset.initialState = serialize(form);

          form.addEventListener('input', sync);
          form.addEventListener('change', sync);
          form.addEventListener('reset', () => setTimeout(() => {
            form.dataset.initialState = serialize(form);
            sync();
          }, 0));
        }, 50);
      },
      remove(form) {
        if (!(form instanceof HTMLFormElement)) {
          return;
        }

        form.dataset.initialState = serialize(form);
        sync();
      },
    };
  });
});