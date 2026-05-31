'use strict';
/**
 * Preload pour la WebContentsView de preview.
 * Expose window.previewBridge à l'overlay pour le mode layout (WYSIWYG).
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('previewBridge', {
  // Overlay → main : mise à jour de position après un drag
  sendPositionUpdate: (positions) => ipcRenderer.invoke('preview:position-update', positions),
});

// Main → overlay : activer / désactiver le mode layout
ipcRenderer.on('layout-mode', (_event, active) => {
  window.dispatchEvent(new CustomEvent('rl-layout-mode', { detail: { active } }));
});
