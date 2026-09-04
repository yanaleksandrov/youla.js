/**
 * Wire protocol for editrix's presence + soft-lock collaboration feature — JSON text frames over a
 * plain `{send, on, disconnect}` transport (see transport-ws.js). Framework-free and dependency-free
 * on purpose so it stays trivially unit-testable; the reference dev server (server/collab-dev-server.js)
 * intentionally duplicates these type strings rather than sharing this module, since it runs under
 * plain Node (CommonJS) while this file is bundled as an ES module — keep the two in sync by hand.
 */

export const MESSAGE_TYPES = Object.freeze({
  HELLO: 'hello',
  PRESENCE_SYNC: 'presence:sync',
  PRESENCE_JOIN: 'presence:join',
  PRESENCE_LEAVE: 'presence:leave',
  LOCK_ACQUIRE: 'lock:acquire',
  LOCK_ACQUIRED: 'lock:acquired',
  LOCK_DENIED: 'lock:denied',
  LOCK_RELEASE: 'lock:release',
  LOCK_RELEASED: 'lock:released',
  CHANGE_BLOCK: 'change:block',
});

/**
 * @param {string} type - One of MESSAGE_TYPES.
 * @param {Object} [payload]
 * @returns {string} A JSON frame ready to send over the transport.
 */
export function buildMessage(type, payload = {}) {
  return JSON.stringify({ type, ...payload });
}

/**
 * @param {string} raw - A frame received from the transport.
 * @returns {Object|null} The parsed message, or null if it's malformed/not a recognized shape.
 */
export function parseMessage(raw) {
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  return data && typeof data === 'object' && typeof data.type === 'string' ? data : null;
}
