import { closestDirective, domWalk } from './dom';
import { getNestedObjectValue, isUnsafeKey, parsePropPath, toJsPropAccessor } from './object-path';
import { saferEval } from './eval';
import { createMagicVariables, withMagicVariables, getForData } from './magic-variables';
import { getAttributes } from './attributes';
import { storage, isStorageModifier, getStorageType, castToType } from './storage';
import { parseEachExpression } from './directives/u-each';

/**
 * Collects the loop variable names visible to "el": those of an enclosing "u-each" template
 * and those already stored on an enclosing "u-each" clone.
 *
 * @param {HTMLElement} el - The element to start from.
 * @returns {Set<string>} The loop variable names.
 */
function getLoopVariableNames(el) {
  const names = new Set(Object.keys(getForData(el) ?? {}));

  for (let node = el; node; node = node.parentElement) {
    getAttributes(node).filter(({directive}) => directive === 'u-each').forEach(({expression}) => {
      const { item, index } = parseEachExpression(expression);
      [item, index].filter(Boolean).forEach(name => names.add(name));
    });
  }

  return names;
}

/**
 * Picks the object a "u-prop" path is resolved against: "localVariables" (e.g. "u-each" loop
 * variables) when they declare the path's first segment, "data" otherwise.
 *
 * @param {string} expression - The "u-prop" property path.
 * @param {Object} data - The component's data (or scope).
 * @param {Object} [localVariables] - Non-magic helper variables available to the element.
 * @returns {Object} Either "localVariables" or "data".
 */
export function resolvePropSource(expression, data, localVariables = {}) {
  const [key] = parsePropPath(expression);
  return key !== undefined && Object.hasOwn(localVariables, key) ? localVariables : data;
}

/**
 * Prepares every `u-prop` field under `rootElement`: assigns a name, seeds a default, syncs the
 * field's DOM value into data, and restores any persisted `.local`/`.cookie` value.
 *
 * @param {HTMLElement} rootElement - The component's root element.
 * @param {Object} data - The component's raw data object, mutated in place.
 * @param {import('./component').default} [parent] - This component's own parent, if any.
 * @param {string|null} [providerName] - The `Youla.data()` provider name `rootElement` resolved to, if any.
 * @returns {Object} `data`, for convenience (it's also mutated directly).
 */
export function hydrateProps(rootElement, data, parent, providerName = null) {
  domWalk(rootElement, el => getAttributes(el).filter(({directive}) => directive === 'u-prop').forEach(attribute => {
    let {expression, modifiers} = attribute;

    // u-prop only binds to form fields
    if (!['input', 'select', 'textarea'].includes(el.tagName.toLowerCase())) {
      return;
    }

    if (!el.hasAttribute('name')) {
      el.setAttribute('name', expression.replace(/\.(\w+)/g, '[$1]'))
    }

    let [key, ...prop] = parsePropPath(expression);

    const unsafeKey = [key, ...prop].find(isUnsafeKey);
    if (unsafeKey) {
      console.warn(`Youla.js: u-prop expression "${expression}" uses unsafe key "${unsafeKey}" — skipped.`);
      return;
    }

    // A path rooted at a loop variable belongs to the current item, which isn't known until "u-each" renders its clones.
    if (getLoopVariableNames(el).has(key)) {
      return;
    }

    // ".up" forces ownership to start at parent.scope, even if no ancestor has declared the key yet.
    const owner = modifiers.includes('up')
      ? (parent ? parent.scope : data)
      : (parent && key in parent.scope ? parent.scope : data);

    // Narrow on purpose: many providers (e.g. "step") are meant to be extended with arbitrary fields — only warn when the field's own name echoes the provider's name, which is never intentional.
    if (owner[key] === undefined && providerName && owner === data && key === providerName) {
      console.warn(`Youla.js: u-prop="${expression}" on <${rootElement.tagName.toLowerCase()} u-data="${providerName}"> names its field after the very provider it's nested in — "${providerName}" (registered via Youla.data()) never declared a "${key}" field itself, so this likely wasn't meant to invoke that provider at all. Check its own fields for what you meant (e.g. "value"), or rename this field if the collision is accidental.`);
    }

    // Fills in only the missing segments, so sibling paths like "a.b" and "a.c.x" share one "a" without clobbering each other.
    const path = [key, ...prop];
    const leaf = path.pop();
    let target = owner;
    for (const segment of path) {
      if (target[segment] === undefined) {
        target[segment] = {};
      }
      // E.g. u-prop="a" next to u-prop="a.b": "a" already holds a primitive.
      if (target[segment] === null || typeof target[segment] !== 'object') {
        console.warn(`Youla.js: u-prop="${expression}" can't nest under "${segment}", which already holds a non-object value — skipped.`);
        return;
      }
      target = target[segment];
    }

    if (target[leaf] === undefined) {
      let fields = [];
      if (el.type === 'checkbox') {
        // CSS.escape() doesn't cover the quoted attribute-value part, so "/\ in "expression" is escaped by hand.
        fields = closestDirective(el, 'u-data').querySelectorAll(`[${CSS.escape(attribute.name)}="${expression.replace(/["\\]/g, '\\$&')}"]`);
      }

      target[leaf] = fields.length > 1 ? [] : '';
    }

    let value = generateExpressionForProp(el, owner, attribute);

    saferEval(value, withMagicVariables(owner, createMagicVariables(rootElement, el)));

    if (isStorageModifier(modifiers)) {
      const type  = getStorageType(modifiers);
      const value = storage.get(expression, type);

      if (value) {
        owner[expression] = castToType(owner[expression], value);
      }
    }
  }));

  return data;
}

/**
 * Builds the expression that writes a `u-prop` field's current DOM value onto
 * `$data.<expression>`, per the element's type and its `.number`/`.trim` modifiers.
 * `.number`/`.trim` also correct `$el.value` in that same expression, avoiding a flicker
 * before the next reactive refresh would otherwise fix it.
 *
 * @param {HTMLElement} el - The bound form field (input, select, or textarea).
 * @param {Object} data - The component's data object, read to resolve the current bound value.
 * @param {Object} attribute - The parsed `u-prop` attribute descriptor (expression, modifiers).
 * @param {Object} [localVariables] - Non-magic helper variables (e.g. "u-each" loop variables); a path rooted at one is written onto it instead of `$data`.
 * @returns {string} An expression string, e.g. `"$data.count = $el.value"`, ready for saferEval.
 */
export function generateExpressionForProp(el, data, attribute, localVariables = {}) {
  let {expression, modifiers} = attribute;

  // Bracket segments ("user[firstName]") aren't valid bare JS under saferEval's "with($data)", so normalize to a quoted member-access chain every branch below can interpolate freely.
  const accessor = toJsPropAccessor(expression);

  // Loop variables reach the listener as plain parameters (see Component#invokeListener), so they're addressed bare rather than through "$data".
  const source = resolvePropSource(expression, data, localVariables);
  const target = source === localVariables ? accessor : `$data.${accessor}`;

  let rightSideOfExpression, tag = el.tagName.toLowerCase();
  if (el.type === 'checkbox') {
    // If the data we are binding to is an array, toggle its value inside the array.
    let value = getNestedObjectValue(source, expression);
    if (Array.isArray(value)) {
      rightSideOfExpression = `$el.checked ? ${accessor}.concat([$el.value]) : [...${accessor}.splice(0, ${accessor}.indexOf($el.value)), ...${accessor}.splice(${accessor}.indexOf($el.value)+1)]`
    } else {
      rightSideOfExpression = `$el.checked`
    }
  } else if (el.type === 'radio') {
    rightSideOfExpression = `$el.checked ? $el.value : (typeof ${accessor} !== 'undefined' ? ${accessor} : '')`
  } else if (tag === 'select' && el.multiple) {
    rightSideOfExpression = `Array.from($el.selectedOptions).map(option => ${modifiers.includes('number')
      ? 'parseFloat(option.value || option.text)'
      : 'option.value || option.text'})`
  } else if (modifiers.includes('number')) {
    return `($el.value = $el.value.replace(/[^\\d]/g, ''), ${target} = $el.value === '' ? '' : parseFloat($el.value))`
  } else if (modifiers.includes('trim')) {
    rightSideOfExpression = `($el.value = $el.value.replace(/^\\s+|\\s+$/g, ''), $el.value)`
  } else {
    rightSideOfExpression = '$el.value'
  }

  return `${target} = ${rightSideOfExpression}`
}
