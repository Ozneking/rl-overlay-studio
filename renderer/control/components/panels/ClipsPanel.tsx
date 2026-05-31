import React, { useEffect, useState } from 'react';

interface Goal {
  n:       number;
  scorer:  string;
  team:    number;
  time:    number;
  clipSrc: string | null;
}

interface ObsStatus {
  enabled:   boolean;
  connected: boolean;
  error?:    string;
}

const eAPI = (window as any).electronAPI;

export function ClipsPanel() {
  const [url,        setUrl]        = useState('ws://127.0.0.1:4455');
  const [password,   setPassword]   = useState('');
  const [obsStatus,  setObsStatus]  = useState<ObsStatus>({ enabled: false, connected: false });
  const [goals,      setGoals]      = useState<Goal[]>([]);
  const [prevGoals,  setPrevGoals]  = useState<Goal[]>([]); // clips du match précédent (conservés)
  const [matchEnd,   setMatchEnd]   = useState(false);
  const [newMatch,   setNewMatch]   = useState(false);      // nouveau match détecté
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!eAPI) return;
    eAPI.obsGetStatus().then((s: ObsStatus) => setObsStatus(s));
    eAPI.replayGetClips().then((g: Goal[]) => setGoals(g || []));

    const cleanObs    = eAPI.onObsStatus((s: ObsStatus) => setObsStatus(s));

    const cleanClips  = eAPI.onClipsUpdated((g: Goal[]) => {
      setGoals(g || []);
      setMatchEnd(false);
    });

    const cleanMatch  = eAPI.onMatchEnded(() => setMatchEnd(true));

    // Nouveau match : conserver les clips prêts en "match précédent"
    const cleanReset  = eAPI.onMatchReset?.((data: { prevGoals?: Goal[] }) => {
      const prev = (data?.prevGoals || []).filter((g: Goal) => g.clipSrc);
      if (prev.length > 0) {
        setPrevGoals(prev);
        setNewMatch(true);
      }
      setGoals([]);
      setMatchEnd(false);
    });

    // Vider confirmé côté main : tout effacer
    const cleanCleared = eAPI.onClipsCleared?.(() => {
      setGoals([]);
      setPrevGoals([]);
      setMatchEnd(false);
      setNewMatch(false);
    });

    return () => {
      cleanObs?.();
      cleanClips?.();
      cleanMatch?.();
      cleanReset?.();
      cleanCleared?.();
    };
  }, []);

  const connect    = async () => {
    if (!eAPI) return;
    setConnecting(true);
    await eAPI.obsConnect({ url, password });
    setConnecting(false);
  };

  const disconnect = async () => eAPI?.obsDisconnect();

  const clearClips = async () => {
    if (!eAPI) return;
    await eAPI.replayClearClips();
    // L'event replay:clips-cleared se charge de vider la UI
  };

  const openFolder = () => eAPI?.replayOpenFolder();

  const isConnected  = obsStatus.connected;
  const isEnabled    = obsStatus.enabled;
  const recording    = goals.some(g => !g.clipSrc) && isConnected;
  const hasAnything  = goals.length > 0 || prevGoals.length > 0;

  const teamColor = (t: number) => t === 0 ? '#2257ff' : t === 1 ? '#ff6b35' : '#888';
  const teamName  = (t: number) => t === 0 ? 'Équipe Bleue' : t === 1 ? 'Équipe Orange' : '—';
  const timeStr   = (ts: number) => ts
    ? new Date(ts).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })
    : '—';

  return (
    <div className="panel clips-panel">
      <div className="panel-header">
        <h2 className="panel-title">🎬 Replay Clips</h2>
        <p className="panel-desc">
          Enregistrement automatique à chaque replay de but via OBS.
          Highlight : <a className="obs-badge" href="http://127.0.0.1:5173/replay" target="_blank" rel="noreferrer">
            <code>http://127.0.0.1:5173/replay</code>
          </a>
        </p>
      </div>

      {/* ── OBS Connection ── */}
      <div className="form-section">
        <div className="form-section-title">
          Connexion OBS WebSocket
          <span className={`obs-dot${isConnected ? ' connected' : isEnabled ? ' connecting' : ''}`}/>
          <span className="obs-dot-label">
            {isConnected
              ? recording ? '🔴 Enregistrement en cours…' : '🟢 Connecté'
              : connecting
              ? '⏳ Connexion…'
              : obsStatus.error
              ? `🔴 ${obsStatus.error}`
              : '⚫ Déconnecté'}
          </span>
        </div>

        <div className="form-row">
          <label className="form-label">URL WebSocket OBS</label>
          <input
            className="form-input"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="ws://127.0.0.1:4455"
          />
        </div>
        <div className="form-row">
          <label className="form-label">Mot de passe (optionnel)</label>
          <input
            className="form-input"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Laisser vide si non configuré"
          />
        </div>

        <div className="form-row" style={{ gap: 8 }}>
          {!isConnected
            ? <button className="btn-primary" onClick={connect} disabled={connecting}>{connecting ? 'Connexion…' : '🔌 Connecter'}</button>
            : <button className="btn-danger"  onClick={disconnect}>⏏ Déconnecter</button>
          }
        </div>

        {!isConnected && (
          <div className="clips-obs-hint">
            <b>Pré-requis :</b> OBS 28+ ouvert · WebSocket activé dans Outils → WebSocket Server Settings
          </div>
        )}
        {isConnected && !recording && (
          <div className="clips-obs-hint connected">
            OBS prêt. L'enregistrement démarre automatiquement à chaque replay de but.
          </div>
        )}
      </div>

      {/* ── Clips list ── */}
      <div className="form-section clips-section">
        <div className="form-section-title">
          Clips du match
          {matchEnd  && <span className="clips-match-ended">✅ Match terminé</span>}
          {newMatch  && <span className="clips-match-reset">🔄 Nouveau match en cours</span>}
          <span className="clips-count">
            {goals.length + prevGoals.length} but{(goals.length + prevGoals.length) !== 1 ? 's' : ''}
          </span>
        </div>

        {!hasAnything ? (
          <div className="clips-empty">
            Aucun but enregistré. Les clips apparaissent ici automatiquement dès qu'un replay se termine.
          </div>
        ) : (
          <div className="clips-list">
            {/* Clips du match précédent (conservés jusqu'au bouton Vider) */}
            {prevGoals.length > 0 && (
              <>
                <div className="clips-separator">Match précédent — clips prêts pour /replay</div>
                {prevGoals.map((g) => (
                  <div key={`prev-${g.n}`} className="clip-row ready prev">
                    <span className="clip-num" style={{ color: teamColor(g.team) }}>#{g.n}</span>
                    <div className="clip-info">
                      <span className="clip-scorer">{g.scorer}</span>
                      <span className="clip-team">{teamName(g.team)}</span>
                    </div>
                    <span className="clip-time">{timeStr(g.time)}</span>
                    <span className="clip-status ok">🎬 Prêt</span>
                  </div>
                ))}
                {goals.length > 0 && (
                  <div className="clips-separator">Match en cours</div>
                )}
              </>
            )}

            {/* Clips du match en cours */}
            {goals.map((g) => (
              <div key={g.n} className={`clip-row${g.clipSrc ? ' ready' : ' pending'}`}>
                <span className="clip-num" style={{ color: teamColor(g.team) }}>#{g.n}</span>
                <div className="clip-info">
                  <span className="clip-scorer">{g.scorer}</span>
                  <span className="clip-team">{teamName(g.team)}</span>
                </div>
                <span className="clip-time">{timeStr(g.time)}</span>
                <span className={`clip-status${g.clipSrc ? ' ok' : ''}`}>
                  {g.clipSrc ? '🎬 Prêt' : '⏳ Enregistrement…'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="clips-actions">
          <button className="btn-secondary" onClick={openFolder}>📂 Ouvrir dossier</button>
          <button className="btn-danger" onClick={clearClips} disabled={!hasAnything}>
            🗑 Vider les clips
          </button>
        </div>
      </div>

      {/* ── Preview link ── */}
      <div className="form-section">
        <div className="form-section-title">Lecture du highlight</div>
        <div className="clips-preview-info">
          <p>Ajoutez cette URL comme <b>Browser Source</b> dans OBS pour diffuser le highlight :</p>
          <div className="clips-url-box">
            <code>http://127.0.0.1:5173/replay</code>
            <button
              className="btn-secondary sm"
              onClick={() => navigator.clipboard?.writeText('http://127.0.0.1:5173/replay')}
            >Copier</button>
          </div>
          <p className="form-help">Les clips s'enchaînent en boucle. La page se met à jour sans rechargement.</p>
        </div>
      </div>
    </div>
  );
}
