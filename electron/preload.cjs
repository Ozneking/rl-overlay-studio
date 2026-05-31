/**
 * Preload script (CommonJS pour compatibilité Electron)
 * Expose window.electronAPI au renderer via contextBridge.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Config
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (partial) => ipcRenderer.invoke('config:set', partial),

  // Profiles
  listProfiles: () => ipcRenderer.invoke('config:list-profiles'),
  saveProfile: (name) => ipcRenderer.invoke('config:save-profile', name),
  loadProfile: (name) => ipcRenderer.invoke('config:load-profile', name),
  deleteProfile: (name) => ipcRenderer.invoke('config:delete-profile', name),

  // Mock events
  sendMockEvent: (type) => ipcRenderer.invoke('relay:mock-event', type),

  // Windows
  openOverlayWindow: () => ipcRenderer.invoke('overlay:open-window'),

  // File dialog
  pickLogoFile: (side) => ipcRenderer.invoke('dialog:pick-logo', side),

  // Relay status — request current state (renderer → main, once)
  getRelayStatus: () => ipcRenderer.invoke('relay:get-status'),

  // Embedded preview (WebContentsView managed by main process)
  showPreview: (bounds) => ipcRenderer.invoke('preview:show', bounds),
  hidePreview: ()       => ipcRenderer.invoke('preview:hide'),
  setLayoutMode: (active) => ipcRenderer.invoke('preview:set-layout-mode', active),
  reloadOverlay: ()     => ipcRenderer.invoke('preview:reload'),

  // Relay status (main → renderer, push)
  onRelayStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('relay:status', handler);
    return () => ipcRenderer.removeListener('relay:status', handler);
  },

  // ── Replay / OBS ────────────────────────────────────────────────────────
  obsConnect:    (cfg)  => ipcRenderer.invoke('replay:connect-obs', cfg),
  obsDisconnect: ()     => ipcRenderer.invoke('replay:disconnect-obs'),
  obsGetStatus:  ()     => ipcRenderer.invoke('replay:obs-status'),
  replayGetClips:   ()  => ipcRenderer.invoke('replay:get-clips'),
  replayClearClips: ()  => ipcRenderer.invoke('replay:clear-clips'),
  replayOpenFolder: ()  => ipcRenderer.invoke('replay:open-folder'),

  onObsStatus: (callback) => {
    const h = (_e, d) => callback(d);
    ipcRenderer.on('replay:obs-status', h);
    return () => ipcRenderer.removeListener('replay:obs-status', h);
  },
  onClipsUpdated: (callback) => {
    const h = (_e, d) => callback(d);
    ipcRenderer.on('replay:clips-updated', h);
    return () => ipcRenderer.removeListener('replay:clips-updated', h);
  },
  onMatchEnded: (callback) => {
    const h = (_e, d) => callback(d);
    ipcRenderer.on('replay:match-ended', h);
    return () => ipcRenderer.removeListener('replay:match-ended', h);
  },
  onMatchReset: (callback) => {
    const h = (_e, d) => callback(d);
    ipcRenderer.on('replay:match-reset', h);
    return () => ipcRenderer.removeListener('replay:match-reset', h);
  },
  onClipsCleared: (callback) => {
    const h = (_e, d) => callback(d);
    ipcRenderer.on('replay:clips-cleared', h);
    return () => ipcRenderer.removeListener('replay:clips-cleared', h);
  },
});
