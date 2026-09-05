/**
 * Reference dev server for editrix's presence + soft-lock collaboration feature.
 *
 * This is NOT a production backend — it's a minimal `ws`-based relay to develop and manually test
 * the client-side collab module (src/editrix/collab/**) against, since this repo has no backend of
 * its own. A real host application swaps out src/editrix/collab/transport-ws.js for its own
 * transport talking to its own realtime infrastructure, satisfying the same {send, on, disconnect}
 * shape; it never needs to run this file.
 *
 * Run standalone: `node server/collab-dev-server.js` (or `npm run dev`, which also starts webpack's
 * own dev server alongside it). Listens on COLLAB_PORT (default 4000).
 *
 * Message types mirror src/editrix/collab/protocol.js's MESSAGE_TYPES — kept in sync by hand since
 * that file is an ES module (bundled by webpack) and this one runs under plain Node/CommonJS.
 */

const { WebSocketServer } = require('ws');

const PORT = process.env.COLLAB_PORT || 4000;
const HEARTBEAT_INTERVAL_MS = 15000;

const MESSAGE_TYPES = {
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
};

// pageId -> { clients: Map<WebSocket, {id, name, avatarUrl}>, locks: Map<blockId, {userId, userName, color, acquiredAt}> }
const rooms = new Map();

function send(ws, type, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type, ...payload }));
  }
}

function broadcast(room, type, payload, exclude) {
  room.clients.forEach((_user, client) => {
    if (client !== exclude) {
      send(client, type, payload);
    }
  });
}

function getRoom(pageId) {
  if (!rooms.has(pageId)) {
    rooms.set(pageId, { clients: new Map(), locks: new Map() });
  }
  return rooms.get(pageId);
}

/**
 * Releases every lock "ws" holds in "room" and tells everyone else — shared by a voluntary
 * lock:release and by disconnect cleanup below.
 */
function releaseAllLocks(room, ws) {
  room.locks.forEach((lock, blockId) => {
    if (lock.ws === ws) {
      room.locks.delete(blockId);
      broadcast(room, MESSAGE_TYPES.LOCK_RELEASED, { blockId }, ws);
    }
  });
}

function handleMessage(wss, ws, raw) {
  let message;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }
  if (!message || typeof message.type !== 'string') {
    return;
  }

  const { room, user } = ws.collab || {};

  if (message.type === MESSAGE_TYPES.HELLO) {
    const joinedRoom = getRoom(message.pageId);
    ws.collab = { pageId: message.pageId, room: joinedRoom, user: message.user };
    joinedRoom.clients.set(ws, message.user);

    send(ws, MESSAGE_TYPES.PRESENCE_SYNC, {
      users: [...joinedRoom.clients.values()],
      locks: [...joinedRoom.locks.entries()].map(([blockId, lock]) => ({ blockId, ...lock, ws: undefined })),
    });
    broadcast(joinedRoom, MESSAGE_TYPES.PRESENCE_JOIN, { user: message.user }, ws);
    return;
  }

  // Every other message type requires an established room membership (a HELLO already processed).
  if (!room || !user) {
    return;
  }

  if (message.type === MESSAGE_TYPES.LOCK_ACQUIRE) {
    const existing = room.locks.get(message.blockId);
    if (existing && existing.ws !== ws) {
      send(ws, MESSAGE_TYPES.LOCK_DENIED, {
        blockId: message.blockId, userId: existing.userId, userName: existing.userName,
      });
      return;
    }
    // No "color" on the wire — every client (this one's own peers included) derives it locally
    // and deterministically from userId (see src/editrix/collab/presence.js's colorForUser()).
    const lock = { ws, userId: user.id, userName: user.name, acquiredAt: Date.now() };
    room.locks.set(message.blockId, lock);
    broadcast(room, MESSAGE_TYPES.LOCK_ACQUIRED, {
      blockId: message.blockId, userId: lock.userId, userName: lock.userName, acquiredAt: lock.acquiredAt,
    }, ws);
    return;
  }

  if (message.type === MESSAGE_TYPES.LOCK_RELEASE) {
    const existing = room.locks.get(message.blockId);
    if (existing && existing.ws === ws) {
      room.locks.delete(message.blockId);
      broadcast(room, MESSAGE_TYPES.LOCK_RELEASED, { blockId: message.blockId }, ws);
    }
    return;
  }

  if (message.type === MESSAGE_TYPES.CHANGE_BLOCK) {
    // Pure relay — the server never stores or diffs block content, it's just a last-write-wins
    // broadcast (see the plan's rationale: the lock already prevents real conflicts).
    broadcast(room, MESSAGE_TYPES.CHANGE_BLOCK, { blockId: message.blockId, settings: message.settings }, ws);
  }
}

function handleClose(ws) {
  const { room, user } = ws.collab || {};
  if (!room) {
    return;
  }
  releaseAllLocks(room, ws);
  room.clients.delete(ws);
  broadcast(room, MESSAGE_TYPES.PRESENCE_LEAVE, { userId: user?.id }, ws);

  if (room.clients.size === 0) {
    rooms.delete(ws.collab.pageId);
  }
}

function start() {
  const wss = new WebSocketServer({ port: PORT });

  // Detects a connection that vanished without a clean close (tab crash, network loss) — ws's
  // standard isAlive/ping/pong pattern.
  const heartbeat = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL_MS);

  wss.on('connection', (ws) => {
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });
    ws.on('message', (raw) => handleMessage(wss, ws, raw));
    ws.on('close', () => handleClose(ws));
  });

  wss.on('close', () => clearInterval(heartbeat));

  console.log(`editrix collab dev server listening on ws://localhost:${PORT}`);
}

start();
