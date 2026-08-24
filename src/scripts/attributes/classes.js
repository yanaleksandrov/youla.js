/**
 * Applies a `:class` binding to an element, accepting an array, a function
 * returning a class string, a Vue-style class-toggle object ({ className:
 * bool }), or a plain class string/expression. Object values are delegated
 * to setClassesFromObject; everything else goes through setClassesFromString.
 *
 * @param {HTMLElement} el - The element to update.
 * @param {Array|Function|Object|string|boolean} value - The bound `:class` value.
 * @returns {Function} An "undo" callback that reverts exactly the classes this call added/removed.
 */
export function setClasses(el, value) {
  if (Array.isArray(value)) {
    value = value.join(' ');
  } else if (typeof value === 'function') {
    value = value();
  } else if (typeof value === 'object' && value !== null) {
    // Use the class object syntax that vue uses to toggle them.
    return setClassesFromObject(el, value);
  }

  // set classes from string
  return setClassesFromString(el, value);
}

/**
 * Adds whichever classes in "classString" the element doesn't already have,
 * and returns a callback that removes exactly those classes again.
 *
 * @param {HTMLElement} el - The element to update.
 * @param {string|boolean} classString - A space-separated class list. `true` and falsy values are treated as empty, so short-circuit expressions like `:class="show || 'hidden'"` don't add a literal "true" class.
 * @returns {Function} An "undo" callback that removes the classes that were added.
 */
function setClassesFromString(el, classString) {
  let missingClasses = classString => classString.split(' ').filter(i => ! el.classList.contains(i)).filter(Boolean)

  let addClassesAndReturnUndo = classes => {
    el.classList.add(...classes)

    return () => el.classList.remove(...classes)
  }

  // This is to allow short-circuit expressions like: :class="show || 'hidden'" && "show && 'block'"
  classString = classString === true ? '' : (classString || '')

  return addClassesAndReturnUndo(missingClasses(classString))
}

/**
 * Applies the Vue-style class-toggle object syntax: each key is a (possibly
 * multi-class) string, and its boolean value decides whether to add or remove
 * it. Only touches classes whose current presence doesn't already match, and
 * returns a callback that reverts exactly those changes.
 *
 * @param {HTMLElement} el - The element to update.
 * @param {Object.<string, boolean>} classObject - Map of class string to whether it should be present.
 * @returns {Function} An "undo" callback that restores the classes added/removed by this call.
 */
function setClassesFromObject(el, classObject) {
  let classes = Object.entries(classObject),
      split   = classString => classString.split(' ').filter(Boolean)

  let forAdd    = classes.flatMap(([classString, bool]) => bool ? split(classString) : false).filter(Boolean)
  let forRemove = classes.flatMap(([classString, bool]) => !bool ? split(classString) : false).filter(Boolean)

  const added   = forAdd.filter(i => !el.classList.contains(i) && (el.classList.add(i), true));
  const removed = forRemove.filter(i => el.classList.contains(i) && (el.classList.remove(i), true));

  return () => {
    removed.forEach(i => el.classList.add(i))
    added.forEach(i => el.classList.remove(i))
  }
}
