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
