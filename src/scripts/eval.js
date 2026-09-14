// `new Function` is a real parse+compile, so the same expression text (paired with the same helper-variable names) is compiled once and cached instead of recompiled on every evaluation.
const compiledCache = new Map();

/**
 * Evaluates a JS expression (or runs a statement, if "noReturn" is set) against a data context —
 * every property of "dataContext" is reachable by name via "with". Runs as real, unrestricted
 * JavaScript: never interpolate untrusted data into an expression that reaches this function.
 *
 * @param {string} expression - The expression (or, if "noReturn" is true, statement) to evaluate.
 * @param {object} dataContext - The component's reactive data, made available as bare identifiers.
 * @param {object} [additionalHelperVariables] - Extra named values (e.g. "$el", "$event") exposed to the expression.
 * @param {boolean} [noReturn] - When true, runs "expression" as a statement instead of evaluating and returning it.
 * @returns {*} The expression's value, or undefined when "noReturn" is true.
 */
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
