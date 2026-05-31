import React, { useState, useRef, useEffect } from 'react';
import { useConfigStore } from '../../store/config-store';
import type {
  TournamentConfig, TournamentTeam, TournamentPlayer,
  Pool, PoolMatch, BracketRound, BracketMatch, ScheduleEntry,
} from '../../types';

type SubTab = 'general' | 'teams' | 'pools' | 'bracket' | 'schedule' | 'nextmatch';

// ── Flag picker ───────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'af', name: 'Afghanistan' },   { code: 'al', name: 'Albanie' },
  { code: 'dz', name: 'Algérie' },       { code: 'ad', name: 'Andorre' },
  { code: 'ao', name: 'Angola' },         { code: 'ar', name: 'Argentine' },
  { code: 'am', name: 'Arménie' },        { code: 'au', name: 'Australie' },
  { code: 'at', name: 'Autriche' },       { code: 'az', name: 'Azerbaïdjan' },
  { code: 'bs', name: 'Bahamas' },        { code: 'bh', name: 'Bahreïn' },
  { code: 'bd', name: 'Bangladesh' },     { code: 'by', name: 'Biélorussie' },
  { code: 'be', name: 'Belgique' },       { code: 'bz', name: 'Belize' },
  { code: 'bj', name: 'Bénin' },         { code: 'bt', name: 'Bhoutan' },
  { code: 'bo', name: 'Bolivie' },        { code: 'ba', name: 'Bosnie-Herzégovine' },
  { code: 'bw', name: 'Botswana' },       { code: 'br', name: 'Brésil' },
  { code: 'bn', name: 'Brunei' },         { code: 'bg', name: 'Bulgarie' },
  { code: 'bf', name: 'Burkina Faso' },   { code: 'bi', name: 'Burundi' },
  { code: 'cv', name: 'Cap-Vert' },       { code: 'kh', name: 'Cambodge' },
  { code: 'cm', name: 'Cameroun' },       { code: 'ca', name: 'Canada' },
  { code: 'cf', name: 'Centrafrique' },   { code: 'td', name: 'Tchad' },
  { code: 'cl', name: 'Chili' },          { code: 'cn', name: 'Chine' },
  { code: 'co', name: 'Colombie' },       { code: 'cd', name: 'Congo (RDC)' },
  { code: 'cg', name: 'Congo' },          { code: 'cr', name: 'Costa Rica' },
  { code: 'hr', name: 'Croatie' },        { code: 'cu', name: 'Cuba' },
  { code: 'cy', name: 'Chypre' },         { code: 'cz', name: 'Tchéquie' },
  { code: 'dk', name: 'Danemark' },       { code: 'dj', name: 'Djibouti' },
  { code: 'do', name: 'Rép. Dominicaine' },{ code: 'ec', name: 'Équateur' },
  { code: 'eg', name: 'Égypte' },         { code: 'sv', name: 'Salvador' },
  { code: 'gq', name: 'Guinée Équatoriale' },{ code: 'er', name: 'Érythrée' },
  { code: 'ee', name: 'Estonie' },        { code: 'et', name: 'Éthiopie' },
  { code: 'fj', name: 'Fidji' },          { code: 'fi', name: 'Finlande' },
  { code: 'fr', name: 'France' },         { code: 'ga', name: 'Gabon' },
  { code: 'gm', name: 'Gambie' },         { code: 'ge', name: 'Géorgie' },
  { code: 'de', name: 'Allemagne' },      { code: 'gh', name: 'Ghana' },
  { code: 'gr', name: 'Grèce' },          { code: 'gt', name: 'Guatemala' },
  { code: 'gn', name: 'Guinée' },         { code: 'gy', name: 'Guyana' },
  { code: 'ht', name: 'Haïti' },          { code: 'hn', name: 'Honduras' },
  { code: 'hu', name: 'Hongrie' },        { code: 'is', name: 'Islande' },
  { code: 'in', name: 'Inde' },           { code: 'id', name: 'Indonésie' },
  { code: 'ir', name: 'Iran' },           { code: 'iq', name: 'Irak' },
  { code: 'ie', name: 'Irlande' },        { code: 'il', name: 'Israël' },
  { code: 'it', name: 'Italie' },         { code: 'jm', name: 'Jamaïque' },
  { code: 'jp', name: 'Japon' },          { code: 'jo', name: 'Jordanie' },
  { code: 'kz', name: 'Kazakhstan' },     { code: 'ke', name: 'Kenya' },
  { code: 'kp', name: 'Corée du Nord' },  { code: 'kr', name: 'Corée du Sud' },
  { code: 'kw', name: 'Koweït' },         { code: 'kg', name: 'Kirghizstan' },
  { code: 'la', name: 'Laos' },           { code: 'lv', name: 'Lettonie' },
  { code: 'lb', name: 'Liban' },          { code: 'ly', name: 'Libye' },
  { code: 'li', name: 'Liechtenstein' },  { code: 'lt', name: 'Lituanie' },
  { code: 'lu', name: 'Luxembourg' },     { code: 'mg', name: 'Madagascar' },
  { code: 'mw', name: 'Malawi' },         { code: 'my', name: 'Malaisie' },
  { code: 'mv', name: 'Maldives' },       { code: 'ml', name: 'Mali' },
  { code: 'mt', name: 'Malte' },          { code: 'mr', name: 'Mauritanie' },
  { code: 'mu', name: 'Maurice' },        { code: 'mx', name: 'Mexique' },
  { code: 'md', name: 'Moldavie' },       { code: 'mc', name: 'Monaco' },
  { code: 'mn', name: 'Mongolie' },       { code: 'me', name: 'Monténégro' },
  { code: 'ma', name: 'Maroc' },          { code: 'mz', name: 'Mozambique' },
  { code: 'mm', name: 'Myanmar' },        { code: 'na', name: 'Namibie' },
  { code: 'np', name: 'Népal' },          { code: 'nl', name: 'Pays-Bas' },
  { code: 'nz', name: 'Nouvelle-Zélande' },{ code: 'ni', name: 'Nicaragua' },
  { code: 'ne', name: 'Niger' },          { code: 'ng', name: 'Nigeria' },
  { code: 'mk', name: 'Macédoine du Nord' },{ code: 'no', name: 'Norvège' },
  { code: 'om', name: 'Oman' },           { code: 'pk', name: 'Pakistan' },
  { code: 'pa', name: 'Panama' },         { code: 'pg', name: 'Papouasie-Nvl-Guinée' },
  { code: 'py', name: 'Paraguay' },       { code: 'pe', name: 'Pérou' },
  { code: 'ph', name: 'Philippines' },    { code: 'pl', name: 'Pologne' },
  { code: 'pt', name: 'Portugal' },       { code: 'qa', name: 'Qatar' },
  { code: 'ro', name: 'Roumanie' },       { code: 'ru', name: 'Russie' },
  { code: 'rw', name: 'Rwanda' },         { code: 'sa', name: 'Arabie Saoudite' },
  { code: 'sn', name: 'Sénégal' },        { code: 'rs', name: 'Serbie' },
  { code: 'sl', name: 'Sierra Leone' },   { code: 'sg', name: 'Singapour' },
  { code: 'sk', name: 'Slovaquie' },      { code: 'si', name: 'Slovénie' },
  { code: 'so', name: 'Somalie' },        { code: 'za', name: 'Afrique du Sud' },
  { code: 'ss', name: 'Soudan du Sud' },  { code: 'es', name: 'Espagne' },
  { code: 'lk', name: 'Sri Lanka' },      { code: 'sd', name: 'Soudan' },
  { code: 'sr', name: 'Suriname' },       { code: 'se', name: 'Suède' },
  { code: 'ch', name: 'Suisse' },         { code: 'sy', name: 'Syrie' },
  { code: 'tw', name: 'Taïwan' },         { code: 'tj', name: 'Tadjikistan' },
  { code: 'tz', name: 'Tanzanie' },       { code: 'th', name: 'Thaïlande' },
  { code: 'tl', name: 'Timor oriental' }, { code: 'tg', name: 'Togo' },
  { code: 'tt', name: 'Trinité-et-Tobago' },{ code: 'tn', name: 'Tunisie' },
  { code: 'tr', name: 'Turquie' },        { code: 'tm', name: 'Turkménistan' },
  { code: 'ug', name: 'Ouganda' },        { code: 'ua', name: 'Ukraine' },
  { code: 'ae', name: 'Émirats Arabes Unis' },{ code: 'gb', name: 'Royaume-Uni' },
  { code: 'us', name: 'États-Unis' },     { code: 'uy', name: 'Uruguay' },
  { code: 'uz', name: 'Ouzbékistan' },    { code: 've', name: 'Venezuela' },
  { code: 'vn', name: 'Viêt Nam' },       { code: 'ye', name: 'Yémen' },
  { code: 'zm', name: 'Zambie' },         { code: 'zw', name: 'Zimbabwe' },
  { code: 'xk', name: 'Kosovo' },
];

const FLAG_URL = (code: string) => `https://flagcdn.com/w40/${code}.png`;

function FlagPicker({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setSearch('');
      }
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const q = search.toLowerCase();
  const filtered = q
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(q) || c.code.includes(q))
    : COUNTRIES;

  const selected = COUNTRIES.find(c => c.code === value);

  return (
    <div className="flag-picker" ref={ref}>
      <button type="button" className="flag-picker-btn" onClick={() => setOpen(o => !o)} title={selected?.name || 'Choisir un pays'}>
        {selected
          ? <img src={FLAG_URL(selected.code)} alt={selected.name} className="flag-picker-img"/>
          : <span className="flag-picker-empty">🌍</span>
        }
      </button>
      {open && (
        <div className="flag-picker-dropdown">
          <div className="flag-picker-search-wrap">
            <input
              autoFocus
              type="text"
              className="flag-picker-search"
              placeholder="Rechercher un pays…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flag-picker-grid">
            {filtered.map(c => (
              <button
                key={c.code}
                type="button"
                className={`flag-picker-item${value === c.code ? ' selected' : ''}`}
                title={c.name}
                onClick={() => { onChange(c.code); setOpen(false); setSearch(''); }}
              >
                <img src={FLAG_URL(c.code)} alt={c.name} className="flag-picker-img"/>
                <span className="flag-picker-label">{c.name}</span>
              </button>
            ))}
            {filtered.length === 0 && <p className="flag-picker-empty-msg">Aucun résultat</p>}
          </div>
          {value && (
            <div className="flag-picker-footer">
              <button type="button" className="flag-picker-clear" onClick={() => { onChange(''); setOpen(false); }}>✕ Effacer</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const uid = () => Math.random().toString(36).slice(2, 9);

const defaultTournament: TournamentConfig = {
  eventName: 'MON TOURNOI', phaseLabel: 'PLAYOFFS', dayLabel: 'JOUR 1',
  waitingScreen: { views: ['bracket', 'nextMatch', 'schedule'], rotationSec: 15, countdownTarget: null, sidebarTitle: 'PROCHAIN MATCH' },
  teams: [], pools: [],
  bracket: { format: 'double', rounds: [] },
  schedule: [],
  nextMatch: { label: 'PROCHAIN MATCH', sublabel: '', team1Id: null, team2Id: null },
};

export function TournamentPanel() {
  const { config, setTournament } = useConfigStore();
  const [sub, setSub] = useState<SubTab>('general');

  const t: TournamentConfig = { ...defaultTournament, ...(config?.tournament || {}) };
  const patch = (p: Partial<TournamentConfig>) => setTournament({ ...t, ...p });

  return (
    <div className="panel tournament-panel">
      <div className="panel-header">
        <h2 className="panel-title">Tournoi</h2>
        <p className="panel-desc">Bracket, pools, programme et waiting screen <code className="code-badge">http://127.0.0.1:5173/start</code></p>
      </div>

      {/* Sub-tabs */}
      <div className="trn-tabs">
        {(['general','teams','pools','bracket','schedule','nextmatch'] as SubTab[]).map(s => (
          <button key={s} className={`trn-tab${sub === s ? ' active' : ''}`} onClick={() => setSub(s)}>
            {{ general:'⚙ Général', teams:'👥 Équipes', pools:'🏊 Pools', bracket:'🏆 Bracket', schedule:'📅 Programme', nextmatch:'⚡ Prochain match' }[s]}
          </button>
        ))}
      </div>

      <div className="trn-body">
        {sub === 'general'    && <GeneralTab    t={t} patch={patch}/>}
        {sub === 'teams'      && <TeamsTab      t={t} patch={patch}/>}
        {sub === 'pools'      && <PoolsTab      t={t} patch={patch}/>}
        {sub === 'bracket'    && <BracketTab    t={t} patch={patch}/>}
        {sub === 'schedule'   && <ScheduleTab   t={t} patch={patch}/>}
        {sub === 'nextmatch'  && <NextMatchTab  t={t} patch={patch}/>}
      </div>
    </div>
  );
}

// ── General tab ───────────────────────────────────────────────────────────────
function GeneralTab({ t, patch }: { t: TournamentConfig; patch: (p: Partial<TournamentConfig>) => void }) {
  const ws = t.waitingScreen;
  const setWs = (p: Partial<typeof ws>) => patch({ waitingScreen: { ...ws, ...p } });
  const toggleView = (v: 'bracket' | 'nextMatch' | 'schedule') => {
    const next = ws.views.includes(v) ? ws.views.filter(x => x !== v) : [...ws.views, v];
    setWs({ views: next });
  };

  return (
    <div className="trn-section-list">
      <div className="trn-section">
        <div className="trn-section-title">Informations événement</div>
        <div className="form-row">
          <label className="form-label">Nom du tournoi</label>
          <input className="form-input" value={t.eventName} onChange={e => patch({ eventName: e.target.value })}/>
        </div>
        <div className="form-row">
          <label className="form-label">Phase / Titre gauche</label>
          <input className="form-input" value={t.phaseLabel} onChange={e => patch({ phaseLabel: e.target.value })}/>
        </div>
        <div className="form-row">
          <label className="form-label">Jour / Sous-titre</label>
          <input className="form-input" value={t.dayLabel} onChange={e => patch({ dayLabel: e.target.value })}/>
        </div>
      </div>

      <div className="trn-section">
        <div className="trn-section-title">Waiting screen — vues actives</div>
        <div className="trn-toggle-row">
          {(['bracket','nextMatch','schedule'] as const).map(v => (
            <button key={v} className={`trn-view-toggle${ws.views.includes(v) ? ' on' : ''}`} onClick={() => toggleView(v)}>
              {{ bracket:'🏆 Bracket', nextMatch:'⚡ Prochain match', schedule:'📅 Programme' }[v]}
            </button>
          ))}
        </div>
        <div className="form-row" style={{ marginTop: 12 }}>
          <label className="form-label">Rotation (secondes)</label>
          <input className="form-input form-input-sm" type="number" min={5} max={120}
            value={ws.rotationSec} onChange={e => setWs({ rotationSec: Number(e.target.value) })}/>
        </div>
        <div className="form-row">
          <label className="form-label">Titre sidebar droite</label>
          <input className="form-input" value={ws.sidebarTitle} onChange={e => setWs({ sidebarTitle: e.target.value })}/>
        </div>
        <div className="form-row">
          <label className="form-label">Compte à rebours (datetime ISO)</label>
          <input className="form-input" type="datetime-local"
            value={ws.countdownTarget ? ws.countdownTarget.slice(0,16) : ''}
            onChange={e => setWs({ countdownTarget: e.target.value ? new Date(e.target.value).toISOString() : null })}/>
        </div>
      </div>
    </div>
  );
}

// ── Teams tab ─────────────────────────────────────────────────────────────────
function TeamsTab({ t, patch }: { t: TournamentConfig; patch: (p: Partial<TournamentConfig>) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const teams = t.teams || [];

  const TEAM_COLORS = ['#2257ff','#ff335f','#ff9500','#00c896','#c850ff','#ffd600','#00b4d8','#ff6b35'];

  const addTeam = () => {
    const id = uid();
    const usedColors = teams.map(x => x.color.toLowerCase());
    const color = TEAM_COLORS.find(c => !usedColors.includes(c.toLowerCase())) || TEAM_COLORS[teams.length % TEAM_COLORS.length];
    const team: TournamentTeam = { id, name: 'Nouvelle équipe', shortName: 'NEW', logo: '', color, players: [] };
    patch({ teams: [...teams, team] });
    setEditing(id);
  };

  // Auto-assign distinct colors to all teams
  const autoColors = () => {
    const updated = teams.map((team, i) => ({ ...team, color: TEAM_COLORS[i % TEAM_COLORS.length] }));
    patch({ teams: updated });
  };

  // Detect duplicate colors
  const colorGroups = teams.reduce((acc, t) => {
    acc[t.color] = (acc[t.color] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const hasDuplicateColors = Object.values(colorGroups).some(v => v > 1);

  const updateTeam = (id: string, p: Partial<TournamentTeam>) => {
    patch({ teams: teams.map(x => x.id === id ? { ...x, ...p } : x) });
  };

  const removeTeam = (id: string) => {
    patch({ teams: teams.filter(x => x.id !== id) });
    if (editing === id) setEditing(null);
  };

  const editingTeam = teams.find(x => x.id === editing);

  return (
    <div className="trn-two-col">
      {/* Left: team list */}
      <div className="trn-list-col">
        {/* Alerte couleurs identiques */}
        {hasDuplicateColors && (
          <div style={{ padding:'8px 10px', background:'rgba(245,158,11,.12)', border:'1px solid rgba(245,158,11,.4)', borderRadius:7, marginBottom:6 }}>
            <div style={{ fontSize:11, fontWeight:900, color:'#f59e0b', letterSpacing:.5 }}>⚠ Couleurs identiques détectées</div>
            <button className="trn-add-btn sm" style={{ marginTop:6, width:'100%', borderColor:'#f59e0b', color:'#f59e0b' }}
              onClick={autoColors}>✦ Assigner couleurs auto</button>
          </div>
        )}

        {teams.map(team => (
          <div key={team.id} className={`trn-list-item${editing === team.id ? ' active' : ''}`}
               onClick={() => setEditing(team.id)}>
            {/* Pastille couleur */}
            <div style={{ width:10, height:10, borderRadius:'50%', background:team.color, flexShrink:0, boxShadow:`0 0 0 2px ${team.color}44` }}/>
            {team.logo && <img src={team.logo} alt="" className="trn-item-logo"/>}
            <span className="trn-item-name">{team.name}</span>
            <button className="trn-item-del" onClick={e => { e.stopPropagation(); removeTeam(team.id); }}>✕</button>
          </div>
        ))}
        <button className="trn-add-btn" onClick={addTeam}>+ Ajouter une équipe</button>
        {teams.length > 1 && !hasDuplicateColors && (
          <button className="trn-add-btn sm" style={{ marginTop:4 }} onClick={autoColors}>↺ Réassigner couleurs auto</button>
        )}
      </div>

      {/* Right: team editor */}
      {editingTeam && (
        <div className="trn-edit-col">
          <div className="trn-section-title">{editingTeam.name}</div>
          <div className="form-row">
            <label className="form-label">Nom complet</label>
            <input className="form-input" value={editingTeam.name}
              onChange={e => updateTeam(editingTeam.id, { name: e.target.value })}/>
          </div>
          <div className="form-row">
            <label className="form-label">Abréviation</label>
            <input className="form-input form-input-sm" value={editingTeam.shortName}
              onChange={e => updateTeam(editingTeam.id, { shortName: e.target.value })}/>
          </div>
          <div className="form-row">
            <label className="form-label">Logo (URL)</label>
            <input className="form-input" value={editingTeam.logo}
              onChange={e => updateTeam(editingTeam.id, { logo: e.target.value })}/>
          </div>
          <div className="form-row">
            <label className="form-label">Couleur de l'équipe</label>
            <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
              <input type="color" value={editingTeam.color}
                onChange={e => updateTeam(editingTeam.id, { color: e.target.value })}
                style={{ width:48, height:48, cursor:'pointer', border:`3px solid ${editingTeam.color}`, borderRadius:8, padding:2, background:'#0c0c14' }}/>
              <input className="form-input form-input-sm" value={editingTeam.color}
                onChange={e => updateTeam(editingTeam.id, { color: e.target.value })}/>
              {/* Palette rapide */}
              <div style={{ display:'flex', gap:5, flexWrap:'wrap' }}>
                {['#2257ff','#ff335f','#ff9500','#00c896','#c850ff','#ffd600','#00b4d8','#ff6b35'].map(c => (
                  <button key={c} title={c}
                    onClick={() => updateTeam(editingTeam.id, { color: c })}
                    style={{ width:20, height:20, borderRadius:'50%', background:c, border: editingTeam.color===c ? '2px solid #fff' : '2px solid transparent', cursor:'pointer', padding:0 }}/>
                ))}
              </div>
            </div>
          </div>

          {/* Players */}
          <div className="trn-section-title" style={{ marginTop:16 }}>Joueurs</div>
          {(editingTeam.players || []).map((p, i) => (
            <PlayerRow key={i} player={p}
              onChange={updated => {
                const players = editingTeam.players.map((x,j) => j===i ? updated : x);
                updateTeam(editingTeam.id, { players });
              }}
              onRemove={() => {
                const players = editingTeam.players.filter((_,j) => j!==i);
                updateTeam(editingTeam.id, { players });
              }}
            />
          ))}
          <button className="trn-add-btn sm" onClick={() => {
            const players = [...(editingTeam.players || []), { name: 'PLAYER', country: '', role: 'player' as const, photo: '' }];
            updateTeam(editingTeam.id, { players });
          }}>+ Joueur</button>
        </div>
      )}
    </div>
  );
}

function PlayerRow({ player, onChange, onRemove }: {
  player: TournamentPlayer;
  onChange: (p: TournamentPlayer) => void;
  onRemove: () => void;
}) {
  return (
    <div className="trn-player-row">
      <input className="form-input" placeholder="Pseudo" value={player.name}
        onChange={e => onChange({ ...player, name: e.target.value })}/>
      <FlagPicker value={player.country || ''} onChange={code => onChange({ ...player, country: code })}/>
      <select className="form-select" value={player.role || 'player'}
        onChange={e => onChange({ ...player, role: e.target.value as TournamentPlayer['role'] })}>
        <option value="player">Joueur</option>
        <option value="coach">Coach</option>
        <option value="sub">Sub</option>
      </select>
      <input className="form-input" placeholder="URL photo" value={player.photo || ''}
        onChange={e => onChange({ ...player, photo: e.target.value })}/>
      <button className="trn-item-del" onClick={onRemove}>✕</button>
    </div>
  );
}

// ── Pools tab ─────────────────────────────────────────────────────────────────
function PoolsTab({ t, patch }: { t: TournamentConfig; patch: (p: Partial<TournamentConfig>) => void }) {
  const pools = t.pools || [];
  const teams = t.teams || [];

  const addPool = () => {
    patch({ pools: [...pools, { id: uid(), name: `Groupe ${String.fromCharCode(65+pools.length)}`, teamIds: [], matches: [] }] });
  };

  const updatePool = (id: string, p: Partial<Pool>) => {
    patch({ pools: pools.map(x => x.id === id ? { ...x, ...p } : x) });
  };

  const removePool = (id: string) => patch({ pools: pools.filter(x => x.id !== id) });

  const toggleTeam = (pool: Pool, tid: string) => {
    const teamIds = pool.teamIds.includes(tid)
      ? pool.teamIds.filter(x => x !== tid)
      : [...pool.teamIds, tid];
    // Regenerate matches for round-robin
    const matches: PoolMatch[] = [];
    for (let i = 0; i < teamIds.length; i++)
      for (let j = i+1; j < teamIds.length; j++)
        matches.push({ id: uid(), team1Id: teamIds[i], team2Id: teamIds[j], score1: 0, score2: 0, played: false });
    updatePool(pool.id, { teamIds, matches });
  };

  const updateMatch = (pool: Pool, mid: string, p: Partial<PoolMatch>) => {
    const matches = pool.matches.map(m => {
      if (m.id !== mid) return m;
      const updated = { ...m, ...p };
      // Auto-calculate winnerId from scores when played
      if (updated.played && updated.score1 !== updated.score2) {
        updated.winnerId = updated.score1 > updated.score2 ? updated.team1Id : updated.team2Id;
      } else if (!updated.played) {
        updated.winnerId = undefined;
      }
      return updated;
    });
    updatePool(pool.id, { matches });
  };

  return (
    <div className="trn-section-list">
      {pools.map(pool => (
        <div key={pool.id} className="trn-section">
          <div className="trn-section-header">
            <input className="form-input form-input-sm" value={pool.name}
              onChange={e => updatePool(pool.id, { name: e.target.value })}/>
            <button className="trn-item-del" onClick={() => removePool(pool.id)}>✕ Supprimer</button>
          </div>

          {/* Team selection */}
          <div className="trn-chip-row">
            {teams.map(team => (
              <button key={team.id}
                className={`trn-chip${pool.teamIds.includes(team.id) ? ' on' : ''}`}
                style={pool.teamIds.includes(team.id) ? { borderColor: team.color, color: team.color } : {}}
                onClick={() => toggleTeam(pool, team.id)}>
                {team.shortName || team.name}
              </button>
            ))}
          </div>

          {/* Match results */}
          {pool.matches.length > 0 && (
            <div className="trn-matches-grid">
              {pool.matches.map(m => {
                const t1 = teams.find(x => x.id === m.team1Id);
                const t2 = teams.find(x => x.id === m.team2Id);
                return (
                  <div key={m.id} className="trn-match-row">
                    <span className="trn-match-team">{t1?.shortName || '?'}</span>
                    <input className="form-input form-input-xs" type="number" min={0} value={m.score1}
                      onChange={e => updateMatch(pool, m.id, { score1: +e.target.value, played: true })}/>
                    <span>–</span>
                    <input className="form-input form-input-xs" type="number" min={0} value={m.score2}
                      onChange={e => updateMatch(pool, m.id, { score2: +e.target.value, played: true })}/>
                    <span className="trn-match-team">{t2?.shortName || '?'}</span>
                    <button className={`trn-chip${m.played ? ' on' : ''}`} onClick={() => updateMatch(pool, m.id, { played: !m.played })}>
                      {m.played ? '✓' : '—'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
      <button className="trn-add-btn" onClick={addPool}>+ Ajouter un groupe / pool</button>
    </div>
  );
}

// ── Bracket tab ───────────────────────────────────────────────────────────────
function BracketTab({ t, patch }: { t: TournamentConfig; patch: (p: Partial<TournamentConfig>) => void }) {
  const b = t.bracket || { format: 'double', rounds: [] };
  const teams = t.teams || [];
  const setB = (p: Partial<typeof b>) => patch({ bracket: { ...b, ...p } });

  const addRound = (type: BracketRound['type']) => {
    const labels: Record<string, string> = { upper: 'Upper Bracket', lower: 'Lower Bracket', grand: 'Grande Finale' };
    const round: BracketRound = { id: uid(), name: labels[type], type, matches: [] };
    setB({ rounds: [...b.rounds, round] });
  };

  const updateRound = (id: string, p: Partial<BracketRound>) => {
    setB({ rounds: b.rounds.map(r => r.id === id ? { ...r, ...p } : r) });
  };

  const removeRound = (id: string) => setB({ rounds: b.rounds.filter(r => r.id !== id) });

  const addMatch = (roundId: string) => {
    const m: BracketMatch = { id: uid(), team1Id: undefined, team2Id: undefined, score1: 0, score2: 0 };
    setB({ rounds: b.rounds.map(r => r.id === roundId ? { ...r, matches: [...r.matches, m] } : r) });
  };

  const updateMatch = (roundId: string, mid: string, p: Partial<BracketMatch>) => {
    setB({
      rounds: b.rounds.map(r => r.id === roundId
        ? { ...r, matches: r.matches.map(m => m.id === mid ? { ...m, ...p } : m) }
        : r)
    });
  };

  const removeMatch = (roundId: string, mid: string) => {
    setB({ rounds: b.rounds.map(r => r.id === roundId ? { ...r, matches: r.matches.filter(m => m.id !== mid) } : r) });
  };

  // Quick templates
  const applyTemplate = (tpl: string) => {
    const makeRound = (name: string, type: BracketRound['type'], n: number): BracketRound => ({
      id: uid(), name, type,
      matches: Array.from({ length: n }, () => ({ id: uid(), score1: 0, score2: 0 }))
    });
    const templates: Record<string, BracketRound[]> = {
      'se4':  [makeRound('Demi-Finales','upper',2), makeRound('Finale','grand',1)],
      'se8':  [makeRound('Quarts de Finale','upper',4), makeRound('Demi-Finales','upper',2), makeRound('Finale','grand',1)],
      'de4':  [makeRound('Upper - Demi-Finales','upper',2), makeRound('Lower - R1','lower',1), makeRound('Lower - Finale','lower',1), makeRound('Grande Finale','grand',1)],
      'de8':  [makeRound('Upper - R1','upper',4), makeRound('Upper - Demi','upper',2), makeRound('Upper - Finale','upper',1), makeRound('Lower - R1','lower',2), makeRound('Lower - R2','lower',2), makeRound('Lower - Demi','lower',1), makeRound('Lower - Finale','lower',1), makeRound('Grande Finale','grand',1)],
    };
    if (templates[tpl]) setB({ rounds: templates[tpl] });
  };

  const teamOpts = [{ value: '', label: 'TBD' }, ...teams.map(x => ({ value: x.id, label: x.name }))];

  return (
    <div className="trn-section-list">
      <div className="trn-section">
        <div className="trn-section-title">Format & Modèles rapides</div>
        <div className="trn-row">
          <label className="form-label">Format</label>
          <select className="form-select" value={b.format} onChange={e => setB({ format: e.target.value as 'single'|'double' })}>
            <option value="single">Single elimination (sans lower bracket)</option>
            <option value="double">Double elimination (avec lower bracket)</option>
          </select>
        </div>
        <div className="trn-chip-row" style={{ marginTop: 10 }}>
          <span className="form-label" style={{ alignSelf:'center' }}>Modèle :</span>
          {[['se4','SE 4 équipes'],['se8','SE 8 équipes'],['de4','DE 4 équipes'],['de8','DE 8 équipes']].map(([k,l]) => (
            <button key={k} className="trn-chip" onClick={() => applyTemplate(k)}>{l}</button>
          ))}
        </div>
      </div>

      {b.rounds.map(round => (
        <div key={round.id} className="trn-section">
          <div className="trn-section-header">
            <span className={`trn-round-badge ${round.type}`}>{round.type.toUpperCase()}</span>
            <input className="form-input" value={round.name}
              onChange={e => updateRound(round.id, { name: e.target.value })}/>
            <select className="form-select form-select-sm" value={round.type}
              onChange={e => updateRound(round.id, { type: e.target.value as BracketRound['type'] })}>
              <option value="upper">Upper</option>
              <option value="lower">Lower</option>
              <option value="grand">Grand Final</option>
            </select>
            <button className="trn-item-del" onClick={() => removeRound(round.id)}>✕</button>
          </div>

          {round.matches.map(m => (
            <div key={m.id} className="trn-bracket-match-row">
              <select className="form-select" value={m.team1Id || ''}
                onChange={e => updateMatch(round.id, m.id, { team1Id: e.target.value || undefined })}>
                {teamOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <input className="form-input form-input-xs" type="number" min={0} value={m.score1}
                onChange={e => updateMatch(round.id, m.id, { score1: +e.target.value })}/>
              <span>–</span>
              <input className="form-input form-input-xs" type="number" min={0} value={m.score2}
                onChange={e => updateMatch(round.id, m.id, { score2: +e.target.value })}/>
              <select className="form-select" value={m.team2Id || ''}
                onChange={e => updateMatch(round.id, m.id, { team2Id: e.target.value || undefined })}>
                {teamOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="form-select" value={m.winnerId || ''}
                onChange={e => updateMatch(round.id, m.id, { winnerId: e.target.value || undefined })}>
                <option value="">Aucun vainqueur</option>
                {m.team1Id && <option value={m.team1Id}>{teams.find(x=>x.id===m.team1Id)?.shortName}</option>}
                {m.team2Id && <option value={m.team2Id}>{teams.find(x=>x.id===m.team2Id)?.shortName}</option>}
              </select>
              <button className="trn-item-del" onClick={() => removeMatch(round.id, m.id)}>✕</button>
            </div>
          ))}

          <button className="trn-add-btn sm" onClick={() => addMatch(round.id)}>+ Match</button>
        </div>
      ))}

      <div className="trn-chip-row">
        <button className="trn-add-btn" onClick={() => addRound('upper')}>+ Round Upper</button>
        <button className="trn-add-btn" onClick={() => addRound('lower')}>+ Round Lower</button>
        <button className="trn-add-btn" onClick={() => addRound('grand')}>+ Grande Finale</button>
      </div>
    </div>
  );
}

// ── Schedule tab ──────────────────────────────────────────────────────────────
function ScheduleTab({ t, patch }: { t: TournamentConfig; patch: (p: Partial<TournamentConfig>) => void }) {
  const schedule = t.schedule || [];
  const teams = t.teams || [];

  const add = () => patch({ schedule: [...schedule, { id: uid(), time: '14:00', team1Id: '', team2Id: '', label: '' }] });
  const update = (id: string, p: Partial<ScheduleEntry>) =>
    patch({ schedule: schedule.map(x => x.id === id ? { ...x, ...p } : x) });
  const remove = (id: string) => patch({ schedule: schedule.filter(x => x.id !== id) });

  const teamOpts = [{ value: '', label: 'TBD' }, ...teams.map(x => ({ value: x.id, label: x.name }))];

  return (
    <div className="trn-section-list">
      <div className="trn-section">
        <div className="trn-section-title">Matches du programme</div>
        {schedule.map((entry, idx) => (
          <div key={entry.id} className="trn-section" style={{ padding: '12px 14px', marginBottom: 0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
              {/* Heure */}
              <div style={{ display:'flex', flexDirection:'column', gap:3, minWidth:72 }}>
                <span style={{ fontSize:10, fontWeight:900, letterSpacing:1.5, opacity:.45, textTransform:'uppercase' }}>Heure</span>
                <input className="form-input" placeholder="14:00" value={entry.time}
                  style={{ width:72, textAlign:'center', fontWeight:900, fontSize:15 }}
                  onChange={e => update(entry.id, { time: e.target.value })}/>
              </div>
              {/* Équipe 1 */}
              <div style={{ display:'flex', flexDirection:'column', gap:3, flex:1, minWidth:120 }}>
                <span style={{ fontSize:10, fontWeight:900, letterSpacing:1.5, opacity:.45, textTransform:'uppercase' }}>Équipe gauche</span>
                <select className="form-select" value={entry.team1Id}
                  onChange={e => update(entry.id, { team1Id: e.target.value })}>
                  {teamOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <span style={{ fontWeight:900, opacity:.4, paddingTop:18 }}>VS</span>
              {/* Équipe 2 */}
              <div style={{ display:'flex', flexDirection:'column', gap:3, flex:1, minWidth:120 }}>
                <span style={{ fontSize:10, fontWeight:900, letterSpacing:1.5, opacity:.45, textTransform:'uppercase' }}>Équipe droite</span>
                <select className="form-select" value={entry.team2Id}
                  onChange={e => update(entry.id, { team2Id: e.target.value })}>
                  {teamOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {/* Label optionnel */}
              <div style={{ display:'flex', flexDirection:'column', gap:3, flex:1, minWidth:100 }}>
                <span style={{ fontSize:10, fontWeight:900, letterSpacing:1.5, opacity:.45, textTransform:'uppercase' }}>Label (optionnel)</span>
                <input className="form-input" placeholder="ex: Demi-finale" value={entry.label || ''}
                  onChange={e => update(entry.id, { label: e.target.value })}/>
              </div>
              <button className="trn-item-del" style={{ alignSelf:'flex-end', marginBottom:2 }}
                onClick={() => remove(entry.id)}>✕</button>
            </div>
          </div>
        ))}
        <button className="trn-add-btn" onClick={add}>+ Ajouter un match</button>
      </div>
    </div>
  );
}

// ── Next Match tab ────────────────────────────────────────────────────────────
function NextMatchTab({ t, patch }: { t: TournamentConfig; patch: (p: Partial<TournamentConfig>) => void }) {
  const nm = t.nextMatch;
  const teams = t.teams || [];
  const set = (p: Partial<typeof nm>) => patch({ nextMatch: { ...nm, ...p } });
  const teamOpts = [{ value: '', label: 'Aucune' }, ...teams.map(x => ({ value: x.id, label: x.name }))];

  const preview1 = teams.find(x => x.id === nm.team1Id);
  const preview2 = teams.find(x => x.id === nm.team2Id);

  return (
    <div className="trn-section-list">
      <div className="trn-section">
        <div className="trn-section-title">Configuration</div>
        <div className="form-row">
          <label className="form-label">Label principal</label>
          <input className="form-input" value={nm.label} onChange={e => set({ label: e.target.value })}/>
        </div>
        <div className="form-row">
          <label className="form-label">Sous-label (ex: UPPER BRACKET - FINALE)</label>
          <input className="form-input" value={nm.sublabel} onChange={e => set({ sublabel: e.target.value })}/>
        </div>
        <div className="form-row">
          <label className="form-label">Équipe 1 (gauche)</label>
          <select className="form-select" value={nm.team1Id || ''}
            onChange={e => set({ team1Id: e.target.value || null })}>
            {teamOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="form-row">
          <label className="form-label">Équipe 2 (droite)</label>
          <select className="form-select" value={nm.team2Id || ''}
            onChange={e => set({ team2Id: e.target.value || null })}>
            {teamOpts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>

      {preview1 && preview2 && (
        <div className="trn-section">
          <div className="trn-section-title">Aperçu</div>
          <div className="trn-nm-preview">
            <div className="trn-nm-team" style={{ borderColor: preview1.color }}>
              {preview1.logo && <img src={preview1.logo} alt="" style={{ width:36, height:36, objectFit:'contain' }}/>}
              <div>
                <div style={{ fontWeight:900, fontSize:16 }}>{preview1.name}</div>
                <div style={{ fontSize:12, opacity:.6 }}>{(preview1.players||[]).filter(p=>p.role!=='coach').map(p=>p.name).join(' · ')}</div>
              </div>
            </div>
            <div style={{ fontWeight:900, fontSize:20, color:'rgba(255,255,255,.4)' }}>VS</div>
            <div className="trn-nm-team" style={{ borderColor: preview2.color }}>
              {preview2.logo && <img src={preview2.logo} alt="" style={{ width:36, height:36, objectFit:'contain' }}/>}
              <div>
                <div style={{ fontWeight:900, fontSize:16 }}>{preview2.name}</div>
                <div style={{ fontSize:12, opacity:.6 }}>{(preview2.players||[]).filter(p=>p.role!=='coach').map(p=>p.name).join(' · ')}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
