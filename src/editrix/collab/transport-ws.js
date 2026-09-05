import { MESSAGE_TYPES, buildMessage, parseMessage } from './protocol';

// Reconnect backoff steps (ms), capped at the last value.
const RECONNECT_DELAYS = [1000, 2000, 5000, 10000];

/**
 * The only file that touches `window.WebSocket` — everything else in editrix/collab talks to a
 * transport purely through the `{send, on, disconnect}` shape below, so a real host backend can
 * swap this one file out for its own realtime transport without touching anything else.
 *
 * @param {string} url - The collab server's WebSocket URL.
 * @returns {{ connect(pageId: string, user: Object): { send: Function, on: Function, disconnect: Function } }}
 */
export function createWsTransport(url) {
  return {
    connect(pageId, user) {
      const handlers = new Map();
      let socket = null;
      let reconnectAttempt = 0;
      let reconnectTimer = null;
      let closedByCaller = false;
      let queue = [];

      function emit(type, payload) {
        (handlers.get(type) || []).forEach((cb) => cb(payload));
      }

      function flushQueue() {
        queue.forEach(({ type, payload }) => socket.send(buildMessage(type, payload)));
        queue = [];
      }

      function open() {
        socket = new WebSocket(url);

        socket.addEventListener('open', () => {
          reconnectAttempt = 0;
          socket.send(buildMessage(MESSAGE_TYPES.HELLO, { pageId, user }));
          flushQueue();
        });

        socket.addEventListener('message', (event) => {
          const message = parseMessage(event.data);
          if (message) {
            emit(message.type, message);
          }
        });

        socket.addEventListener('close', () => {
          if (closedByCaller) {
            return;
          }
          const delay = RECONNECT_DELAYS[Math.min(reconnectAttempt, RECONNECT_DELAYS.length - 1)];
          reconnectAttempt += 1;
          reconnectTimer = setTimeout(open, delay);
        });
      }

      open();

      return {
        send(type, payload) {
          if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(buildMessage(type, payload));
          } else {
            queue.push({ type, payload });
          }
        },
        on(type, callback) {
          if (!handlers.has(type)) {
            handlers.set(type, []);
          }
          handlers.get(type).push(callback);
        },
        disconnect() {
          closedByCaller = true;
          clearTimeout(reconnectTimer);
          socket?.close();
        },
      };
    },
  };
}
