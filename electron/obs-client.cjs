'use strict';
/**
 * OBS WebSocket client — wraps obs-websocket-js@5 (protocol 5, OBS 28+)
 * Robuste : reconnexion auto, pas de déconnexion sur erreur d'appel API
 */

let OBSWebSocket;
try {
  const mod = require('obs-websocket-js');
  OBSWebSocket = mod.default || mod;
} catch (e) {
  console.warn('[obs] obs-websocket-js not available:', e.message);
}

let obs             = null;
let connected       = false;
let enabled         = false;
let statusCb        = null;
let savedUrl        = 'ws://127.0.0.1:4455';
let savedPassword   = '';
let reconnectTimer  = null;
const RECONNECT_MS  = 5000;

function setStatusCb(fn) { statusCb = fn; }
function isEnabled()     { return enabled; }
function isConnected()   { return connected; }
function getStatus()     { return { enabled, connected }; }

function _emit(extra = {}) {
  if (statusCb) statusCb({ enabled, connected, ...extra });
}

function scheduleReconnect() {
  if (!enabled || reconnectTimer) return;
  console.log(`[obs] reconnexion dans ${RECONNECT_MS / 1000}s…`);
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (!enabled) return;
    console.log('[obs] tentative reconnexion…');
    await _doConnect(savedUrl, savedPassword);
  }, RECONNECT_MS);
}

async function _doConnect(url, password) {
  if (obs) {
    obs.removeAllListeners();
    try { await obs.disconnect(); } catch {}
    obs = null;
  }

  obs = new OBSWebSocket();

  obs.on('ConnectionClosed', (data) => {
    const wasConnected = connected;
    connected = false;
    console.log('[obs] ConnectionClosed', data?.code ?? '');
    if (wasConnected) _emit({ error: 'Connexion OBS fermée' });
    // Reconnexion automatique seulement si on était actif
    if (enabled) scheduleReconnect();
  });

  obs.on('ConnectionError', (err) => {
    console.error('[obs] ConnectionError:', err?.message ?? err);
    // ConnectionClosed sera aussi émis, reconnect y est géré
  });

  try {
    await obs.connect(url, password || undefined);
    connected = true;
    _emit();
    console.log('[obs] connecté à', url);
    return { success: true };
  } catch (err) {
    connected = false;
    _emit({ error: err.message });
    console.error('[obs] connect failed:', err.message);
    if (enabled) scheduleReconnect();
    return { success: false, error: err.message };
  }
}

async function connect({ url = 'ws://127.0.0.1:4455', password = '' } = {}) {
  enabled = true;
  savedUrl      = url;
  savedPassword = password;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  return _doConnect(url, password);
}

async function disconnect() {
  enabled = false;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
  if (obs) {
    obs.removeAllListeners();
    try { await obs.disconnect(); } catch {}
    obs = null;
  }
  connected = false;
  _emit();
}

async function startRecord() {
  if (!connected || !obs) {
    console.warn('[obs] StartRecord ignoré — non connecté');
    return false;
  }
  try {
    await obs.call('StartRecord');
    console.log('[obs] StartRecord ✓');
    return true;
  } catch (err) {
    console.error('[obs] StartRecord échoué:', err.message);
    _emit({ error: `StartRecord: ${err.message}` });
    setTimeout(() => { if (connected) _emit(); }, 3000);
    return false;
  }
}

async function stopRecord() {
  if (!connected || !obs) {
    console.warn('[obs] StopRecord ignoré — non connecté');
    return null;
  }
  try {
    const response = await obs.call('StopRecord');
    const filePath = response?.outputPath || null;
    console.log('[obs] StopRecord ✓, fichier:', filePath);
    return filePath;
  } catch (err) {
    console.error('[obs] StopRecord échoué:', err.message);
    _emit({ error: `StopRecord: ${err.message}` });
    setTimeout(() => { if (connected) _emit(); }, 3000);
    return null;
  }
}

module.exports = { setStatusCb, isEnabled, isConnected, getStatus, connect, disconnect, startRecord, stopRecord };
