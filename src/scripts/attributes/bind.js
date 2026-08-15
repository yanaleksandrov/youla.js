import { updateAttribute } from './attribute';

// Resolves the target attribute name from the ":attr" syntax and writes the
// value onto the element. Called directly by Component rather than registered
// through Youla.directives, since attribute binding is core syntax, not an
// optional/pluggable behavior.
export function bindAttribute(el, output, attribute) {
  updateAttribute(el, attribute.name.replace(':', ''), output);
}
