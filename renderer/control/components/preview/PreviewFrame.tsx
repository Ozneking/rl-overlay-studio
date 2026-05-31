import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MockControls } from './MockControls';

const OVERLAY_URL = 'http://127.0.0.1:5173';

interface Bounds { x: number; y: number; width: number; height: number; }

function rectsEqual(a: Bounds | null, b: Bounds): boolean {
  if (!a) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function PreviewFrame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastBoundsRef = useRef<Bounds | null>(null);
  const [ready, setReady] = useState(false);
  const [layoutMode, setLayoutMode] = useState(false);

  const toggleLayoutMode = useCallback(() => {
    setLayoutMode(prev => {
      const next = !prev;
      window.electronAPI.setLayoutMode(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rafId: number;

    const update = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;

      const bounds: Bounds = {
        x:      Math.round(rect.left),
        y:      Math.round(rect.top),
        width:  Math.round(rect.width),
        height: Math.round(rect.height),
      };

      // Only send IPC when bounds actually changed (avoid tight loops)
      if (!rectsEqual(lastBoundsRef.current, bounds)) {
        lastBoundsRef.current = bounds;
        window.electronAPI.showPreview(bounds).then(() => setReady(true));
      }
    };

    // Wait two frames so the layout is painted before we measure
    rafId = requestAnimationFrame(() => {
      rafId = requestAnimationFrame(update);
    });

    const ro = new ResizeObserver(update);
    ro.observe(container);

    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
      lastBoundsRef.current = null;
      window.electronAPI.hidePreview();
      setReady(false);
    };
  }, []);

  return (
    <div className="panel preview-panel">
      <div className="panel-header">
        <h2 className="panel-title">Preview</h2>
        <p className="panel-desc">
          Aperçu en temps réel de l'overlay. URL OBS :{' '}
          <code className="code-badge">{OVERLAY_URL}</code>
        </p>
      </div>

      <div className="preview-controls-row">
        <MockControls />
        <button
          className="reload-overlay-btn"
          onClick={() => window.electronAPI.reloadOverlay()}
          title="Recharger l'overlay (utile après changement de mode mock ou de config)"
        >
          ↺ Actualiser
        </button>
        <button
          className={`layout-mode-btn${layoutMode ? ' active' : ''}`}
          onClick={toggleLayoutMode}
          title="Activer le mode WYSIWYG pour repositionner les éléments"
        >
          {layoutMode ? '✦ MODE LAYOUT' : '⊹ Mode Layout'}
        </button>
      </div>

      {/*
        This div acts as a layout placeholder — its position/size are read by the
        useEffect above and passed to main process, which positions a WebContentsView
        exactly over this rect. The div itself shows a loading state.
      */}
      <div ref={containerRef} className="preview-container">
        {!ready && (
          <div className="preview-loading-msg">
            <span>Chargement du preview…</span>
          </div>
        )}
      </div>
    </div>
  );
}
