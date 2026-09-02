// Toolbox > Position section's own "Borders" control — fixed, single-instance state (border-anchored
// margin), not routed through getValue()/setValue() (controls/base.js).

export function createBordersControl() {
  return {
    marginTop: 0,
    marginEnd: 0,
    marginBottom: 0,
    marginStart: 0,
  };
}
