'use strict';
/**
 * Electron main process (CommonJS)
 */
const { app, BrowserWindow, WebContentsView, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs  = require('node:fs');
const http = require('node:http');

const { startRelay }  = require('./relay.cjs');
const configStore     = require('./config-store.cjs');
const obsClient       = require('./obs-client.cjs');

const isDev = !app.isPackaged;

let relay         = null;
let controlWindow = null;
let overlayWindow = null;
let overlayServer = null;
let previewView   = null;          // WebContentsView for embedded preview
const OVERLAY_PORT = 5173;

// ── Replay / OBS clip state ───────────────────────────────────────────────────
let currentMatchGoals = [];
let clipIndex         = 0;
let wasReplay         = false;   // track bReplay state change
let isRecording       = false;   // OBS currently recording a replay
let matchEnded        = false;   // true après MatchEnded → bloque tout bReplay post-match
const PUBLIC_REPLAYS  = path.join(__dirname, '../public/replays');

function ensureReplaysDir() {
  if (!fs.existsSync(PUBLIC_REPLAYS)) fs.mkdirSync(PUBLIC_REPLAYS, { recursive: true });
}

function writePlaylist() {
  try {
    ensureReplaysDir();
    const playlist = { matchId: Date.now().toString(36), clips: currentMatchGoals.filter(g => g.clipSrc) };
    fs.writeFileSync(path.join(PUBLIC_REPLAYS, 'playlist.json'), JSON.stringify(playlist, null, 2));
  } catch (err) { console.error('[replay] writePlaylist:', err.message); }
}

function notifyClipsUpdate() {
  if (controlWindow && !controlWindow.isDestroyed())
    controlWindow.webContents.send('replay:clips-updated', currentMatchGoals);
}

// Retry copy : OBS peut encore avoir le fichier ouvert juste après StopRecord
async function copyWithRetry(src, dest, maxAttempts = 10, waitMs = 600) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      fs.copyFileSync(src, dest);
      return;
    } catch (e) {
      if ((e.code === 'EPERM' || e.code === 'EBUSY') && i < maxAttempts - 1) {
        console.log(`[replay] fichier verrouillé, retry ${i + 1}/${maxAttempts} dans ${waitMs}ms…`);
        await new Promise(r => setTimeout(r, waitMs));
      } else {
        throw e;
      }
    }
  }
}

// Attend que la taille du fichier ne change plus pendant stableMs (OBS finit d'écrire après StopRecord)
async function waitForFileStable(filePath, stableMs = 2000, pollMs = 300) {
  let lastSize = -1;
  let stableFor = 0;
  while (stableFor < stableMs) {
    await new Promise(r => setTimeout(r, pollMs));
    try {
      const size = fs.statSync(filePath).size;
      if (size > 0 && size === lastSize) {
        stableFor += pollMs;
      } else {
        lastSize = size;
        stableFor = 0;
      }
    } catch {
      stableFor = 0;
    }
  }
  console.log(`[replay] fichier stable (${lastSize} octets): ${path.basename(filePath)}`);
}

// Called with the file path returned by StopRecord
function handleRecordStopped(srcPath) {
  if (!srcPath) { console.warn('[replay] StopRecord: chemin vide'); return; }

  clipIndex++;
  const ext  = path.extname(srcPath) || '.mp4';
  const dest = `goal_${clipIndex}${ext}`;
  const destPath = path.join(PUBLIC_REPLAYS, dest);

  ensureReplaysDir();
  // Attendre que le fichier existe (OBS peut mettre quelques ms à le créer)
  const waitForFile = async (p, attempts = 10, ms = 500) => {
    for (let i = 0; i < attempts; i++) {
      if (fs.existsSync(p)) return true;
      await new Promise(r => setTimeout(r, ms));
    }
    return false;
  };

  waitForFile(srcPath)
    .then(exists => {
      if (!exists) { console.warn('[replay] fichier introuvable après attente:', srcPath); return Promise.reject(new Error('not found')); }
      // Attendre que OBS finisse d'écrire avant de copier
      return waitForFileStable(srcPath);
    })
    .then(() => copyWithRetry(srcPath, destPath))
    .then(() => {
      const goal = currentMatchGoals.find(g => !g.clipSrc);
      if (goal) goal.clipSrc = `/replays/${dest}`;
      writePlaylist();
      notifyClipsUpdate();
      console.log(`[replay] clip prêt: ${dest}`);
    }).catch(e => { if (e.message !== 'not found') console.error('[replay] copie échouée:', e.message); });
}

// keepFiles=true : reset état mémoire seulement (nouveau match, fichiers conservés pour /replay)
// keepFiles=false (défaut) : supprime aussi les fichiers vidéo (bouton "Vider")
function clearMatchData(keepFiles = false) {
  currentMatchGoals = [];
  clipIndex         = 0;
  wasReplay         = false;
  matchEnded        = false;
  isRecording       = false;
  if (!keepFiles) {
    try {
      if (fs.existsSync(PUBLIC_REPLAYS))
        fs.readdirSync(PUBLIC_REPLAYS).forEach(f => {
          try { fs.unlinkSync(path.join(PUBLIC_REPLAYS, f)); } catch {}
        });
    } catch {}
  }
}

function handleRelayEvent(msg) {
  // ── Détection bReplay via UpdateState ────────────────────────────────────
  const evt = msg.Event || '';
  let bReplay = null;

  if (evt === 'UpdateState') {
    bReplay = msg.Data?.Game?.bReplay ?? null;
  } else if (evt === 'game:update_state') {
    bReplay = msg.Data?.game?.isReplay ?? null;
  }

  if (bReplay !== null) {
    if (bReplay && !wasReplay) {
      wasReplay = true;
      if (!matchEnded) {
        // Guard : on n'enregistre que s'il y a un but en attente de clip.
        const hasPendingGoal = currentMatchGoals.some(g => !g.clipSrc);
        if (hasPendingGoal) {
          isRecording = true;
          obsClient.startRecord().catch(e => console.error('[main] StartRecord:', e));
        } else {
          console.log('[replay] bReplay=true ignoré — aucun but en attente');
        }
      } else {
        console.log('[replay] bReplay=true ignoré — match terminé (podium/score-screen)');
      }
    } else if (!bReplay && wasReplay) {
      if (!matchEnded) {
        // Match en cours : transition normale, on peut arrêter l'enregistrement
        wasReplay = false;
        if (isRecording) {
          isRecording = false;
          obsClient.stopRecord()
            .then(filePath => { if (filePath) handleRecordStopped(filePath); })
            .catch(e => console.error('[main] StopRecord:', e));
        }
      }
      // matchEnded=true : on ne remet PAS wasReplay à false.
      // Ainsi le prochain bReplay=true (podium, célébration) reste bloqué.
    }
  }

  // ── GoalScored ───────────────────────────────────────────────────────────
  if (evt === 'GoalScored') {
    const data = msg.Data || {};
    const goal = {
      n:       currentMatchGoals.length + 1,
      scorer:  data.Scorer?.Name || '—',
      team:    data.Scorer?.TeamNum ?? -1,
      time:    Date.now(),
      clipSrc: null,
    };
    currentMatchGoals.push(goal);
    notifyClipsUpdate();
  }

  // ── Nouveau match → reset état mémoire (fichiers conservés jusqu'au bouton Vider) ──
  if (evt === 'MatchCreated' || evt === 'game:match_created') {
    console.log('[replay] Nouveau match — reset état (fichiers conservés)');
    const prevGoals = currentMatchGoals.filter(g => g.clipSrc); // clips prêts seulement
    clearMatchData(true); // keepFiles=true : on ne supprime pas les vidéos
    // On n'appelle PAS notifyClipsUpdate() ici pour ne pas effacer la UI sans raison
    if (controlWindow && !controlWindow.isDestroyed())
      controlWindow.webContents.send('replay:match-reset', { prevGoals });
  }

  // ── MatchEnded ────────────────────────────────────────────────────────────
  if (evt === 'MatchEnded') {
    // Si on était en train d'enregistrer (but en overtime / dernier but),
    // stopper proprement l'enregistrement.
    if (isRecording) {
      isRecording = false;
      obsClient.stopRecord()
        .then(filePath => { if (filePath) handleRecordStopped(filePath); })
        .catch(e => console.error('[main] StopRecord on MatchEnded:', e));
    }
    // matchEnded=true + wasReplay=true : double verrou post-match.
    // wasReplay=true bloque le bReplay=true en cours s'il y en a un.
    // matchEnded=true empêche wasReplay d'être remis à false sur bReplay=false,
    // ce qui bloquerait toutes les transitions bReplay suivantes (podium, score-screen…).
    matchEnded = true;
    wasReplay  = true;
    notifyClipsUpdate();
    if (controlWindow && !controlWindow.isDestroyed())
      controlWindow.webContents.send('replay:match-ended', msg.Data || {});
  }
}

// ── Relay ─────────────────────────────────────────────────────────────────────

function startRelayWithStatus() {
  relay = startRelay({
    rlPort: 49123,
    relayPort: 49124,
    onStatus:  (data) => { if (controlWindow && !controlWindow.isDestroyed()) controlWindow.webContents.send('relay:status', data); },
    onEvent:   handleRelayEvent,
  });
  configStore.setBroadcastFn(relay.broadcast);
}

// ── Static overlay server (production) ───────────────────────────────────────

function serveOverlayStatic() {
  const overlayDist = path.join(__dirname, '../dist/overlay');
  const mime = {
    '.html':'text/html', '.js':'application/javascript', '.mjs':'application/javascript',
    '.css':'text/css', '.svg':'image/svg+xml', '.png':'image/png', '.json':'application/json',
    '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon',
    '.mkv':'video/x-matroska', '.mp4':'video/mp4', '.mov':'video/quicktime', '.webm':'video/webm',
  };
  const VIDEO_EXTS = new Set(['.mkv', '.mp4', '.mov', '.webm']);

  overlayServer = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';

    const tryPaths = [
      path.join(overlayDist, urlPath),
      path.join(__dirname, '../public', urlPath),
      path.join(overlayDist, 'index.html'),
    ];

    let target = null;
    for (const p of tryPaths) { if (fs.existsSync(p)) { target = p; break; } }
    if (!target) { res.writeHead(404); res.end('Not found'); return; }

    const ext         = path.extname(target).toLowerCase();
    const contentType = mime[ext] || 'application/octet-stream';

    // Range request support for video files
    if (VIDEO_EXTS.has(ext) && req.headers.range) {
      try {
        const size  = fs.statSync(target).size;
        const range = req.headers.range.replace(/bytes=/, '').split('-');
        const start = parseInt(range[0], 10);
        const end   = range[1] ? parseInt(range[1], 10) : size - 1;
        res.writeHead(206, {
          'Content-Range':  `bytes ${start}-${end}/${size}`,
          'Accept-Ranges':  'bytes',
          'Content-Length': end - start + 1,
          'Content-Type':   contentType,
        });
        fs.createReadStream(target, { start, end }).pipe(res);
      } catch { res.writeHead(500); res.end(); }
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType, 'Accept-Ranges': 'bytes' });
    res.end(fs.readFileSync(target));
  });

  overlayServer.listen(OVERLAY_PORT, '127.0.0.1', () => {
    console.log(`[overlay] served on http://127.0.0.1:${OVERLAY_PORT}`);
  });
}

// ── Wait for Vite ─────────────────────────────────────────────────────────────

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
    width: 1400, height: 860,
    minWidth: 1100, minHeight: 700,
    title: 'RL Overlay Studio v2',
    backgroundColor: '#0c0c14',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  controlWindow.once('ready-to-show', () => controlWindow.show());
  controlWindow.webContents.once('did-finish-load', () => {
    if (relay) controlWindow.webContents.send('relay:status', relay.getStatus());
  });
  controlWindow.on('closed', () => { controlWindow = null; });

  if (isDev) {
    controlWindow.loadURL('http://127.0.0.1:5174');
  } else {
    controlWindow.loadFile(path.join(__dirname, '../dist/control/index.html'));
  }
}

function createOverlayWindow() {
  if (overlayWindow && !overlayWindow.isDestroyed()) { overlayWindow.focus(); return; }
  overlayWindow = new BrowserWindow({
    width: 1920, height: 1080,
    title: 'Overlay Preview',
    transparent: true, frame: false, alwaysOnTop: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  overlayWindow.loadURL(`http://127.0.0.1:${OVERLAY_PORT}`);
  overlayWindow.on('closed', () => { overlayWindow = null; });
}

// ── Embedded preview (WebContentsView) ────────────────────────────────────────

function showPreview(bounds) {
  if (!controlWindow || controlWindow.isDestroyed()) return;

  // Create the view once; reload if needed
  if (!previewView) {
    previewView = new WebContentsView({
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        preload: path.join(__dirname, 'preview-preload.cjs'),
      },
    });
    previewView.webContents.loadURL(`http://127.0.0.1:${OVERLAY_PORT}`);
  }

  // Add to parent content view (idempotent)
  const parent = controlWindow.contentView;
  if (!parent.children.includes(previewView)) {
    parent.addChildView(previewView);
  }

  previewView.setBounds({
    x:      Math.max(0, Math.round(bounds.x)),
    y:      Math.max(0, Math.round(bounds.y)),
    width:  Math.max(1, Math.round(bounds.width)),
    height: Math.max(1, Math.round(bounds.height)),
  });
}

function hidePreview() {
  if (!previewView || !controlWindow || controlWindow.isDestroyed()) return;
  try { controlWindow.contentView.removeChildView(previewView); } catch {}
}

// ── IPC ───────────────────────────────────────────────────────────────────────

function registerIPC() {
  ipcMain.handle('config:get',            ()        => configStore.getConfig());
  ipcMain.handle('config:set',            (_, p)    => configStore.setConfig(p));
  ipcMain.handle('config:list-profiles',  ()        => configStore.listProfiles());
  ipcMain.handle('config:save-profile',   (_, n)    => configStore.saveProfile(n));
  ipcMain.handle('config:load-profile',   (_, n)    => configStore.loadProfile(n));
  ipcMain.handle('config:delete-profile', (_, n)    => configStore.deleteProfile(n));

  ipcMain.handle('relay:mock-event', (_, type) => {
    if (!relay) return;
    const events = {
      goal:      { Event: 'GoalScored',  Data: { Scorer: { Name: 'MOCK PLAYER', TeamNum: 0 }, ball_last_touch: { speed: 142 } } },
      save:      { Event: 'StatfeedEvent', Data: { MainTarget: { Name: 'MOCK PLAYER', TeamNum: 1 }, Type: 'SAVE' } },
      demo:      { Event: 'StatfeedEvent', Data: { MainTarget: { Name: 'MOCK PLAYER', TeamNum: 0 }, Type: 'DEMOLISH' } },
      shot:      { Event: 'StatfeedEvent', Data: { MainTarget: { Name: 'MOCK PLAYER', TeamNum: 0 }, Type: 'SHOT' } },
      // Engagement simulation: replay → countdown → kickoff
      replay:    { Event: 'UpdateState', Data: { Game: { bReplay: true, TimeSeconds: 250, blueScore: 0, orangeScore: 1 }, Players: [] } },
      countdown: { Event: 'game:pre_countdown_begin', Data: {} },
      kickoff:   { Event: 'UpdateState', Data: { Game: { bReplay: false, TimeSeconds: 300, blueScore: 0, orangeScore: 0 }, Players: [] } },
    };
    relay.broadcast(events[type] || events.goal);
  });

  ipcMain.handle('relay:get-status', () => relay ? relay.getStatus() : { rlConnected: false, relay: null });

  ipcMain.handle('preview:show',   (_, bounds) => showPreview(bounds));
  ipcMain.handle('preview:hide',   ()          => hidePreview());
  ipcMain.handle('preview:set-layout-mode', (_, active) => {
    if (previewView && !previewView.webContents.isDestroyed()) {
      previewView.webContents.send('layout-mode', active);
    }
  });
  ipcMain.handle('preview:reload', () => {
    if (previewView && !previewView.webContents.isDestroyed()) {
      previewView.webContents.reload();
    }
  });
  ipcMain.handle('preview:position-update', (_, positions) => {
    const cfg = configStore.getConfig();
    return configStore.setConfig({ positions: { ...(cfg.positions || {}), ...positions } });
  });

  ipcMain.handle('overlay:open-window', () => createOverlayWindow());

  // ── Replay / OBS ────────────────────────────────────────────────────────────
  ipcMain.handle('replay:connect-obs', async (_, cfg) => {
    obsClient.setStatusCb((status) => {
      if (controlWindow && !controlWindow.isDestroyed())
        controlWindow.webContents.send('replay:obs-status', status);
    });
    return obsClient.connect(cfg);
  });

  ipcMain.handle('replay:disconnect-obs', async () => obsClient.disconnect());
  ipcMain.handle('replay:obs-status',     ()        => obsClient.getStatus());

  ipcMain.handle('replay:get-clips',   () => currentMatchGoals);

  ipcMain.handle('replay:clear-clips', () => {
    clearMatchData(false); // supprime les fichiers vidéo
    if (controlWindow && !controlWindow.isDestroyed())
      controlWindow.webContents.send('replay:clips-cleared', {});
    return { success: true };
  });

  ipcMain.handle('replay:open-folder', () => {
    shell.openPath(fs.existsSync(PUBLIC_REPLAYS) ? PUBLIC_REPLAYS : app.getPath('videos'));
    return { success: true };
  });

  ipcMain.handle('dialog:pick-logo', async (_, side) => {
    const result = await dialog.showOpenDialog(controlWindow, {
      title: `Logo équipe ${side === 'left' ? 'gauche' : 'droite'}`,
      filters: [{ name: 'Images', extensions: ['svg', 'png', 'jpg', 'jpeg', 'webp'] }],
      properties: ['openFile'],
    });
    if (result.canceled || !result.filePaths.length) return null;
    return `file:///${result.filePaths[0].replace(/\\/g, '/')}`;
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(async () => {
  startRelayWithStatus();
  registerIPC();

  if (isDev) {
    console.log('[main] dev mode — waiting for Vite…');
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
  hidePreview();
  if (relay) relay.stop();
  if (overlayServer) overlayServer.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createControlWindow();
});
