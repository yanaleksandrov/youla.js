// Shared implementation behind directive()/method(): assigns a named callback
// onto a Youla.js registry object, warning instead of overwriting if the name
// is already taken.
export function register(kind, target, name, callback) {
  if (!target[name]) {
    target[name] = callback;
  } else {
    console.warn(`Youla.js: ${kind} '${name}' is already exists.`);
  }
}
