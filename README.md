# Youla.js

Youla.js is a small JavaScript library for adding interactivity to HTML. It follows a markup-first, Vue-like API: directives live directly in your tags and react to data changes automatically, without a build step.

```html
<div v-data="{ open: false }">
  <button @click="open = !open">Toggle</button>
  <div v-show="open">Content...</div>
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

Add `v-data` to any element to turn it into a component with its own reactive data. From there, bind
behavior and content to that data using directives, directly inside your existing markup:

```html
<ul v-data="{ colors: ['Red', 'Orange', 'Yellow'] }">
  <li v-each="color in colors" v-text="color"></li>
</ul>
```

Youla.js ships with:

| Directive        | Purpose                                                              |
| ---------------- | --------------------------------------------------------------------|
| `v-data`         | Marks an element as a component and defines its reactive data       |
| `v-text`         | Sets the element's text content, escaping HTML                      |
| `v-html`         | Sets the element's HTML content                                     |
| `v-show`         | Toggles element visibility via `display`                            |
| `v-each`         | Renders a template element for each item of an array, object, or range |
| `v-prop`         | Two-way binds a form field's value to data                          |
| `:attr`          | Binds any HTML attribute to an expression (e.g. `:class`, `:style`)  |
| `@event`         | Listens for a browser event, with modifiers like `.prevent`/`.once`  |

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
