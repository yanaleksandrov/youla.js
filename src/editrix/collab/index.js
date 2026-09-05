import { MESSAGE_TYPES } from './protocol';
import { applyPresenceSync, applyPresenceJoin, applyPresenceLeave } from './presence';
import { applyLockAcquired, applyLockReleased } from './lock';

// Trailing debounce for change:block broadcasts, so rapid keystrokes in a rich-text field (or a
// dragged slider) don't flood the wire — one relay per pause in typing/dragging is plenty, since
// the lock already keeps anyone else from editing the same block in the meantime.
const BROADCAST_DEBOUNCE_MS = 400;

/**
 * Orchestrates one page's collaboration session: presence roster, per-block lock map, and outgoing/
 * incoming change relaying. Framework-agnostic — the caller (connectCollab() in youla-editrix.js)
 * is the only thing that knows about Youla's reactive `component` object; this module just calls
 * plain callbacks with plain new arrays/objects.
 *
 * @param {Object} options
 * @param {string} options.pageId
 * @param {Object} options.user - {id, name, avatarUrl}
 * @param {{connect: Function}} options.transport - see transport-ws.js's createWsTransport().
 * @param {(users: Array) => void} [options.onPresenceChange]
 * @param {(locks: Object) => void} [options.onLockChange]
 * @param {(blockId: string, settings: Object) => void} [options.onRemoteChange]
 * @returns {{acquireLock: Function, releaseLock: Function, broadcastChange: Function, destroy: Function}}
 */
export function createCollab({ pageId, user, transport, onPresenceChange, onLockChange, onRemoteChange }) {
  let presentUsers = [];
  let locks = {};
  const debounceTimers = new Map();

  const session = transport.connect(pageId, user);

  session.on(MESSAGE_TYPES.PRESENCE_SYNC, ({ users, locks: lockList }) => {
    // The snapshot includes this connection's own just-registered entry — filtered out here so
    // "presentUsers" only ever lists *other* people, as the toolbar avatar strip expects.
    presentUsers = applyPresenceSync(presentUsers, (users || []).filter((peer) => peer.id !== user.id));
    onPresenceChange?.(presentUsers);

    locks = (lockList || []).reduce((map, lock) => applyLockAcquired(map, lock), {});
    onLockChange?.(locks);
  });

  session.on(MESSAGE_TYPES.PRESENCE_JOIN, ({ user: joined }) => {
    presentUsers = applyPresenceJoin(presentUsers, joined);
    onPresenceChange?.(presentUsers);
  });

  session.on(MESSAGE_TYPES.PRESENCE_LEAVE, ({ userId }) => {
    presentUsers = applyPresenceLeave(presentUsers, userId);
    onPresenceChange?.(presentUsers);
  });

  session.on(MESSAGE_TYPES.LOCK_ACQUIRED, (lock) => {
    locks = applyLockAcquired(locks, lock);
    onLockChange?.(locks);
  });

  session.on(MESSAGE_TYPES.LOCK_DENIED, (lock) => {
    // We lost a same-instant race for this block — adopt whatever the server settled on instead
    // of our own optimistic guess (see acquireLock() below).
    locks = applyLockAcquired(locks, lock);
    onLockChange?.(locks);
  });

  session.on(MESSAGE_TYPES.LOCK_RELEASED, ({ blockId }) => {
    locks = applyLockReleased(locks, blockId);
    onLockChange?.(locks);
  });

  session.on(MESSAGE_TYPES.CHANGE_BLOCK, ({ blockId, settings }) => {
    onRemoteChange?.(blockId, settings);
  });

  return {
    /**
     * Optimistically locks "blockId" for the local user immediately, then asks the server to
     * confirm — if another client wins the race, a later "lock:denied" corrects the local map.
     *
     * @param {string} blockId
     */
    acquireLock(blockId) {
      locks = applyLockAcquired(locks, {
        blockId, userId: user.id, userName: user.name, acquiredAt: Date.now(),
      });
      onLockChange?.(locks);
      session.send(MESSAGE_TYPES.LOCK_ACQUIRE, { blockId });
    },

    /**
     * @param {string} blockId
     */
    releaseLock(blockId) {
      locks = applyLockReleased(locks, blockId);
      onLockChange?.(locks);
      session.send(MESSAGE_TYPES.LOCK_RELEASE, { blockId });
    },

    /**
     * Debounced per block — see BROADCAST_DEBOUNCE_MS.
     *
     * @param {string} blockId
     * @param {Object} settings - The block's current `component.settings[blockId]`.
     */
    broadcastChange(blockId, settings) {
      clearTimeout(debounceTimers.get(blockId));
      debounceTimers.set(blockId, setTimeout(() => {
        session.send(MESSAGE_TYPES.CHANGE_BLOCK, { blockId, settings });
        debounceTimers.delete(blockId);
      }, BROADCAST_DEBOUNCE_MS));
    },

    destroy() {
      debounceTimers.forEach(clearTimeout);
      debounceTimers.clear();
      session.disconnect();
    },
  };
}
