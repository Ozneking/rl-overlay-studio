import React from 'react';
import { useRelayStore } from '../../store/relay-store';

export function TopBar() {
  const { rlConnected, relayReady, lastMessage } = useRelayStore();

  return (
    <header className="topbar">
      <div className="topbar-left">
        <span className="topbar-title">RL Overlay Studio</span>
        <span className="topbar-subtitle">Rocket League Broadcast Tool</span>
      </div>

      <div className="topbar-right">
        <div className="status-group">
          <span className={`status-dot ${relayReady ? (rlConnected ? 'connected' : 'waiting') : 'offline'}`} />
          <span className="status-label">{lastMessage}</span>
        </div>

        <a
          className="obs-badge"
          onClick={() => navigator.clipboard.writeText('http://127.0.0.1:5173')}
          title="Cliquer pour copier l'URL OBS"
          style={{ cursor: 'pointer' }}
        >
          <span>OBS URL</span>
          <code>:5173</code>
        </a>
      </div>
    </header>
  );
}
