/**
 * Toolbox > Position section's own "Borders" control — a fixed, single-instance control (not a
 * name-keyed setting), so its own state (border-anchored margin) lives here rather than going
 * through getValue()/setValue() (controls/base.js). Cloned from "editrix-control-borders" by
 * convention (controls/render.js's renderField(), no renderer registered for "borders").
 */

export function createBordersControl() {
  return {
    marginTop: 0,
    marginEnd: 0,
    marginBottom: 0,
    marginStart: 0,
  };
}
