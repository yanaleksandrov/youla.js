/**
 * Attribute handling
 *
 * Everything about writing a value onto an element's attributes/properties —
 * a third kind of interaction with elements alongside directives (behavior)
 * and methods (callable helpers in expressions). Unlike those two, it isn't a
 * registry of pluggable, user-named entries: it's the fixed, built-in mechanism
 * behind the ":attr" syntax. getAttributes() (see ../helpers) flags these
 * attributes directly, so Component dispatches them here instead of through
 * Youla.directives/Youla.methods.
 */
export { bindAttribute } from './bind';
export { updateAttribute, updateSelect } from './attribute';
