export function extend(...args) {
  args.forEach(fn => typeof fn === 'function' && fn());
}
