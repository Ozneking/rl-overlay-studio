/**
 * Preload script — exposes a typed window.electronAPI to the renderer.
 * contextIsolation: true keeps Node.js APIs out of renderer scope.
 */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // ── Config ──────────────────────────────────────────────────
  getConfig: () =>
    ipcRenderer.invoke('config:get'),

  setConfig: (partial) =>
    ipcRenderer.invoke('config:set', partial),

  // ── Profiles ─────────────────────────────────────────────────
  listProfiles: () =>
    ipcRenderer.invoke('config:list-profiles'),

  saveProfile: (name) =>
    ipcRenderer.invoke('config:save-profile', name),

  loadProfile: (name) =>
    ipcRenderer.invoke('config:load-profile', name),

  deleteProfile: (name) =>
    ipcRenderer.invoke('config:delete-profile', name),

  // ── Relay / Mock ──────────────────────────────────────────────
  sendMockEvent: (type) =>
    ipcRenderer.invoke('relay:mock-event', type),

  // ── Windows ──────────────────────────────────────────────────
  openOverlayWindow: () =>
    ipcRenderer.invoke('overlay:open-window'),

  // ── Dialogs ──────────────────────────────────────────────────
  pickLogoFile: (side) =>
    ipcRenderer.invoke('dialog:pick-logo', side),

  // ── Events (main → renderer) ─────────────────────────────────
  onRelayStatus: (callback) => {
    const handler = (_event, data) => callback(data);
    ipcRenderer.on('relay:status', handler);
    // Return cleanup function
    return () => ipcRenderer.removeListener('relay:status', handler);
  },
});
