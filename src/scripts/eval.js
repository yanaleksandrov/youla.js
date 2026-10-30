// `new Function` is a real parse+compile, so the same expression text (paired with the same helper-variable names) is compiled once and cached instead of recompiled on every evaluation.
const compiledCache = new Map();

/**
 * Evaluates a JS expression (or runs a statement, if "noReturn" is set) against a data context —
 * every property of "dataContext" is reachable by name via "with", and helper variables shadow it.
 * Runs as real, unrestricted JavaScript: never interpolate untrusted data into an expression that reaches this function.
 *
 * @param {string} expression - The expression (or, if "noReturn" is true, statement) to evaluate.
 * @param {object} dataContext - The component's reactive data, made available as bare identifiers.
 * @param {object} [additionalHelperVariables] - Extra named values (e.g. loop variables) that take precedence over "dataContext".
 * @param {boolean} [noReturn] - When true, runs "expression" as a statement instead of evaluating and returning it.
 * @returns {*} The expression's value, or undefined when "noReturn" is true.
 */
export function saferEval(expression, dataContext, additionalHelperVariables = {}, noReturn = false) {
  const helperNames = Object.keys(additionalHelperVariables);
  const cacheKey     = `${noReturn ? 1 : 0}:${helperNames.join(',')}:${expression}`;

  let fn = compiledCache.get(cacheKey);
  if (!fn) {
    // Helpers are the arrow's parameters, so they sit lexically inside with($data) and win over same-named data; an assignment to one stays local to the call.
    const body = noReturn ? `{${expression}\n}` : `(${expression}\n)`;

    fn = new Function('$data', `with($data){return (${helperNames.join(',')}) => ${body}}`);
    compiledCache.set(cacheKey, fn);
  }

  return fn(dataContext)(...Object.values(additionalHelperVariables));
}
