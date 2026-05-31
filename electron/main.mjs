/**
 * Electron main process
 * - Starts the RL TCP relay in-process
 * - Creates the control window (config panel + preview)
 * - Registers all IPC handlers
 */
import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron';
import { fileURLToPath } from 'node:url';
import { join, dirname, extname } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';

import { startRelay } from './relay.mjs';
import {
  getConfig, setConfig, listProfiles, saveProfile, loadProfile, deleteProfile,
  setBroadcastFn,
} from './config-store.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

// ── Relay ────────────────────────────────────────────────────────────────────

let relay = null;
let controlWindow = null;
let overlayWindow = null;

function startRelayWithStatus() {
  relay = startRelay({
    rlPort: 49123,
    relayPort: 49124,
    onStatus: (data) => {
      controlWindow?.webContents?.send('relay:status', data);
    },
  });
  setBroadcastFn(relay.broadcast);
}

// ── Static file server for overlay (production) ───────────────────────────────

let overlayServer = null;
const OVERLAY_PORT = 5173;

function serveOverlayStatic() {
  const overlayDist = join(__dirname, '../dist/overlay');
  const mimeTypes = {
    '.html': 'text/html', '.js': 'application/javascript', '.mjs': 'application/javascript',
    '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png',
    '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json',
  };

  overlayServer = createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';
    const filePath = join(overlayDist, urlPath);

    // Serve public/config and public/assets as fallback
    const publicPath = join(__dirname, '../public', urlPath);

    let target = existsSync(filePath) ? filePath : existsSync(publicPath) ? publicPath : null;
    if (!target) target = join(overlayDist, 'index.html'); // SPA fallback

    try {
      const data = readFileSync(target);
      res.writeHead(200, { 'Content-Type': mimeTypes[extname(target)] || 'application/octet-stream' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('Not found');
    }
  });

  overlayServer.listen(OVERLAY_PORT, '127.0.0.1', () => {
    console.log(`[overlay] served on http://127.0.0.1:${OVERLAY_PORT}`);
  });
}

// ── Wait for Vite dev servers ─────────────────────────────────────────────────

async function waitForServer(url, attempts = 40) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(500) });
      if (res.ok || res.status < 500) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

// ── Windows ───────────────────────────────────────────────────────────────────

function createControlWindow() {
  controlWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    title: 'RL Overlay Studio',
    backgroundColor: '#0c0c14',
    frame: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  controlWindow.once('ready-to-show', () => controlWindow.show());
  controlWindow.on('closed', () => { controlWindow = null; });

  if (isDev) {
    controlWindow.loadURL('http://127.0.0.1:5174');
    // controlWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    controlWindow.loadFile(join(__dirname, '../dist/control/index.html'));
  }
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.focus();
    return;
  }

  overlayWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Overlay Preview',
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: false,
    resizable: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  overlayWindow.loadURL('http://127.0.0.1:5173');
  overlayWindow.on('closed', () => { overlayWindow = null; });
}

// ── IPC Handlers ──────────────────────────────────────────────────────────────

function registerIPC() {
  // Config
  ipcMain.handle('config:get', () => getConfig());
  ipcMain.handle('config:set', (_, partial) => setConfig(partial));

  // Profiles
  ipcMain.handle('config:list-profiles', () => listProfiles());
  ipcMain.handle('config:save-profile', (_, name) => saveProfile(name));
  ipcMain.handle('config:load-profile', (_, name) => loadProfile(name));
  ipcMain.handle('config:delete-profile', (_, name) => deleteProfile(name));

  // Mock events
  ipcMain.handle('relay:mock-event', (_, type) => {
    if (!relay) return;
    const events = {
      goal: { Event: 'GoalScored', Data: { Scorer: { Name: 'MOCK PLAYER', TeamNum: 0 }, Assister: null } },
      save: { Event: 'StatfeedEvent', Data: { MainTarget: { Name: 'MOCK PLAYER', TeamNum: 1 }, Type: 'SAVE' } },
      demo: { Event: 'StatfeedEvent', Data: { MainTarget: { Name: 'MOCK PLAYER', TeamNum: 0 }, Type: 'DEMOLISH' } },
      shot: { Event: 'StatfeedEvent', Data: { MainTarget: { Name: 'MOCK PLAYER', TeamNum: 0 }, Type: 'SHOT' } },
    };
    relay.broadcast(events[type] || events.goal);
  });

  // Windows
  ipcMain.handle('overlay:open-window', () => createOverlayWindow());

  // File dialog for logos
  ipcMain.handle('dialog:pick-logo', async (_, side) => {
    const result = await dialog.showOpenDialog(controlWindow, {
      title: `Choisir le logo ${side === 'left' ? 'gauche' : 'droit'}`,
      filters: [{ name: 'Images', extensions: ['svg', 'png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    // Return as file:// URL so the overlay iframe can load it
    return `file://${result.filePaths[0].replace(/\\/g, '/')}`;
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  startRelayWithStatus();
  registerIPC();

  if (isDev) {
    console.log('[main] dev mode — waiting for Vite servers…');
    await Promise.all([
      waitForServer('http://127.0.0.1:5173'),
      waitForServer('http://127.0.0.1:5174'),
    ]);
    console.log('[main] Vite ready');
  } else {
    serveOverlayStatic();
  }

  createControlWindow();
});

app.on('window-all-closed', () => {
  relay?.stop();
  overlayServer?.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
});
