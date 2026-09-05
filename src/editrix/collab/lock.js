/**
 * Pure reducers over a block-lock map: `{ [blockId]: {userId, userName, color, acquiredAt} }`.
 * Never mutates its input — every function returns a new map, so callers can assign the result
 * straight onto a reactive `component.locks` field (see youla-editrix.js's connectCollab()).
 */

/**
 * @param {Object} locks
 * @param {Object} lock - {blockId, userId, userName, color, acquiredAt}
 * @returns {Object}
 */
export function applyLockAcquired(locks, { blockId, userId, userName, color, acquiredAt }) {
  return { ...locks, [blockId]: { userId, userName, color, acquiredAt } };
}

/**
 * @param {Object} locks
 * @param {string} blockId
 * @returns {Object}
 */
export function applyLockReleased(locks, blockId) {
  if (!(blockId in locks)) {
    return locks;
  }
  const next = { ...locks };
  delete next[blockId];
  return next;
}

/**
 * @param {Object} locks
 * @param {string} blockId
 * @param {string} selfUserId
 * @returns {boolean} Whether "blockId" is currently locked by someone other than "selfUserId".
 */
export function isLockedByOther(locks, blockId, selfUserId) {
  const lock = locks[blockId];
  return !!lock && lock.userId !== selfUserId;
}
