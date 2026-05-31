import React from 'react';
import { useConfigStore } from '../../store/config-store';

export function MatchPanel() {
  const { config, setMatch } = useConfigStore();
  if (!config) return <div className="panel-loading">Chargement…</div>;

  const { match } = config;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Paramètres du Match</h2>
        <p className="panel-desc">Titre de l'événement, format de série et score.</p>
      </div>

      {/* Event title */}
      <div className="field-group">
        <label className="field-label">Titre de l'événement</label>
        <input
          className="field-input"
          type="text"
          value={match.eventTitle}
          onChange={e => setMatch({ eventTitle: e.target.value.toUpperCase() })}
          placeholder="PARIS MAJOR | GROUPE C | TOUR 3"
          spellCheck={false}
        />
        <p className="field-hint">Affiché en haut du scoreboard. Lettres majuscules automatiques.</p>
      </div>

      {/* Series type */}
      <div className="field-group">
        <label className="field-label">Format de série</label>
        <div className="segmented">
          {(['BO3', 'BO5', 'BO7'] as const).map(t => (
            <button
              key={t}
              className={`segmented-btn ${match.seriesType === t ? 'active' : ''}`}
              onClick={() => setMatch({ seriesType: t })}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Series score */}
      <div className="field-group">
        <label className="field-label">Score de série actuel</label>
        <div className="score-inputs">
          <div className="score-input-group">
            <span className="score-team-label blue-label">
              {config.teams.left.shortName}
            </span>
            <div className="score-counter">
              <button
                className="score-btn"
                onClick={() => setMatch({ seriesScore: { ...match.seriesScore, left: Math.max(0, match.seriesScore.left - 1) } })}
              >−</button>
              <span className="score-value">{match.seriesScore.left}</span>
              <button
                className="score-btn"
                onClick={() => setMatch({ seriesScore: { ...match.seriesScore, left: match.seriesScore.left + 1 } })}
              >+</button>
            </div>
          </div>

          <span className="score-separator">—</span>

          <div className="score-input-group">
            <div className="score-counter">
              <button
                className="score-btn"
                onClick={() => setMatch({ seriesScore: { ...match.seriesScore, right: Math.max(0, match.seriesScore.right - 1) } })}
              >−</button>
              <span className="score-value">{match.seriesScore.right}</span>
              <button
                className="score-btn"
                onClick={() => setMatch({ seriesScore: { ...match.seriesScore, right: match.seriesScore.right + 1 } })}
              >+</button>
            </div>
            <span className="score-team-label orange-label">
              {config.teams.right.shortName}
            </span>
          </div>
        </div>

        <button
          className="btn-ghost"
          style={{ marginTop: '8px' }}
          onClick={() => setMatch({ seriesScore: { left: 0, right: 0 } })}
        >
          Réinitialiser le score
        </button>
      </div>

      {/* Divider */}
      <div className="divider" />

      {/* Toggles */}
      <div className="field-group">
        <label className="field-label">Options</label>

        <div className="toggle-list">
          <ToggleRow
            label="Incrémenter le score automatiquement"
            hint="Ajoute un point à l'équipe gagnante à la fin de chaque match"
            checked={match.autoIncrementSeries}
            onChange={v => setMatch({ autoIncrementSeries: v })}
          />
          <ToggleRow
            label="Afficher le statut de connexion"
            hint="Petite pastille en haut à droite de l'overlay"
            checked={match.showConnectionStatus}
            onChange={v => setMatch({ showConnectionStatus: v })}
          />
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle-row">
      <div className="toggle-info">
        <span className="toggle-label">{label}</span>
        {hint && <span className="toggle-hint">{hint}</span>}
      </div>
      <button
        className={`toggle-btn ${checked ? 'on' : 'off'}`}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
      >
        <span className="toggle-thumb" />
      </button>
    </label>
  );
}
