import React, { useRef } from 'react';
import { useConfigStore } from '../../store/config-store';
import type { TeamConfig } from '../../types';

export function TeamsPanel() {
  const { config, setTeam } = useConfigStore();
  if (!config) return <div className="panel-loading">Chargement…</div>;

  const swapTeams = () => {
    const l = config.teams.left;
    const r = config.teams.right;
    setTeam('left',  { name: r.name, shortName: r.shortName, logo: r.logo });
    setTeam('right', { name: l.name, shortName: l.shortName, logo: l.logo });
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Équipes</h2>
        <p className="panel-desc">Nom, abréviation, couleur et logo de chaque équipe.</p>
      </div>

      <div className="teams-grid">
        <TeamCard
          side="left"
          team={config.teams.left}
          onChange={(patch) => setTeam('left', patch)}
          accentColor="#2257ff"
          label="Côté Bleu"
        />

        <div className="teams-swap-col">
          <button className="teams-swap-btn" onClick={swapTeams} title="Inverser les deux équipes">
            ⇄
          </button>
        </div>

        <TeamCard
          side="right"
          team={config.teams.right}
          onChange={(patch) => setTeam('right', patch)}
          accentColor="#ff335f"
          label="Côté Orange"
        />
      </div>
    </div>
  );
}

interface TeamCardProps {
  side: 'left' | 'right';
  team: TeamConfig;
  onChange: (patch: Partial<TeamConfig>) => void;
  accentColor: string;
  label: string;
}

function TeamCard({ side, team, onChange, accentColor, label }: TeamCardProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File picker (native dialog)
  const handlePickLogo = async () => {
    const path = await window.electronAPI.pickLogoFile(side);
    if (path) onChange({ logo: path });
  };

  // Local file input fallback (drag & drop or click)
  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    onChange({ logo: `file:///${file.path.replace(/\\/g, '/')}` });
  };

  const imgSrc = team.logo;

  return (
    <div className="team-card" style={{ '--team-accent': accentColor } as React.CSSProperties}>
      <div className="team-card-header">
        <div className="team-card-accent" style={{ background: team.color }} />
        <span className="team-card-label">{label}</span>
      </div>

      {/* Logo preview */}
      <div className="team-logo-preview">
        <img
          src={imgSrc}
          alt="Logo"
          onError={e => { (e.target as HTMLImageElement).style.opacity = '0.15'; }}
          onLoad={e => { (e.target as HTMLImageElement).style.opacity = '1'; }}
        />
      </div>

      {/* Logo URL input + pickers */}
      <div className="field-group" style={{ gap: '8px', marginBottom: '14px' }}>
        <label className="field-label-sm">Logo (URL ou chemin)</label>
        <div className="logo-url-row">
          <input
            className="field-input"
            type="text"
            value={team.logo}
            onChange={e => onChange({ logo: e.target.value })}
            placeholder="https://… ou /assets/teams/left.svg"
            spellCheck={false}
          />
          <button className="logo-pick-btn" onClick={handlePickLogo} title="Choisir un fichier local">
            📁
          </button>
          {/* Hidden native file input for drag & drop */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".svg,.png,.jpg,.jpeg,.webp,.gif"
            style={{ display: 'none' }}
            onChange={handleFileInput}
          />
        </div>
        <p className="field-hint">Formats acceptés : PNG, JPG, SVG, WebP. URL https:// ou chemin fichier.</p>
      </div>

      {/* Fields */}
      <div className="field-group" style={{ gap: '10px' }}>
        <div className="field-inline">
          <label className="field-label-sm">Nom complet</label>
          <input
            className="field-input"
            type="text"
            value={team.name}
            onChange={e => onChange({ name: e.target.value.toUpperCase() })}
            placeholder="TEAM NAME"
            spellCheck={false}
          />
        </div>

        <div className="field-inline">
          <label className="field-label-sm">Abréviation <small>(max 5)</small></label>
          <input
            className="field-input"
            type="text"
            value={team.shortName}
            maxLength={5}
            onChange={e => onChange({ shortName: e.target.value.toUpperCase() })}
            placeholder="TM"
            spellCheck={false}
          />
        </div>

        <div className="field-inline">
          <label className="field-label-sm">Couleur principale</label>
          <div className="color-row">
            <input
              type="color"
              className="color-swatch"
              value={team.color}
              onChange={e => onChange({ color: e.target.value })}
            />
            <input
              className="field-input"
              type="text"
              value={team.color}
              onChange={e => {
                if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) onChange({ color: e.target.value });
              }}
              style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
