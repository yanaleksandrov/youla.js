# Youla.js

Youla.js is a small JavaScript library for adding interactivity to HTML. It follows a markup-first, Vue-like API: directives live directly in your tags and react to data changes automatically, without a build step.

```html
<div u-data="{ open: false }">
  <button @click="open = !open">Toggle</button>
  <div u-show="open">Content...</div>
</div>
```

No build step, no compiler needed — Youla.js reads the directives already present in your HTML and keeps that markup in sync with your data as it changes, updating only what actually needs to change.

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yanaleksandrov/youla.js.git
cd youla.js
npm install
```

Available scripts:

- `npm start` — runs a dev server with hot reload at `localhost:3000`
- `npm run watch` — rebuilds on file changes without a dev server
- `npm run build` — produces a production build in `dist/`

## Usage

Add `u-data` to any element to turn it into a component with its own reactive data. From there, bind
behavior and content to that data using directives, directly inside your existing markup:

```html
<ul u-data="{ colors: ['Red', 'Orange', 'Yellow'] }">
  <li u-each="color in colors" u-text="color"></li>
</ul>
```

Youla.js ships with:

| Directive        | Purpose                                                              |
| ---------------- | --------------------------------------------------------------------|
| `u-data`         | Marks an element as a component and defines its reactive data       |
| `u-text`         | Sets the element's text content, escaping HTML                      |
| `u-html`         | Sets the element's HTML content                                     |
| `u-show`         | Toggles element visibility via `display`                            |
| `u-each`         | Renders a template element for each item of an array, object, or range |
| `u-prop`         | Two-way binds a form field's value to data                          |
| `:attr`          | Binds any HTML attribute to an expression (e.g. `:class`, `:style`)  |
| `@event`         | Listens for a browser event, with modifiers like `.prevent`/`.once`  |

## Storage

`Youla.storage` persists values in `localStorage` or cookies — useful for state that isn't bound to a
form field, such as a theme switch or a dismissed banner. The same object is available as `$storage`
in expressions and as `this.$storage` in data provider methods, and it also powers the `.local` and
`.cookie` modifiers of `u-prop` and `u-data`.

| Method                                         | Description                                                    |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `get(name, type = 'local')`                    | Returns the stored value, or `undefined` if missing or expired |
| `set(name, value, type = 'local', options = {})` | Stores a value; objects and arrays are saved as JSON         |
| `forget(name, type = 'local')`                 | Removes the stored value                                       |

| Parameter         | Description                                                                                  |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `type`            | `'local'` for `localStorage`, `'cookie'` for a cookie                                        |
| `options.expires` | A `Date` or a duration: `'1y'`, `'30d'`, `'2h'`, etc. Without it, a cookie lasts for the session and a `localStorage` value never expires |
| `options.*`       | Any other cookie attribute. Cookies default to `path=/`, `SameSite=Lax` and `Secure` on HTTPS |

A provider that toggles a flag and remembers it in a cookie for a year:

```html
<div u-data="darkMode">
  <button @click="toggle()" u-text="dark ? 'Light theme' : 'Dark theme'"></button>
</div>

<script>
  document.addEventListener('youla:init', () => {
    Youla.data('darkMode', () => ({
      dark: !!Youla.storage.get('dark', 'cookie'),
      toggle() {
        this.dark = !this.dark;
        this.$storage.set('dark', this.dark, 'cookie', { expires: '1y' });
      },
    }));
  });
</script>
```

> Setting a falsy value (`false`, `0`, `''`, `null`) removes the entry instead of storing it, so read flags back with `!!` as in the example above.

Run `npm start` and open `/syntax` for the full syntax reference, or browse the other pages under
`src/view` for live, editable examples of every directive covered in this README.

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -am 'Add some feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request :D

## License

[MIT](LICENSE.md) © [Yan Aleksandrov](https://github.com/yanaleksandrov)
