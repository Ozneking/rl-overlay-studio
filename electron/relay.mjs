/**
 * RL TCP → WebSocket relay (refactored as an exported function)
 * Can be started from the Electron main process or as a standalone CLI.
 */
import net from 'node:net';
import { WebSocketServer } from 'ws';

/**
 * @param {object} opts
 * @param {string}   [opts.rlHost='127.0.0.1']
 * @param {number}   [opts.rlPort=49123]
 * @param {string}   [opts.relayHost='127.0.0.1']
 * @param {number}   [opts.relayPort=49124]
 * @param {number}   [opts.reconnectMs=2000]
 * @param {function} [opts.onStatus]  callback(statusData) fired on relay state change
 * @returns {{ broadcast: function, stop: function }}
 */
export function startRelay({
  rlHost = '127.0.0.1',
  rlPort = 49123,
  relayHost = '127.0.0.1',
  relayPort = 49124,
  reconnectMs = 2000,
  onStatus = null,
} = {}) {
  const clients = new Set();
  let rlConnected = false;
  let tcp = null;
  let buffer = '';
  let disconnectStatusTimer = null;
  let stopped = false;
  let reconnectTimer = null;

  const wss = new WebSocketServer({ host: relayHost, port: relayPort });

  // ── helpers ──────────────────────────────────────────────────────────────

  function broadcast(obj) {
    const payload = typeof obj === 'string' ? obj : JSON.stringify(obj);
    for (const ws of clients) {
      if (ws.readyState === ws.OPEN) ws.send(payload);
    }
  }

  function sendStatus(extra = {}) {
    const data = { rlConnected, ...extra };
    broadcast({ Event: 'RelayStatus', Data: data });
    onStatus?.(data);
  }

  function markConnected() {
    if (disconnectStatusTimer) { clearTimeout(disconnectStatusTimer); disconnectStatusTimer = null; }
    rlConnected = true;
  }

  function markDisconnected(extra = {}) {
    if (disconnectStatusTimer) clearTimeout(disconnectStatusTimer);
    disconnectStatusTimer = setTimeout(() => {
      rlConnected = false;
      sendStatus(extra);
      disconnectStatusTimer = null;
    }, 750);
  }

  // ── JSON stream parser ────────────────────────────────────────────────────

  function extractJsonObjects() {
    const out = [];
    let depth = 0, inString = false, escaped = false, start = -1;

    for (let i = 0; i < buffer.length; i++) {
      const ch = buffer[i];
      if (inString) {
        if (escaped) { escaped = false; }
        else if (ch === '\\') { escaped = true; }
        else if (ch === '"') { inString = false; }
        continue;
      }
      if (ch === '"') { inString = true; continue; }
      if (ch === '{') { if (depth === 0) start = i; depth++; }
      else if (ch === '}') {
        depth--;
        if (depth === 0 && start !== -1) {
          out.push(buffer.slice(start, i + 1));
          buffer = buffer.slice(i + 1);
          i = -1; start = -1;
        }
      }
    }
    if (buffer.length > 2_000_000) { console.warn('[relay] buffer overflow, clearing'); buffer = ''; }
    return out;
  }

  function normalizeMessage(raw) {
    try {
      const msg = JSON.parse(raw);
      if (typeof msg.Data === 'string') { try { msg.Data = JSON.parse(msg.Data); } catch {} }
      return msg;
    } catch (err) {
      return { Event: 'RelayParseError', Data: { error: err.message, raw: raw.slice(0, 500) } };
    }
  }

  // ── TCP connection ────────────────────────────────────────────────────────

  function connectRL() {
    if (stopped) return;
    if (tcp) { try { tcp.destroy(); } catch {} }

    console.log(`[relay] connecting to RL ${rlHost}:${rlPort}`);
    tcp = net.createConnection({ host: rlHost, port: rlPort }, () => {
      markConnected();
      console.log('[relay] RL TCP connected');
      sendStatus({ message: 'connected_to_rocket_league' });
    });
    tcp.setEncoding('utf8');

    tcp.on('data', (chunk) => {
      buffer += chunk;
      for (const raw of extractJsonObjects()) {
        broadcast(normalizeMessage(raw));
      }
    });

    tcp.on('error', (err) => {
      console.error('[relay] TCP error:', err.message);
      markDisconnected({ error: err.message });
    });

    tcp.on('close', () => {
      if (rlConnected) console.log('[relay] RL TCP disconnected');
      markDisconnected({ message: 'disconnected_from_rocket_league' });
      if (!stopped) reconnectTimer = setTimeout(connectRL, reconnectMs);
    });
  }

  // ── WebSocket server ──────────────────────────────────────────────────────

  wss.on('connection', (ws) => {
    clients.add(ws);
    console.log(`[relay] client connected (${clients.size})`);
    ws.send(JSON.stringify({ Event: 'RelayStatus', Data: { rlConnected, relay: `ws://${relayHost}:${relayPort}` } }));
    ws.on('close', () => {
      clients.delete(ws);
      console.log(`[relay] client disconnected (${clients.size})`);
    });
    ws.on('error', () => clients.delete(ws));
  });

  wss.on('listening', () => {
    console.log(`[relay] WS listening on ws://${relayHost}:${relayPort}`);
    connectRL();
  });

  wss.on('error', (err) => console.error('[relay] WSS error:', err.message));

  // ── public API ────────────────────────────────────────────────────────────

  function stop() {
    stopped = true;
    clearTimeout(reconnectTimer);
    clearTimeout(disconnectStatusTimer);
    try { tcp?.destroy(); } catch {}
    try { wss.close(); } catch {}
  }

  return { broadcast, stop };
}
