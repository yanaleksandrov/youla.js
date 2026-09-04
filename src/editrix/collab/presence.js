import { FILLER_PALETTE } from '../../youla-filler';

/**
 * Deterministic user -> color assignment, so every connected peer (and the relay server, which
 * never computes or stores a color) independently derives the same swatch for the same user id
 * without any extra message round-trip. Reuses v-filler's own PALETTE (youla-filler.js) rather
 * than inventing a second one, per the project's "reuse v-filler for color pickers" convention.
 *
 * @param {string} userId
 * @returns {string} A hex color from FILLER_PALETTE.
 */
export function colorForUser(userId) {
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return FILLER_PALETTE[hash % FILLER_PALETTE.length].hex;
}

/**
 * Replaces the whole roster with a fresh snapshot (a `presence:sync` reply).
 *
 * @param {Array} _list - Unused; kept for a consistent reducer signature with the other two.
 * @param {Array} users
 * @returns {Array}
 */
export function applyPresenceSync(_list, users) {
  return [...(users || [])];
}

/**
 * Adds "user" to "list" if they aren't already on it (join messages can arrive more than once —
 * e.g. a reconnect racing a "presence:sync" — so this stays idempotent).
 *
 * @param {Array} list
 * @param {Object} user - {id, name, avatarUrl}
 * @returns {Array}
 */
export function applyPresenceJoin(list, user) {
  if (!user || list.some((existing) => existing.id === user.id)) {
    return list;
  }
  return [...list, user];
}

/**
 * Removes the user "userId" from "list".
 *
 * @param {Array} list
 * @param {string} userId
 * @returns {Array}
 */
export function applyPresenceLeave(list, userId) {
  return list.filter((user) => user.id !== userId);
}
