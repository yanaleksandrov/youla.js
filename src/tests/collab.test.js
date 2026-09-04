import { describe, it, expect, vi } from 'vitest';
import { MESSAGE_TYPES, buildMessage, parseMessage } from '../editrix/collab/protocol';
import { colorForUser, applyPresenceSync, applyPresenceJoin, applyPresenceLeave } from '../editrix/collab/presence';
import { applyLockAcquired, applyLockReleased, isLockedByOther } from '../editrix/collab/lock';
import { createCollab } from '../editrix/collab';

describe('protocol', () => {
  it('round-trips a message through buildMessage/parseMessage', () => {
    const raw = buildMessage(MESSAGE_TYPES.LOCK_ACQUIRE, { blockId: 'block-1' });
    expect(parseMessage(raw)).toEqual({ type: MESSAGE_TYPES.LOCK_ACQUIRE, blockId: 'block-1' });
  });

  it('builds a message with no payload', () => {
    expect(parseMessage(buildMessage(MESSAGE_TYPES.PRESENCE_LEAVE))).toEqual({ type: MESSAGE_TYPES.PRESENCE_LEAVE });
  });

  it('returns null for malformed JSON', () => {
    expect(parseMessage('not json')).toBeNull();
  });

  it('returns null for a well-formed frame with no "type"', () => {
    expect(parseMessage(JSON.stringify({ blockId: 'block-1' }))).toBeNull();
  });

  it('returns null for a non-object frame (e.g. a bare number or array)', () => {
    expect(parseMessage('42')).toBeNull();
    expect(parseMessage('[1,2,3]')).toBeNull();
  });
});

describe('presence', () => {
  it('colorForUser is deterministic for the same id', () => {
    expect(colorForUser('user-1')).toBe(colorForUser('user-1'));
  });

  it('colorForUser spreads different ids across the palette', () => {
    const colors = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(colorForUser));
    expect(colors.size).toBeGreaterThan(1);
  });

  it('applyPresenceSync replaces the roster wholesale', () => {
    const list = applyPresenceSync([{ id: 'stale' }], [{ id: 'user-1', name: 'A' }]);
    expect(list).toEqual([{ id: 'user-1', name: 'A' }]);
  });

  it('applyPresenceJoin adds a new user', () => {
    const list = applyPresenceJoin([], { id: 'user-1', name: 'A' });
    expect(list).toEqual([{ id: 'user-1', name: 'A' }]);
  });

  it('applyPresenceJoin is idempotent for an already-present user', () => {
    const list = [{ id: 'user-1', name: 'A' }];
    expect(applyPresenceJoin(list, { id: 'user-1', name: 'A' })).toBe(list);
  });

  it('applyPresenceLeave removes the matching user', () => {
    const list = applyPresenceLeave([{ id: 'user-1' }, { id: 'user-2' }], 'user-1');
    expect(list).toEqual([{ id: 'user-2' }]);
  });
});

describe('lock', () => {
  it('applyLockAcquired adds a lock entry', () => {
    const locks = applyLockAcquired({}, { blockId: 'block-1', userId: 'user-1', userName: 'A', acquiredAt: 1 });
    expect(locks).toEqual({ 'block-1': { userId: 'user-1', userName: 'A', color: undefined, acquiredAt: 1 } });
  });

  it('applyLockReleased removes a lock entry', () => {
    const locks = applyLockReleased({ 'block-1': { userId: 'user-1' } }, 'block-1');
    expect(locks).toEqual({});
  });

  it('applyLockReleased is a no-op for a block with no lock', () => {
    const locks = { 'block-2': { userId: 'user-1' } };
    expect(applyLockReleased(locks, 'block-1')).toBe(locks);
  });

  it('isLockedByOther is true for a lock held by a different user', () => {
    const locks = { 'block-1': { userId: 'user-2' } };
    expect(isLockedByOther(locks, 'block-1', 'user-1')).toBe(true);
  });

  it('isLockedByOther is false for a lock held by the same user', () => {
    const locks = { 'block-1': { userId: 'user-1' } };
    expect(isLockedByOther(locks, 'block-1', 'user-1')).toBe(false);
  });

  it('isLockedByOther is false for an unlocked block', () => {
    expect(isLockedByOther({}, 'block-1', 'user-1')).toBe(false);
  });
});

/**
 * A minimal in-memory stand-in for transport-ws.js's createWsTransport(url).connect(...), so
 * createCollab() can be exercised without a real WebSocket/server.
 */
function fakeTransport() {
  const handlers = new Map();
  const sent = [];
  return {
    sent,
    emit(type, payload) {
      (handlers.get(type) || []).forEach((cb) => cb(payload));
    },
    connect: () => ({
      send: vi.fn((type, payload) => sent.push({ type, payload })),
      on: (type, cb) => {
        if (!handlers.has(type)) handlers.set(type, []);
        handlers.get(type).push(cb);
      },
      disconnect: vi.fn(),
    }),
  };
}

describe('createCollab', () => {
  const user = { id: 'user-1', name: 'A' };

  it('excludes the local user from a presence:sync snapshot', () => {
    const transport = fakeTransport();
    const onPresenceChange = vi.fn();
    createCollab({ pageId: 'p', user, transport, onPresenceChange });

    transport.emit(MESSAGE_TYPES.PRESENCE_SYNC, { users: [user, { id: 'user-2', name: 'B' }], locks: [] });

    expect(onPresenceChange).toHaveBeenCalledWith([{ id: 'user-2', name: 'B' }]);
  });

  it('applies a presence:join/leave pair', () => {
    const transport = fakeTransport();
    const onPresenceChange = vi.fn();
    createCollab({ pageId: 'p', user, transport, onPresenceChange });

    transport.emit(MESSAGE_TYPES.PRESENCE_JOIN, { user: { id: 'user-2', name: 'B' } });
    expect(onPresenceChange).toHaveBeenLastCalledWith([{ id: 'user-2', name: 'B' }]);

    transport.emit(MESSAGE_TYPES.PRESENCE_LEAVE, { userId: 'user-2' });
    expect(onPresenceChange).toHaveBeenLastCalledWith([]);
  });

  it('acquireLock optimistically locks locally and sends lock:acquire', () => {
    const transport = fakeTransport();
    const onLockChange = vi.fn();
    const collab = createCollab({ pageId: 'p', user, transport, onLockChange });

    collab.acquireLock('block-1');

    expect(onLockChange).toHaveBeenCalledWith(expect.objectContaining({
      'block-1': expect.objectContaining({ userId: 'user-1' }),
    }));
    expect(transport.sent).toContainEqual({ type: MESSAGE_TYPES.LOCK_ACQUIRE, payload: { blockId: 'block-1' } });
  });

  it('releaseLock clears the local lock and sends lock:release', () => {
    const transport = fakeTransport();
    const onLockChange = vi.fn();
    const collab = createCollab({ pageId: 'p', user, transport, onLockChange });

    collab.acquireLock('block-1');
    collab.releaseLock('block-1');

    expect(onLockChange).toHaveBeenLastCalledWith({});
    expect(transport.sent).toContainEqual({ type: MESSAGE_TYPES.LOCK_RELEASE, payload: { blockId: 'block-1' } });
  });

  it('adopts the server-confirmed lock on lock:denied', () => {
    const transport = fakeTransport();
    const onLockChange = vi.fn();
    createCollab({ pageId: 'p', user, transport, onLockChange });

    transport.emit(MESSAGE_TYPES.LOCK_DENIED, { blockId: 'block-1', userId: 'user-2', userName: 'B' });

    expect(onLockChange).toHaveBeenCalledWith(expect.objectContaining({
      'block-1': expect.objectContaining({ userId: 'user-2' }),
    }));
  });

  it('forwards a change:block message to onRemoteChange', () => {
    const transport = fakeTransport();
    const onRemoteChange = vi.fn();
    createCollab({ pageId: 'p', user, transport, onRemoteChange });

    transport.emit(MESSAGE_TYPES.CHANGE_BLOCK, { blockId: 'block-1', settings: { title: 'Hi' } });

    expect(onRemoteChange).toHaveBeenCalledWith('block-1', { title: 'Hi' });
  });

  it('debounces broadcastChange, sending only the latest settings after a pause', async () => {
    vi.useFakeTimers();
    const transport = fakeTransport();
    const collab = createCollab({ pageId: 'p', user, transport });

    collab.broadcastChange('block-1', { title: 'First' });
    collab.broadcastChange('block-1', { title: 'Second' });
    vi.advanceTimersByTime(500);

    const changeSends = transport.sent.filter((m) => m.type === MESSAGE_TYPES.CHANGE_BLOCK);
    expect(changeSends).toEqual([{ type: MESSAGE_TYPES.CHANGE_BLOCK, payload: { blockId: 'block-1', settings: { title: 'Second' } } }]);
    vi.useRealTimers();
  });

  it('destroy() disconnects the transport', () => {
    const transport = fakeTransport();
    let disconnect;
    const originalConnect = transport.connect;
    transport.connect = (...args) => {
      const session = originalConnect(...args);
      disconnect = session.disconnect;
      return session;
    };
    const collab = createCollab({ pageId: 'p', user, transport });

    collab.destroy();

    expect(disconnect).toHaveBeenCalled();
  });
});
