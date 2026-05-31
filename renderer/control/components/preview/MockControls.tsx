import React, { useState } from 'react';
import { useConfigStore } from '../../store/config-store';

export function MockControls() {
  const { config, setConnection } = useConfigStore();
  const [clicking, setClicking] = useState<string | null>(null);

  if (!config) return null;

  const mockMode = config.connection.mockMode;

  const handleMockEvent = async (type: 'goal' | 'save' | 'demo' | 'shot' | 'replay' | 'countdown' | 'kickoff') => {
    setClicking(type);
    await window.electronAPI.sendMockEvent(type);
    setTimeout(() => setClicking(null), 300);
  };

  // Simulate full engagement sequence: replay (2s) → countdown → kickoff
  const handleEngagement = async () => {
    setClicking('replay');
    await window.electronAPI.sendMockEvent('replay');
    setTimeout(async () => {
      await window.electronAPI.sendMockEvent('countdown');
      setTimeout(async () => {
        await window.electronAPI.sendMockEvent('kickoff');
        setClicking(null);
      }, 3200);
    }, 2000);
  };

  const handleDetach = () => {
    window.electronAPI.openOverlayWindow();
  };

  return (
    <div className="mock-controls">
      {/* Mock mode toggle */}
      <button
        className={`mock-toggle ${mockMode ? 'active' : ''}`}
        onClick={() => setConnection({ mockMode: !mockMode })}
        title={mockMode ? 'Désactiver le mode mock' : 'Activer le mode mock (données simulées)'}
      >
        <span className="mock-toggle-icon">{mockMode ? '⏸' : '▶'}</span>
        <span>Mock {mockMode ? 'ON' : 'OFF'}</span>
      </button>

      <div className="mock-divider" />

      {/* Event buttons */}
      <button
        className={`mock-event-btn goal ${clicking === 'goal' ? 'flash' : ''}`}
        onClick={() => handleMockEvent('goal')}
        disabled={!mockMode}
        title="Simuler un but"
      >
        ⚽ Goal
      </button>
      <button
        className={`mock-event-btn save ${clicking === 'save' ? 'flash' : ''}`}
        onClick={() => handleMockEvent('save')}
        disabled={!mockMode}
        title="Simuler un arrêt"
      >
        🛡 Save
      </button>
      <button
        className={`mock-event-btn demo ${clicking === 'demo' ? 'flash' : ''}`}
        onClick={() => handleMockEvent('demo')}
        disabled={!mockMode}
        title="Simuler une démo"
      >
        💥 Demo
      </button>
      <button
        className={`mock-event-btn shot ${clicking === 'shot' ? 'flash' : ''}`}
        onClick={() => handleMockEvent('shot')}
        disabled={!mockMode}
        title="Simuler un tir"
      >
        🎯 Shot
      </button>

      <div className="mock-divider" />

      {/* Engagement sequence */}
      <button
        className={`mock-event-btn ${clicking === 'replay' ? 'flash' : ''}`}
        onClick={handleEngagement}
        disabled={!mockMode}
        title="Simuler replay → 3-2-1 → kickoff"
        style={{ fontStyle: 'italic' }}
      >
        ↺ Engagement
      </button>

      <div className="mock-divider" />

      {/* Detach */}
      <button
        className="mock-detach-btn"
        onClick={handleDetach}
        title="Ouvrir l'overlay en fenêtre flottante 1920×1080"
      >
        ↗ Détacher
      </button>
    </div>
  );
}
