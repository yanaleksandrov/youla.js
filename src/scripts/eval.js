/**
 * Evaluates a JavaScript expression (or runs a statement, if "noReturn" is set) against a data
 * context — every property of "dataContext" is reachable in the expression by name via "with",
 * and any extra helper variables (e.g. "$event", "$el") are exposed as real function parameters.
 *
 * Every directive/event/binding expression in the whole library goes through this function —
 * "expression" runs as real, unrestricted JavaScript (via "new Function"), not a sandboxed
 * mini-language. This is the same trust boundary "u-html" documents for markup, just extended to
 * every attribute value: "u-text", "u-show", ":class", "@click", a "u-bind" object's values — all
 * of it. Never interpolate untrusted (user-supplied) data into an attribute value that ends up
 * here — that's arbitrary code execution, not merely unescaped HTML.
 *
 * @param {string} expression - The expression (or, if "noReturn" is true, statement) to evaluate.
 * @param {object} dataContext - The component's reactive data, made available as bare identifiers.
 * @param {object} [additionalHelperVariables] - Extra named values (e.g. "$el", "$event") exposed to the expression.
 * @param {boolean} [noReturn] - When true, runs "expression" as a statement instead of evaluating and returning it.
 * @returns {*} The expression's value, or undefined when "noReturn" is true.
 */
// Every directive/event/binding attribute on the page runs through here, on every domWalk pass —
// `new Function` is a real parse+compile, not a cheap call, so the same expression text (paired
// with the same helper-variable names, which shape the compiled function's own parameter list)
// is compiled once and reused instead of recompiled from scratch on every single evaluation.
const compiledCache = new Map();

export function saferEval(expression, dataContext, additionalHelperVariables = {}, noReturn = false) {
  const helperNames = Object.keys(additionalHelperVariables);
  const cacheKey     = `${noReturn ? 1 : 0}:${helperNames.join(',')}:${expression}`;

  let fn = compiledCache.get(cacheKey);
  if (!fn) {
    // No intermediate variable like "result": with($data) would let a same-named data property silently hijack it.
    const body = noReturn ? `with($data){${expression}}` : `with($data){return (${expression})}`;

    fn = new Function(['$data', ...helperNames], body);
    compiledCache.set(cacheKey, fn);
  }

  return fn(dataContext, ...Object.values(additionalHelperVariables));
}
