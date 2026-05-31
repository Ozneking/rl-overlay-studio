import React from 'react';
import { useConfigStore } from '../../store/config-store';

export function UIPanel() {
  const { config, setUI } = useConfigStore();
  if (!config) return <div className="panel-loading">Chargement…</div>;

  const { ui } = config;

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Apparence</h2>
        <p className="panel-desc">Éléments affichés et réglages de timing.</p>
      </div>

      {/* Elements toggles */}
      <div className="field-group">
        <label className="field-label">Éléments de l'overlay</label>
        <div className="toggle-list">
          <ToggleRow label="Colonnes de boost (côtés)" hint="Barres de boost des 6 joueurs en haut à gauche/droite" checked={ui.showSideBoosts} onChange={v => setUI({ showSideBoosts: v })} />
          <ToggleRow label="Carte joueur (POV)" hint="Fiche du joueur en spectateur en bas à gauche" checked={ui.showPlayerCard} onChange={v => setUI({ showPlayerCard: v })} />
          <ToggleRow label="Anneau de boost" hint="Indicateur circulaire boost du joueur POV en bas à droite" checked={ui.showBoostRing} onChange={v => setUI({ showBoostRing: v })} />
          <ToggleRow label="Chips d'événements" hint="GOAL / SAVE / DEMO / ASSIST sur les barres de boost" checked={ui.showEvents} onChange={v => setUI({ showEvents: v })} />
        </div>
      </div>

      <div className="divider" />

      {/* Sliders */}
      <div className="field-group">
        <label className="field-label">Timings (millisecondes)</label>
        <div className="slider-list">
          <SliderRow
            label="Durée des événements"
            hint="Combien de temps les chips GOAL/SAVE restent visibles"
            value={ui.eventTtlMs}
            min={500} max={6000} step={100}
            format={v => `${v} ms`}
            onChange={v => setUI({ eventTtlMs: v })}
          />
          <SliderRow
            label="Throttle de mise à jour"
            hint="Délai minimum entre deux renders (réduit la charge CPU)"
            value={ui.updateThrottleMs}
            min={16} max={500} step={8}
            format={v => `${v} ms`}
            onChange={v => setUI({ updateThrottleMs: v })}
          />
          <SliderRow
            label="Grace period POV"
            hint="Durée de maintien de la carte joueur après perte de cible"
            value={ui.targetGraceMs}
            min={0} max={3000} step={100}
            format={v => `${v} ms`}
            onChange={v => setUI({ targetGraceMs: v })}
          />
        </div>
      </div>

      <div className="divider" />

      {/* Team size */}
      <div className="field-group">
        <label className="field-label">Taille des équipes</label>
        <div className="segmented">
          {[1, 2, 3].map(n => (
            <button
              key={n}
              className={`segmented-btn ${ui.teamSize === n ? 'active' : ''}`}
              onClick={() => setUI({ teamSize: n })}
            >
              {n}v{n}
            </button>
          ))}
        </div>
        <p className="field-hint">Nombre de joueurs par équipe affiché dans les colonnes de boost.</p>
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

interface SliderRowProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}

function SliderRow({ label, hint, value, min, max, step, format, onChange }: SliderRowProps) {
  return (
    <div className="slider-row">
      <div className="slider-header">
        <span className="slider-label">{label}</span>
        <span className="slider-value">{format(value)}</span>
      </div>
      {hint && <span className="slider-hint">{hint}</span>}
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
      />
    </div>
  );
}
