import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './style.css';


// ── Electron / OBS detection ──────────────────────────────────────────────────
// If running inside Electron → use IPC. Otherwise (OBS browser source) → fetch JSON.
const loadConfig = window.electronAPI
  ? () => window.electronAPI.getConfig()
  : () => fetch('/config/overlay-config.json').then(r => r.json());

// ─────────────────────────────────────────────────────────────────────────────

const defaultTournament = {
  eventName: 'MON TOURNOI',
  phaseLabel: 'PLAYOFFS',
  dayLabel: 'JOUR 1',
  waitingScreen: {
    views: ['bracket', 'nextMatch', 'schedule'],
    rotationSec: 15,
    countdownTarget: null,
    sidebarTitle: 'PROCHAIN MATCH',
  },
  teams: [],
  pools: [],
  bracket: { format: 'double', rounds: [] },
  schedule: [],
  nextMatch: { label: 'PROCHAIN MATCH', sublabel: '', team1Id: null, team2Id: null },
};

const defaultConfig = {
  connection: { mockMode: false, websocketUrl: 'ws://127.0.0.1:49124', reconnectMs: 2000 },
  match: {
    eventTitle: 'PARIS MAJOR | GROUPE C | TOUR 3',
    seriesType: 'BO7',
    seriesScore: { left: 0, right: 0 },
    showConnectionStatus: true,
    autoIncrementSeries: true
  },
  teams: {
    left:  { name: 'BLUE',   shortName: 'BLUE',   logo: '/assets/teams/left.svg',  color: '#2257ff', side: 0 },
    right: { name: 'ORANGE', shortName: 'ORANGE', logo: '/assets/teams/right.svg', color: '#ff335f', side: 1 }
  },
  ui: { showSideBoosts: true, showPlayerCard: true, showBoostRing: true, showEvents: true, eventTtlMs: 2200, teamSize: 3, updateThrottleMs: 80, targetGraceMs: 900 }
};

const pick = (...vals) => vals.find(v => v !== undefined && v !== null && v !== '');
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const bool = (v, fallback = false) => typeof v === 'boolean' ? v : fallback;

function initialState(config = defaultConfig) {
  return {
    connected: false,
    rlConnected: false,
    matchGuid: null,
    endedMatches: {},
    statsLocked: false,   // true après MatchEnded : fige les stats jusqu'au prochain match
    seriesScore: {
      left: num(config?.match?.seriesScore?.left, 0),
      right: num(config?.match?.seriesScore?.right, 0)
    },
    game: { time: 300, overtime: false, blueScore: 0, orangeScore: 0, hasTarget: false, replay: false },
    players: [
      { id:'b1', shortcut:1, name:'BLUE 1', team:0, boost:31, score:0, goals:0, assists:0, saves:0, shots:0, demos:0 },
      { id:'b2', shortcut:2, name:'BLUE 2', team:0, boost:12, score:0, goals:0, assists:0, saves:0, shots:0, demos:0 },
      { id:'b3', shortcut:3, name:'BLUE 3', team:0, boost:11, score:0, goals:0, assists:0, saves:0, shots:0, demos:0 },
      { id:'o1', shortcut:4, name:'ORANGE 1', team:1, boost:4, score:0, goals:0, assists:0, saves:0, shots:0, demos:0 },
      { id:'o2', shortcut:5, name:'ORANGE 2', team:1, boost:92, score:0, goals:0, assists:0, saves:0, shots:0, demos:0 },
      { id:'o3', shortcut:6, name:'ORANGE 3', team:1, boost:12, score:0, goals:0, assists:0, saves:0, shots:0, demos:0 }
    ],
    target: { hasTarget: false, name: '', shortcut: null, team: null, lastSeen: 0 },
    events: [],
    lastGoal: null,    // { scorer, assister, speed, team } — populated on GoalScored
    countdownAt: null, // timestamp when 3-2-1 countdown started
    ballSpeed: 0,      // last known ball speed (km/h), frozen during replay
  };
}

function formatTime(seconds, overtime) {
  const s = Math.max(0, Math.floor(num(seconds, 0)));
  const base = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  return overtime ? `+${base}` : base;
}

function normalizePlayers(data, config = defaultConfig) {
  const src = pick(data?.Players, data?.players, data?.PlayerStats, data?.player_stats, []);
  const arr = Array.isArray(src) ? src : Object.entries(src || {}).map(([entryId, p]) => ({ entryId, ...p }));
  const maxPerTeam = Math.max(1, Math.min(8, Math.round(num(config?.ui?.teamSize, 3))));

  const mapped = arr.map((p, i) => {
    const stats = pick(p.Stats, p.stats, p) || p;
    const rawName = pick(p.Name, p.name, p.PlayerName, p.playerName, p.DisplayName, p.displayName, `PLAYER ${i + 1}`);
    const name = String(rawName).trim().toUpperCase();
    const shortcut = num(pick(p.Shortcut, p.shortcut, p.PlayerIndex, p.playerIndex), i + 1);
    const teamRaw = pick(p.TeamNum, p.teamNum, p.TeamIndex, p.teamIndex, p.Team, p.team);
    const team = num(teamRaw, i < maxPerTeam ? 0 : 1);
    return {
      rawId: String(pick(p.PrimaryId, p.primaryId, p.UniqueId, p.uniqueId, p.PlayerID, p.playerId, p.Id, p.ID, p.id, p.entryId, `${team}-${shortcut}-${name}`)),
      id: `${team}-${name || shortcut}`,
      shortcut, name, team,
      boost: Math.max(0, Math.min(100, Math.round(num(pick(p.Boost, p.boost, p.BoostAmount, p.boostAmount), 0)))),
      score: num(pick(stats.Score, stats.score), 0),
      goals: num(pick(stats.Goals, stats.goals), 0),
      assists: num(pick(stats.Assists, stats.assists), 0),
      saves: num(pick(stats.Saves, stats.saves), 0),
      shots: num(pick(stats.Shots, stats.shots), 0),
      demos: num(pick(stats.Demos, stats.demos, stats.Demolitions, stats.demolitions), 0)
    };
  }).filter(p => p.name && (p.team === 0 || p.team === 1));

  const byPlayer = new Map();
  for (const p of mapped) {
    const key = `${p.team}::${p.name}`;
    const prev = byPlayer.get(key);
    if (!prev) { byPlayer.set(key, p); continue; }
    const pc = prev.score + prev.goals + prev.assists + prev.saves + prev.shots + prev.demos;
    const nc = p.score + p.goals + p.assists + p.saves + p.shots + p.demos;
    byPlayer.set(key, { ...(nc >= pc ? p : prev), boost: p.boost });
  }

  const sorted = [...byPlayer.values()].sort((a, b) => a.team - b.team || a.shortcut - b.shortcut || a.name.localeCompare(b.name));
  return [...sorted.filter(p => p.team === 0).slice(0, maxPerTeam), ...sorted.filter(p => p.team === 1).slice(0, maxPerTeam)];
}

function getTeamScore(game, teamNum, fallback) {
  const teams = pick(game?.Teams, game?.teams, []);
  if (Array.isArray(teams)) {
    const team = teams.find(t => num(pick(t.TeamNum, t.teamNum), -1) === teamNum) || teams[teamNum];
    if (team) return num(pick(team.Score, team.score), fallback);
  }
  if (teamNum === 0) return num(pick(game?.BlueScore, game?.blueScore, game?.Team0Score, game?.TeamOneScore), fallback);
  return num(pick(game?.OrangeScore, game?.orangeScore, game?.Team1Score, game?.TeamTwoScore), fallback);
}

function normalizeTarget(game) {
  const target = pick(game?.Target, game?.target, null);
  const hasTarget = bool(pick(game?.bHasTarget, game?.hasTarget, game?.HasTarget), false);
  if (!hasTarget || !target) return { hasTarget: false, name: '', shortcut: null, team: null, lastSeen: 0 };
  const name = String(pick(target.Name, target.name, '')).toUpperCase();
  const shortcut = num(pick(target.Shortcut, target.shortcut), null);
  const team = num(pick(target.TeamNum, target.teamNum, target.Team, target.team), null);
  if (!name && !Number.isFinite(shortcut)) return { hasTarget: false, name: '', shortcut: null, team: null, lastSeen: 0 };
  return { hasTarget: true, name, shortcut, team, lastSeen: Date.now() };
}

function makeEvent(type, player, team, ttlMs = 2200) {
  const labelMap = { DEMOLISH:'DEMO', DEMOLITION:'DEMO', DEMO:'DEMO', SAVE:'SAVE', EPICSAVE:'SAVE', 'EPIC SAVE':'SAVE', SHOT:'SHOT', SHOTS:'SHOT', GOAL:'GOAL', GOALS:'GOAL', ASSIST:'ASSIST', ASSISTS:'ASSIST' };
  const normalized = String(type || 'EVENT').replace(/_/g, ' ').toUpperCase();
  const compact = normalized.replace(/\s+/g, '');
  return {
    id: `${Date.now()}-${Math.random()}`,
    type: labelMap[normalized] || labelMap[compact] || normalized,
    player: String(player || 'PLAYER').toUpperCase(),
    team: num(team, 0),
    at: Date.now(),
    expiresAt: Date.now() + ttlMs
  };
}

function getStatfeedEvent(data, ttlMs) {
  const main = pick(data?.MainTarget, data?.mainTarget, data?.Player, data?.player, data?.Scorer, null);
  const type = pick(data?.Type, data?.type, data?.EventName, data?.eventName, 'EVENT');
  if (!main) return null;
  return makeEvent(type, pick(main.Name, main.name), pick(main.TeamNum, main.teamNum, main.Team), ttlMs);
}

function getGoalEvents(data, ttlMs) {
  const events = [];
  const scorer = pick(data?.Scorer, data?.scorer, null);
  const assister = pick(data?.Assister, data?.assister, null);
  if (scorer) events.push(makeEvent('GOAL', pick(scorer.Name, scorer.name), pick(scorer.TeamNum, scorer.teamNum), ttlMs));
  if (assister) events.push(makeEvent('ASSIST', pick(assister.Name, assister.name), pick(assister.TeamNum, assister.teamNum), ttlMs));
  return events;
}

function updateFromMessage(prev, msg, config) {
  const event = msg?.Event || msg?.event || msg?.type;
  const data = msg?.Data || msg?.data || {};
  const ttl = num(config?.ui?.eventTtlMs, 2200);
  const now = Date.now();
  const keepEvents = prev.events.filter(e => e.expiresAt > now);

  // Live config update from Electron control panel
  if (event === 'ConfigUpdated') {
    window.dispatchEvent(new CustomEvent('rl-config-updated', { detail: data }));
    return { ...prev, events: keepEvents };
  }

  if (event === 'RelayStatus') return { ...prev, connected: true, rlConnected: !!data.rlConnected, events: keepEvents };

  if (event === 'ClockUpdatedSeconds') {
    return { ...prev, rlConnected: true, game: { ...prev.game, time: num(data.TimeSeconds, prev.game.time), overtime: bool(data.bOvertime, prev.game.overtime) }, events: keepEvents };
  }

  if (event === 'MatchEnded') {
    const matchGuid = String(pick(data.MatchGuid, prev.matchGuid, `ended-${now}`));
    if (prev.endedMatches[matchGuid]) return { ...prev, events: keepEvents };
    const winner = num(pick(data.WinnerTeamNum, data.winnerTeamNum), -1);
    const seriesScore = { ...prev.seriesScore };
    if (config?.match?.autoIncrementSeries !== false) {
      if (winner === 0) seriesScore.left += 1;
      if (winner === 1) seriesScore.right += 1;
    }
    return { ...prev, rlConnected: true, seriesScore, endedMatches: { ...prev.endedMatches, [matchGuid]: true }, statsLocked: true, events: keepEvents };
  }

  if (event === 'GoalScored' || event === 'game:goal_scored') {
    const scorer = String(pick(data?.Scorer?.Name, data?.scorer?.name, 'UNKNOWN')).toUpperCase();
    const assisterRaw = pick(data?.Assister?.Name, data?.assister?.name, null);
    const assister = assisterRaw ? String(assisterRaw).toUpperCase() : null;
    // ball_last_touch.speed is the official RL Stats API field (km/h)
    const speed = num(pick(
      data?.ball_last_touch?.speed, data?.ball_last_touch?.Speed,
      data?.BallLastTouch?.speed,   data?.BallLastTouch?.Speed,
      data?.BallSpeed, data?.ballSpeed, data?.ball?.speed
    ), prev.ballSpeed);
    const team = num(pick(data?.Scorer?.TeamNum, data?.scorer?.teamnum, data?.Scorer?.teamNum), 0);
    return {
      ...prev, rlConnected: true,
      lastGoal: { scorer, assister, speed, team },
      events: [...getGoalEvents(data, ttl), ...keepEvents].slice(0, 8)
    };
  }
  if (event === 'StatfeedEvent') {
    const ev = getStatfeedEvent(data, ttl);
    return { ...prev, rlConnected: true, events: ev ? [ev, ...keepEvents].slice(0, 8) : keepEvents };
  }

  // SOS countdown events
  if (event === 'game:pre_countdown_begin') return { ...prev, countdownAt: Date.now(), events: keepEvents };
  if (event === 'game:post_countdown_begin') return { ...prev, countdownAt: null, events: keepEvents };
  if (event === 'game:match_created' || event === 'game:initialized') return { ...prev, countdownAt: null, lastGoal: null, statsLocked: false, events: keepEvents };

  if (event === 'UpdateState' || event === 'game:update_state' || data?.Players || data?.players || data?.Game || data?.game) {
    const raw = (event === 'game:update_state') ? data : data;
    const game = pick(raw.Game, raw.game, raw) || {};
    const normalizedPlayers = normalizePlayers(raw, config);
    // Ne pas écraser les stats si le match est terminé (équipe qui quitte → données partielles)
    const players = prev.statsLocked ? prev.players : (normalizedPlayers.length ? normalizedPlayers : prev.players);
    const matchGuid = pick(raw.MatchGuid, raw.matchGuid, prev.matchGuid);
    const incomingTarget = normalizeTarget(game);
    const targetGraceMs = num(config?.ui?.targetGraceMs, 900);
    const target = incomingTarget.hasTarget
      ? incomingTarget
      : (prev.target?.hasTarget && now - num(prev.target.lastSeen, 0) < targetGraceMs ? prev.target : incomingTarget);

    const nowReplay = bool(pick(game.bReplay, game.replay), false);
    // Freeze ball speed during replay (keep goal-moment speed); update during live play
    const ballSpeed = !nowReplay
      ? num(pick(raw?.ball?.speed, raw?.Ball?.speed, game?.ball?.speed), prev.ballSpeed)
      : prev.ballSpeed;
    // Auto-start countdown when replay ends (if no SOS event triggered it earlier)
    const countdownAt = (prev.game.replay && !nowReplay && !prev.countdownAt) ? Date.now() : prev.countdownAt;

    return {
      ...prev,
      rlConnected: true,
      matchGuid,
      game: {
        time: num(pick(game.TimeSeconds, game.timeSeconds, game.SecondsRemaining, game.seconds_remaining, game.TimeRemaining, game.time_remaining), prev.game.time),
        overtime: bool(pick(game.bOvertime, game.IsOvertime, game.isOvertime, game.Overtime, game.overtime), prev.game.overtime),
        blueScore: getTeamScore(game, 0, prev.game.blueScore),
        orangeScore: getTeamScore(game, 1, prev.game.orangeScore),
        hasTarget: target.hasTarget,
        replay: nowReplay,
      },
      players, target, events: keepEvents,
      ballSpeed, countdownAt,
    };
  }

  return { ...prev, events: keepEvents };
}

function useOverlayData(config) {
  const [state, setState] = useState(() => initialState(config));
  const wsRef = useRef(null);
  const latestUpdateRef = useRef(null);
  const flushTimerRef = useRef(null);

  useEffect(() => {
    setState(prev => ({ ...prev, seriesScore: { left: num(config?.match?.seriesScore?.left, prev.seriesScore.left), right: num(config?.match?.seriesScore?.right, prev.seriesScore.right) } }));
  }, [config?.match?.seriesScore?.left, config?.match?.seriesScore?.right]);

  useEffect(() => {
    const tick = setInterval(() => setState(prev => ({ ...prev, events: prev.events.filter(e => e.expiresAt > Date.now()) })), 250);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (config.connection.mockMode) {
      const id = setInterval(() => {
        setState(prev => {
          const players = prev.players.map(p => ({ ...p, boost: Math.max(0, Math.min(100, p.boost + Math.round(Math.random() * 22 - 11))) }));
          const targetPlayer = players[Math.floor(Date.now() / 3500) % players.length];
          const ev = Math.random() > 0.9 ? [makeEvent(['SHOT','SAVE','DEMO','GOAL','ASSIST'][Math.floor(Math.random()*5)], players[Math.floor(Math.random()*players.length)].name, 0, config.ui.eventTtlMs)] : [];
          return { ...prev, connected: true, rlConnected: false, players, target: { hasTarget: true, name: targetPlayer.name, shortcut: targetPlayer.shortcut, team: targetPlayer.team, lastSeen: Date.now() }, game: { ...prev.game, hasTarget: true, time: Math.max(0, prev.game.time - 0.5) }, events: [...ev, ...prev.events.filter(e => e.expiresAt > Date.now())].slice(0, 8) };
        });
      }, 500);
      return () => clearInterval(id);
    }

    let stop = false;
    let timer = null;
    const connect = () => {
      if (stop) return;
      const ws = new WebSocket(config.connection.websocketUrl);
      wsRef.current = ws;
      ws.onopen = () => setState(prev => ({ ...prev, connected: true }));
      ws.onmessage = e => {
        try {
          const msg = JSON.parse(e.data);
          const event = msg?.Event || msg?.event || msg?.type;
          const isHighRate = event === 'UpdateState' || msg?.Data?.Players || msg?.Data?.Game;
          if (isHighRate) {
            latestUpdateRef.current = msg;
            if (!flushTimerRef.current) {
              flushTimerRef.current = setTimeout(() => {
                const latest = latestUpdateRef.current;
                latestUpdateRef.current = null;
                flushTimerRef.current = null;
                if (latest) setState(prev => updateFromMessage(prev, latest, config));
              }, num(config?.ui?.updateThrottleMs, 80));
            }
          } else {
            setState(prev => updateFromMessage(prev, msg, config));
          }
        } catch (err) { console.warn('Overlay parse error', err); }
      };
      ws.onerror = () => setState(prev => ({ ...prev, connected: false }));
      ws.onclose = () => {
        setState(prev => ({ ...prev, connected: false, rlConnected: false }));
        timer = setTimeout(connect, config.connection.reconnectMs || 2000);
      };
    };
    connect();
    return () => { stop = true; clearTimeout(timer); clearTimeout(flushTimerRef.current); flushTimerRef.current = null; latestUpdateRef.current = null; wsRef.current?.close(); };
  }, [config.connection.mockMode, config.connection.websocketUrl, config.connection.reconnectMs]);

  return state;
}

// ── Series bar: single row, left fills →, right fills ←, center = decisive game ─
function SeriesBar({ total, leftScore, rightScore, leftColor, rightColor, mini }) {
  return (
    <div className={`series-bar${mini ? ' mini' : ''}`}>
      {Array.from({ length: total }).map((_, i) => {
        const isLeft  = i < leftScore;
        const isRight = i >= total - rightScore;
        const style = isLeft  ? { background: leftColor,  borderColor: leftColor  }
                    : isRight ? { background: rightColor, borderColor: rightColor }
                    : {};
        return <span key={i} className="series-dot" style={style}/>;
      })}
    </div>
  );
}

function TopScoreboard({ config, state, layoutMode, pos, compact }) {
  const { onMouseDown, pos: dp, adjustScale } = useDrag('scoreboard', pos, layoutMode);
  const sc = dp.scale || 1;
  const left = config.teams.left, right = config.teams.right;
  // Total games in the series (BO3=3, BO5=5, BO7=7)
  const totalGames = config.match.seriesType === 'BO7' ? 7 : config.match.seriesType === 'BO3' ? 3 : 5;
  return (
    <div
      className={`top-scoreboard${compact ? ' compact' : ''}`}
      style={{ transform: `translateX(-50%) translate(${dp.x}px, ${dp.y}px) scale(${sc})`, ...(layoutMode ? DRAG_STYLE : {}) }}
      onMouseDown={onMouseDown}
    >
      {layoutMode && <ScaleHud pos={dp} adjustScale={adjustScale}/>}
      <div className="event-title">{config.match.eventTitle}</div>
      <div className="score-row">
        {/* Left: engagement=[NOM|LOGO]  compact=[LOGO] */}
        <div className="team-block left" style={{ background: left.color }}>
          <img src={left.logo} alt=""/>
          {!compact && <span className="team-name">{left.name}</span>}
        </div>
        <div className="score" style={{ background: left.color }}>{state.game.blueScore}</div>
        <div className="timer">{formatTime(state.game.time, state.game.overtime)}</div>
        <div className="score" style={{ background: right.color }}>{state.game.orangeScore}</div>
        {/* Right: engagement=[LOGO|NOM]  compact=[LOGO] */}
        <div className="team-block right" style={{ background: right.color }}>
          <img src={right.logo} alt=""/>
          {!compact && <span className="team-name">{right.name}</span>}
        </div>
      </div>
      {/* Series row: compact adds abbrevs on each side */}
      <div className="series-row">
        {compact && <span className="series-abbrev">{left.shortName}</span>}
        <SeriesBar
          total={totalGames}
          leftScore={state.seriesScore.left}
          rightScore={state.seriesScore.right}
          leftColor={left.color}
          rightColor={right.color}
        />
        {compact && <span className="series-abbrev">{right.shortName}</span>}
      </div>
    </div>
  );
}

function latestEventFor(events, player) {
  return events.find(ev => ev.player === player.name || (Number.isFinite(ev.team) && ev.team === player.team && ev.player.includes(player.name)));
}

// ── WYSIWYG drag + scale (layout mode) ───────────────────────────────────────
const DRAG_STYLE = { cursor: 'move', outline: '2px dashed rgba(255,255,255,.45)', outlineOffset: '3px', userSelect: 'none' };
const ZERO_POS = { x: 0, y: 0, scale: 1 };

// dropRef: optional React.MutableRefObject<(key, pos) => void>
// If provided, called on drop instead of window.previewBridge directly (enables symmetry)
function useDrag(key, initialPos, layoutMode, dropRef) {
  const full = { ...ZERO_POS, ...initialPos };
  const [pos, setPos] = useState(full);
  const s = useRef({ active: false, startMx: 0, startMy: 0, startPx: 0, startPy: 0, pos: full });

  // Sync when config updates position externally (after drag drop or ConfigUpdated)
  useEffect(() => {
    const p = { ...ZERO_POS, ...initialPos };
    setPos(p); s.current.pos = p;
  }, [initialPos?.x, initialPos?.y, initialPos?.scale]);

  useEffect(() => {
    if (!layoutMode) return;
    const onMove = e => {
      if (!s.current.active) return;
      const p = { ...s.current.pos, x: s.current.startPx + e.clientX - s.current.startMx, y: s.current.startPy + e.clientY - s.current.startMy };
      s.current.pos = p; setPos(p);
    };
    const onUp = () => {
      if (!s.current.active) return;
      s.current.active = false;
      if (dropRef?.current) dropRef.current(key, s.current.pos);
      else window.previewBridge?.sendPositionUpdate({ [key]: s.current.pos });
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [layoutMode, key]);

  const onMouseDown = layoutMode ? e => {
    e.preventDefault(); e.stopPropagation();
    s.current = { ...s.current, active: true, startMx: e.clientX, startMy: e.clientY, startPx: s.current.pos.x, startPy: s.current.pos.y };
  } : undefined;

  const adjustScale = delta => {
    const next = { ...s.current.pos, scale: Math.max(0.2, Math.min(3, (s.current.pos.scale || 1) + delta)) };
    s.current.pos = next; setPos(next);
    if (dropRef?.current) dropRef.current(key, next);
    else window.previewBridge?.sendPositionUpdate({ [key]: next });
  };

  return { onMouseDown, pos, adjustScale };
}

// Small +/- scale HUD shown on each element in layout mode
function ScaleHud({ pos, adjustScale }) {
  return (
    <div className="scale-hud" onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}>
      <button onClick={e => { e.stopPropagation(); adjustScale(-0.05); }}>−</button>
      <span>{Math.round((pos.scale || 1) * 100)}%</span>
      <button onClick={e => { e.stopPropagation(); adjustScale(+0.05); }}>+</button>
    </div>
  );
}

function BoostColumn({ side, players, events, teamColor, layoutMode, pos, dropRef }) {
  const dragKey = side === 0 ? 'boostLeft' : 'boostRight';
  const { onMouseDown, pos: dp, adjustScale } = useDrag(dragKey, pos, layoutMode, dropRef);
  const sc = dp.scale || 1;
  const barBg = side === 0
    ? `linear-gradient(to right, ${teamColor}80, ${teamColor})`
    : `linear-gradient(to left, ${teamColor}80, ${teamColor})`;
  return <div className={`boost-column ${side === 0 ? 'left' : 'right'}`}
    style={{ transform: `translate(${dp.x}px, ${dp.y}px) scale(${sc})`, ...(layoutMode ? DRAG_STYLE : {}) }}
    onMouseDown={onMouseDown}>
    {layoutMode && <ScaleHud pos={dp} adjustScale={adjustScale}/>}
    {players.filter(p => p.team === side).map(p => {
      const ev = latestEventFor(events, p);
      return <div className="boost-line" key={p.id}>
        <span className="name">{p.name}</span>
        <span className="value">{p.boost}</span>
        {ev && <span className={`event-chip ${ev.type.toLowerCase().replace(/\s/g, '-')}`}>{ev.type}</span>}
        <div className="mini-bar"><i style={{width:`${p.boost}%`, background: barBg}} /></div>
      </div>;
    })}
  </div>;
}

function PlayerCard({ config, player, layoutMode, pos }) {
  const { onMouseDown, pos: dp, adjustScale } = useDrag('playerCard', pos, layoutMode);
  if (!player) return null;
  const sc = dp.scale || 1;
  const team = player.team === 0 ? config.teams.left : config.teams.right;
  return <div className="player-card"
    style={{'--team': team.color, transform: `translate(${dp.x}px, ${dp.y}px) scale(${sc})`, ...(layoutMode ? DRAG_STYLE : {})}}
    onMouseDown={onMouseDown}>
    {layoutMode && <ScaleHud pos={dp} adjustScale={adjustScale}/>}
    <div className="camera-box">POV</div>
    <div className="player-main"><div className="player-name">{player.name}</div><div className="boost-bar"><i style={{width:`${player.boost}%`}} /></div></div>
    <Stat label="SCORE" value={player.score}/><Stat label="GOALS" value={player.goals}/><Stat label="SHOTS" value={player.shots}/><Stat label="ASSISTS" value={player.assists}/><Stat label="SAVES" value={player.saves}/><Stat label="DEMOS" value={player.demos}/>
  </div>;
}
function Stat({ label, value }) { return <div className="stat"><b>{value}</b><span>{label}</span></div>; }

function BoostRing({ player, teamColor, layoutMode, pos }) {
  const { onMouseDown, pos: dp, adjustScale } = useDrag('boostRing', pos, layoutMode);
  if (!player) return null;
  const sc = dp.scale || 1;
  const pct = Math.max(0, Math.min(100, player.boost));
  return <div className="boost-ring"
    style={{'--deg': `${pct * 2.7}deg`, '--pct': pct, '--ring-color': teamColor, transform: `translate(${dp.x}px, ${dp.y}px) scale(${sc})`, ...(layoutMode ? DRAG_STYLE : {})}}
    onMouseDown={onMouseDown}>
    {layoutMode && <ScaleHud pos={dp} adjustScale={adjustScale}/>}
    <div><b>{pct}</b></div>
  </div>;
}

// ── Countdown 3-2-1 ───────────────────────────────────────────────────────────
function CountdownOverlay({ num }) {
  if (!num || num <= 0) return null;
  return (
    <div className="countdown-overlay">
      <div className="countdown-num" key={num}>{num}</div>
    </div>
  );
}

// ── Replay bar (RLCS style) ───────────────────────────────────────────────────
function ReplayGoalBar({ lastGoal, config }) {
  const teamColor = lastGoal
    ? (lastGoal.team === 0 ? config.teams.left.color : config.teams.right.color)
    : '#ff6b35';
  const speed = lastGoal?.speed;
  return (
    <div className="replay-goal-bar" style={{ '--replay-color': teamColor }}>
      {/* REPLAY labels on both sides */}
      <span className="replay-side left">REPLAY</span>
      <div className="replay-inner">
        {/* Speed — left */}
        {speed > 0
          ? <div className="replay-speed"><b>{Math.round(speed)}</b><span>KMH</span></div>
          : <div style={{ minWidth: 88 }}/>
        }
        {/* Scorer — center */}
        <div className="replay-center">
          {lastGoal && <>
            <span className="replay-scorer-name">{lastGoal.scorer}</span>
            <span className="replay-event-type">GOAL</span>
          </>}
        </div>
        {/* Assister — right */}
        {lastGoal?.assister
          ? <div className="replay-assister-section">
              <span className="replay-assister-name">{lastGoal.assister}</span>
              <span className="replay-assist-label">ASSIST</span>
            </div>
          : <div style={{ minWidth: 88 }}/>
        }
      </div>
      <span className="replay-side right">REPLAY</span>
    </div>
  );
}

function findTargetPlayer(state) {
  if (!state.target?.hasTarget) return null;
  return state.players.find(p =>
    (state.target.name && p.name === state.target.name) ||
    (Number.isFinite(state.target.shortcut) && p.shortcut === state.target.shortcut && (state.target.team === null || p.team === state.target.team))
  ) || null;
}

function mergeTournament(base, over) {
  if (!over) return base;
  return {
    ...base, ...over,
    waitingScreen: { ...base.waitingScreen, ...(over.waitingScreen || {}) },
    teams: over.teams ?? base.teams,
    pools: over.pools ?? base.pools,
    bracket: over.bracket ? { ...base.bracket, ...over.bracket } : base.bracket,
    schedule: over.schedule ?? base.schedule,
    nextMatch: { ...base.nextMatch, ...(over.nextMatch || {}) },
  };
}

function mergeConfig(base, override) {
  if (!override) return base;
  return {
    ...base, ...override,
    connection: { ...base.connection, ...(override.connection || {}) },
    match: { ...base.match, ...(override.match || {}) },
    teams: { ...base.teams, ...(override.teams || {}) },
    ui: { ...base.ui, ...(override.ui || {}) },
    positions: { ...(base.positions || {}), ...(override.positions || {}) },
    tournament: mergeTournament(defaultTournament, override.tournament),
  };
}

// ── Stats / Data view (/data) ─────────────────────────────────────────────────
const STAT_KEYS = [
  { key: 'score',   label: 'SCORE'   },
  { key: 'goals',   label: 'GOALS'   },
  { key: 'assists', label: 'ASSISTS' },
  { key: 'shots',   label: 'SHOTS'   },
  { key: 'saves',   label: 'SAVES'   },
  { key: 'demos',   label: 'DEMOS'   },
];

function CmpBar({ left, right, leftColor, rightColor }) {
  const max = Math.max(left, right, 1);
  return (
    <div className="cmp-bar">
      <div className="cmp-half cmp-left">
        <div className="cmp-fill" style={{ width: `${(left / max) * 100}%`, background: leftColor }}/>
      </div>
      <div className="cmp-sep"/>
      <div className="cmp-half cmp-right">
        <div className="cmp-fill" style={{ width: `${(right / max) * 100}%`, background: rightColor }}/>
      </div>
    </div>
  );
}

function StatsPlayerName({ p, side, mvpId, teamColor }) {
  const isMvp = p && mvpId && p.id === mvpId;
  return (
    <div className={`stats-cell stats-name ${side}`} style={isMvp ? { color: teamColor } : {}}>
      {isMvp && <span className="mvp-star">★</span>}
      <span>{p ? p.name : ''}</span>
    </div>
  );
}

function StatsStatValue({ p, statKey, mvpId, teamColor }) {
  const isMvp = p && mvpId && p.id === mvpId;
  return (
    <div className="stats-cell stats-value" style={isMvp ? { color: teamColor } : {}}>
      {p != null ? p[statKey] : ''}
    </div>
  );
}

function StatsView({ config, state }) {
  const left  = config.teams.left;
  const right = config.teams.right;
  const size  = num(config.ui?.teamSize, 3);

  const blue   = [...state.players.filter(p => p.team === 0).slice(0, size)];
  const orange = [...state.players.filter(p => p.team === 1).slice(0, size)];
  while (blue.length   < size) blue.push(null);
  while (orange.length < size) orange.push(null);

  const allReal = state.players.filter(p => p.team === 0 || p.team === 1);
  const mvp = allReal.length ? allReal.reduce((a, b) => b.score > a.score ? b : a) : null;
  const mvpId = mvp?.id ?? null;

  const totalGames = config.match.seriesType === 'BO7' ? 7 : config.match.seriesType === 'BO3' ? 3 : 5;

  const teamTotal = (arr, key) => arr.reduce((s, p) => s + (p ? p[key] : 0), 0);

  return (
    <div className="stats-view">
      {/* ── Top scoreboard ── */}
      <div className="stats-header-bar">
        <div className="stats-hb-team left">
          <img src={left.logo} alt="" className="stats-hb-logo"/>
          <span className="stats-hb-name" style={{ color: left.color }}>{left.name}</span>
        </div>
        <div className="stats-hb-score" style={{ background: left.color }}>{state.game.blueScore}</div>
        <div className="stats-hb-center">
          {/* Series progression: wins left | dots | wins right */}
          <div className="stats-series-scores">
            <span className="stats-series-num" style={{ color: left.color }}>{state.seriesScore.left}</span>
            <SeriesBar
              total={totalGames}
              leftScore={state.seriesScore.left}
              rightScore={state.seriesScore.right}
              leftColor={left.color}
              rightColor={right.color}
              mini
            />
            <span className="stats-series-num" style={{ color: right.color }}>{state.seriesScore.right}</span>
          </div>
          <span className="stats-hb-bo">{config.match.seriesType}</span>
        </div>
        <div className="stats-hb-score" style={{ background: right.color }}>{state.game.orangeScore}</div>
        <div className="stats-hb-team right">
          <span className="stats-hb-name" style={{ color: right.color }}>{right.name}</span>
          <img src={right.logo} alt="" className="stats-hb-logo"/>
        </div>
      </div>

      {/* ── Stats table: 7 columns = 3 blue | center | 3 orange ── */}
      <div className="stats-table" style={{ '--left-color': left.color, '--right-color': right.color }}>
        {/* Player names row — colored underlines via .stats-name.blue / .stats-name.orange */}
        <div className="stats-row stats-names-row">
          {blue.map((p, i)   => <StatsPlayerName key={i} p={p} side="blue"   mvpId={mvpId} teamColor={left.color}/>)}
          <div className="stats-cell stats-center-cell"/>
          {orange.map((p, i) => <StatsPlayerName key={i} p={p} side="orange" mvpId={mvpId} teamColor={right.color}/>)}
        </div>

        {/* One row per stat */}
        {STAT_KEYS.map(({ key, label }) => {
          const bTotal = teamTotal(blue, key);
          const oTotal = teamTotal(orange, key);
          return (
            <div key={key} className="stats-row stats-data-row">
              {blue.map((p, i)   => <StatsStatValue key={i} p={p} statKey={key} mvpId={mvpId} teamColor={left.color}/>)}
              <div className="stats-cell stats-center-cell">
                {/* Totaux équipe de chaque côté + label + barre comparaison */}
                <div className="stats-totals-row">
                  <span className="stats-team-total" style={{ color: left.color }}>{bTotal}</span>
                  <span className="stats-stat-label">{label}</span>
                  <span className="stats-team-total" style={{ color: right.color }}>{oTotal}</span>
                </div>
                <CmpBar left={bTotal} right={oTotal} leftColor={left.color} rightColor={right.color}/>
              </div>
              {orange.map((p, i) => <StatsStatValue key={i} p={p} statKey={key} mvpId={mvpId} teamColor={right.color}/>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Waiting screen (/start) ───────────────────────────────────────────────────

function WsMatchTeamRow({ teamId, score, winnerId, getTeam }) {
  const team = getTeam(teamId);
  const isWinner = winnerId && winnerId === teamId;
  const isLoser  = winnerId && winnerId !== teamId;
  return (
    <div className={`ws-match-team${isWinner ? ' winner' : ''}${isLoser ? ' loser' : ''}`}
         style={team ? { borderLeftColor: team.color } : {}}>
      {team
        ? <img src={team.logo} alt="" className="ws-match-logo"/>
        : <div className="ws-match-logo-ph"/>
      }
      <span className="ws-match-name">{team ? (team.shortName || team.name) : 'TBD'}</span>
      <span className="ws-match-score">{team ? (score ?? 0) : '-'}</span>
    </div>
  );
}

function WsMatch({ match, getTeam, grand }) {
  return (
    <div className={`ws-match${grand ? ' grand' : ''}`}>
      <WsMatchTeamRow teamId={match.team1Id} score={match.score1} winnerId={match.winnerId} getTeam={getTeam}/>
      <WsMatchTeamRow teamId={match.team2Id} score={match.score2} winnerId={match.winnerId} getTeam={getTeam}/>
    </div>
  );
}

function WsRound({ round, getTeam }) {
  return (
    <div className="ws-round">
      <div className="ws-round-name">{round.name}</div>
      <div className="ws-round-matches">
        {(round.matches || []).map(m => <WsMatch key={m.id} match={m} getTeam={getTeam}/>)}
      </div>
    </div>
  );
}

function WsBracketView({ config }) {
  const t = config.tournament || {};
  const teams = t.teams || [];
  const getTeam = id => teams.find(x => x.id === id);
  const rounds = t.bracket?.rounds || [];
  const upper = rounds.filter(r => r.type === 'upper');
  const lower = rounds.filter(r => r.type === 'lower');
  const grand = rounds.filter(r => r.type === 'grand');
  const pools = t.pools || [];

  if (!rounds.length && !pools.length) {
    return <div className="ws-empty">Configure le bracket dans le panneau Tournoi</div>;
  }

  return (
    <div className="ws-bracket-view">
      {/* Pools : standings + résultats de matchs côte à côte */}
      {pools.length > 0 && (
        <div className="ws-pools-row">
          {pools.map(pool => {
            const standings = (pool.teamIds || []).map(id => {
              const team = getTeam(id);
              const w = (pool.matches||[]).filter(m => m.played && m.winnerId === id).length;
              const l = (pool.matches||[]).filter(m => m.played && (m.team1Id===id||m.team2Id===id) && m.winnerId!==id).length;
              return { team, w, l };
            }).sort((a,b) => b.w - a.w || a.l - b.l);
            const played = (pool.matches||[]).filter(m => m.played);
            return (
              <div key={pool.id} className="ws-pool-card">
                {/* Standings */}
                <div className="ws-pool-left">
                  <div className="ws-pool-title">{pool.name}</div>
                  {standings.map(({ team, w, l }, i) => team && (
                    <div key={team.id} className="ws-pool-row">
                      <span style={{ fontSize:11, color:'rgba(255,255,255,.3)', minWidth:14, textAlign:'right' }}>{i+1}</span>
                      {team.logo && <img src={team.logo} alt="" className="ws-pool-logo"/>}
                      <span className="ws-pool-tname">{team.name}</span>
                      <span className="ws-pool-record" style={{ color: team.color }}>{w}W {l}L</span>
                    </div>
                  ))}
                </div>
                {/* Match results */}
                {played.length > 0 && (
                  <div className="ws-pool-right">
                    {played.map(m => {
                      const t1 = getTeam(m.team1Id);
                      const t2 = getTeam(m.team2Id);
                      const w1 = m.winnerId === m.team1Id;
                      const w2 = m.winnerId === m.team2Id;
                      return (
                        <div key={m.id} className="ws-pool-match-result">
                          <div className="ws-pm-team">
                            {t1?.logo && <img src={t1.logo} alt="" className="ws-pm-logo"/>}
                            <span className={`ws-pm-name${w1?' winner':w2?' loser':''}`}>{t1?.shortName||'?'}</span>
                          </div>
                          <div className="ws-pm-score" style={{ color: w1 ? t1?.color : w2 ? t2?.color : '#fff' }}>
                            {m.score1} – {m.score2}
                          </div>
                          <div className="ws-pm-team right">
                            <span className={`ws-pm-name${w2?' winner':w1?' loser':''}`}>{t2?.shortName||'?'}</span>
                            {t2?.logo && <img src={t2.logo} alt="" className="ws-pm-logo"/>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bracket élimination */}
      {rounds.length > 0 && (
        <div className="ws-bracket-grid">
          {upper.length > 0 && (
            <div className="ws-bracket-section">
              {upper.length > 1 && <div className="ws-bracket-section-label">UPPER BRACKET</div>}
              <div className="ws-rounds-row">
                {upper.map(r => <WsRound key={r.id} round={r} getTeam={getTeam}/>)}
                {grand.map(r => <WsRound key={r.id} round={r} getTeam={getTeam}/>)}
              </div>
            </div>
          )}
          {lower.length > 0 && (
            <div className="ws-bracket-section lower">
              <div className="ws-bracket-section-label">LOWER BRACKET</div>
              <div className="ws-rounds-row">
                {lower.map(r => <WsRound key={r.id} round={r} getTeam={getTeam}/>)}
              </div>
            </div>
          )}
          {!upper.length && grand.map(r => (
            <div key={r.id} className="ws-bracket-section">
              <div className="ws-rounds-row"><WsRound round={r} getTeam={getTeam}/></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WsPlayerCard({ player, teamColor }) {
  return (
    <div className="ws-player-card">
      <div className="ws-player-photo-wrap" style={{ borderBottom: `3px solid ${teamColor}` }}>
        {player.photo
          ? <img src={player.photo} alt={player.name} className="ws-player-photo"/>
          : <div className="ws-player-ph" style={{ background: `${teamColor}22` }}>
              <span style={{ fontSize:52, fontWeight:1000, fontStyle:'italic', opacity:.6 }}>{player.name[0]}</span>
            </div>
        }
        {player.country && <img src={`https://flagcdn.com/w40/${player.country}.png`} alt={player.country} className="ws-player-flag"/>}
      </div>
      <div className="ws-player-name">{player.name}</div>
    </div>
  );
}

function WsNextMatchView({ config }) {
  const t = config.tournament || {};
  const teams = t.teams || [];
  const nm = t.nextMatch || {};
  const team1 = teams.find(x => x.id === nm.team1Id);
  const team2 = teams.find(x => x.id === nm.team2Id);

  if (!team1 || !team2) return <div className="ws-empty">Configure le prochain match dans le panneau Tournoi</div>;

  // Séparer joueurs et coach
  const p1      = (team1.players || []).filter(p => !p.role || p.role === 'player' || p.role === 'sub').slice(0, 3);
  const p2      = (team2.players || []).filter(p => !p.role || p.role === 'player' || p.role === 'sub').slice(0, 3);
  const coach1  = (team1.players || []).find(p => p.role === 'coach');
  const coach2  = (team2.players || []).find(p => p.role === 'coach');
  // Guard : si les deux équipes ont la même couleur, forcer une couleur distincte pour la droite
  const c1 = team1.color || '#2257ff';
  const c2 = (team2.color && team2.color.toLowerCase() !== c1.toLowerCase())
    ? team2.color
    : (config.teams?.right?.color || '#ff335f');

  return (
    <div className="ws-next-match">
      {nm.label    && <div className="ws-next-label">{nm.label}</div>}
      {nm.sublabel && <div className="ws-next-sublabel">{nm.sublabel}</div>}
      <div className="ws-next-body">

        {/* Équipe gauche */}
        <div className="ws-next-side" style={{ background: `linear-gradient(to bottom, ${c1}30 0%, ${c1}08 100%)` }}>
          <div className="ws-next-players">
            {p1.map((p,i) => <WsPlayerCard key={i} player={p} teamColor={c1}/>)}
          </div>
          <div className="ws-coach-bar">
            <span className="ws-coach-badge">COACH</span>
            {coach1
              ? <><span className="ws-coach-name">{coach1.name}</span>
                  {coach1.country && <img src={`https://flagcdn.com/w40/${coach1.country}.png`} alt={coach1.country} className="ws-coach-flag"/>}
                </>
              : <span className="ws-coach-name" style={{ opacity:.25 }}>—</span>
            }
          </div>
          <div className="ws-next-team-bar" style={{ background: c1 }}>
            <span className="ws-next-team-name">{team1.name}</span>
            {team1.logo && <img src={team1.logo} alt="" className="ws-next-team-logo"/>}
          </div>
        </div>

        {/* VERSUS strip */}
        <div className="ws-vs">
          <div className="ws-vs-bar left"  style={{ background: c1 }}/>
          <span>VERSUS</span>
          <div className="ws-vs-bar right" style={{ background: c2 }}/>
        </div>

        {/* Équipe droite */}
        <div className="ws-next-side" style={{ background: `linear-gradient(to bottom, ${c2}30 0%, ${c2}08 100%)` }}>
          <div className="ws-next-players">
            {p2.map((p,i) => <WsPlayerCard key={i} player={p} teamColor={c2}/>)}
          </div>
          <div className="ws-coach-bar" style={{ flexDirection:'row-reverse' }}>
            <span className="ws-coach-badge">COACH</span>
            {coach2
              ? <><span className="ws-coach-name">{coach2.name}</span>
                  {coach2.country && <img src={`https://flagcdn.com/w40/${coach2.country}.png`} alt={coach2.country} className="ws-coach-flag"/>}
                </>
              : <span className="ws-coach-name" style={{ opacity:.25 }}>—</span>
            }
          </div>
          <div className="ws-next-team-bar" style={{ background: c2, flexDirection:'row-reverse' }}>
            <span className="ws-next-team-name">{team2.name}</span>
            {team2.logo && <img src={team2.logo} alt="" className="ws-next-team-logo"/>}
          </div>
        </div>

      </div>
    </div>
  );
}

function WsScheduleView({ config }) {
  const t = config.tournament || {};
  const teams = t.teams || [];
  const schedule = t.schedule || [];
  const getTeam = id => teams.find(x => x.id === id);

  if (!schedule.length) return <div className="ws-empty">Configure le programme dans le panneau Tournoi</div>;

  return (
    <div className="ws-schedule">
      {schedule.map((entry, i) => {
        const t1 = getTeam(entry.team1Id);
        const t2 = getTeam(entry.team2Id);
        return (
          <div key={entry.id || i} className="ws-sched-row">
            <div className="ws-sched-team left">
              {t1 && <img src={t1.logo} alt="" className="ws-sched-logo"/>}
              <span className="ws-sched-name">{t1?.name || 'TBD'}</span>
            </div>
            <div className="ws-sched-time">{entry.time}</div>
            <div className="ws-sched-team right">
              <span className="ws-sched-name">{t2?.name || 'TBD'}</span>
              {t2 && <img src={t2.logo} alt="" className="ws-sched-logo"/>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function WaitingScreen({ config }) {
  const t = config.tournament || {};
  const ws = t.waitingScreen || {};
  const activeViews = (ws.views || ['bracket', 'nextMatch', 'schedule']).filter(Boolean);
  const [viewIdx, setViewIdx] = useState(0);
  const [countdown, setCountdown] = useState(null);

  useEffect(() => {
    if (activeViews.length <= 1) return;
    const sec = Math.max(5, num(ws.rotationSec, 15)) * 1000;
    const id = setInterval(() => setViewIdx(i => (i + 1) % activeViews.length), sec);
    return () => clearInterval(id);
  }, [activeViews.join(','), ws.rotationSec]);

  useEffect(() => {
    if (!ws.countdownTarget) { setCountdown(null); return; }
    const tick = () => {
      const diff = new Date(ws.countdownTarget) - Date.now();
      if (diff <= 0) { setCountdown('00:00'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`);
    };
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [ws.countdownTarget]);

  const currentView = activeViews[viewIdx % Math.max(1, activeViews.length)];
  const teams = t.teams || [];
  const nm = t.nextMatch || {};
  const nmT1 = teams.find(x => x.id === nm.team1Id);
  const nmT2 = teams.find(x => x.id === nm.team2Id);

  return (
    <div className="waiting-screen">
      {/* Top bar */}
      <div className="ws-topbar">
        <div className="ws-topbar-left">
          <span className="ws-phase-label">{t.phaseLabel || ''}</span>
          {t.dayLabel && <span className="ws-day-label">{t.dayLabel}</span>}
        </div>
        <div className="ws-event-name">{t.eventName || ''}</div>
      </div>

      {/* Body */}
      <div className="ws-body">
        {/* Main rotating content */}
        <div className="ws-main">
          {currentView === 'bracket'   && <WsBracketView   config={config}/>}
          {currentView === 'nextMatch' && <WsNextMatchView config={config}/>}
          {currentView === 'schedule'  && <WsScheduleView  config={config}/>}
        </div>

        {/* Right sidebar */}
        <div className="ws-sidebar">
          {countdown !== null && (
            <div className="ws-countdown-block">
              <div className="ws-countdown">{countdown}</div>
              <div className="ws-countdown-label">DÉBUT DU SHOW</div>
            </div>
          )}
          {nmT1 && nmT2 && (
            <div className="ws-sidebar-match">
              <div className="ws-sidebar-match-title">{ws.sidebarTitle || 'PROCHAIN MATCH'}</div>
              <div className="ws-sidebar-logos">
                <img src={nmT1.logo} alt="" className="ws-sidebar-logo"/>
                <span className="ws-sidebar-vs">VS</span>
                <img src={nmT2.logo} alt="" className="ws-sidebar-logo"/>
              </div>
              <div className="ws-sidebar-names">
                <span style={{ color: nmT1.color }}>{nmT1.shortName || nmT1.name}</span>
                <span style={{ color: nmT2.color }}>{nmT2.shortName || nmT2.name}</span>
              </div>
            </div>
          )}
          {/* View indicator dots */}
          {activeViews.length > 1 && (
            <div className="ws-view-dots">
              {activeViews.map((v,i) => (
                <span key={v} className={`ws-dot${i === viewIdx % activeViews.length ? ' active' : ''}`}/>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Replay highlight view (/replay) ──────────────────────────────────────────

function ReplayView() {
  const [playlist, setPlaylist] = useState({ clips: [] });
  const [current,  setCurrent]  = useState(0);
  const [playing,  setPlaying]  = useState(false);   // ne démarre PAS au chargement
  const videoRef = useRef(null);
  const inOBS = typeof window.obsstudio !== 'undefined';

  // Poll playlist.json every 3s (charge sans jouer)
  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/replays/playlist.json?t=' + Date.now());
        if (r.ok) setPlaylist(await r.json());
      } catch {}
    };
    load();
    const id = setInterval(load, 3000);
    return () => clearInterval(id);
  }, []);

  // OBS visibility : deux cas à gérer
  //
  // Cas A — "Shutdown source when not visible" désactivé (source toujours en mémoire)
  //   OBS envoie obsSourceVisibleChanged{visible:true/false} à chaque switch de scène.
  //   On l'écoute normalement.
  //
  // Cas B — "Shutdown source when not visible" activé (source déchargée entre scènes)
  //   OBS recrée le browser de zéro quand la scène devient active. Il n'y a pas de
  //   "changement" de visibilité depuis la source : elle passe de "inexistante" à
  //   "visible". OBS ne dispatche PAS obsSourceVisibleChanged dans ce cas.
  //   → Fallback : si on est dans OBS et qu'aucun event n'arrive dans les 800ms,
  //     la source vient d'être créée pour une scène active → on démarre.
  useEffect(() => {
    let fallbackTimer = null;

    const onVisible = (e) => {
      // Un event est arrivé → on est dans le cas A (source persistante)
      clearTimeout(fallbackTimer);
      fallbackTimer = null;
      if (e.detail?.visible) {
        setCurrent(0);
        setPlaying(true);
      } else {
        setPlaying(false);
        setCurrent(0);
        if (videoRef.current) {
          videoRef.current.pause();
          videoRef.current.currentTime = 0;
        }
      }
    };
    window.addEventListener('obsSourceVisibleChanged', onVisible);

    // Fallback cas B : si dans OBS et aucun event visible dans 800ms → démarrer
    if (inOBS) {
      fallbackTimer = setTimeout(() => {
        setCurrent(0);
        setPlaying(true);
      }, 800);
    }

    return () => {
      window.removeEventListener('obsSourceVisibleChanged', onVisible);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const clips = playlist.clips || [];

  // Joue/pause selon l'état playing + changement de clip
  useEffect(() => {
    if (!videoRef.current || clips.length === 0) return;
    if (playing) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [current, playing, clips.length]);

  const handleEnded = () => {
    if (!playing) return;
    setCurrent(c => (c + 1) % Math.max(clips.length, 1));
  };

  const handleVideoError = () => {
    console.warn('[replay] erreur vidéo — codec non supporté ou fichier corrompu, clip suivant');
    if (playing) setCurrent(c => (c + 1) % Math.max(clips.length, 1));
  };

  const startPlayback = () => { setCurrent(0); setPlaying(true); };

  if (clips.length === 0) {
    return (
      <div className="replay-empty">
        <div className="replay-empty-icon">🎬</div>
        <div className="replay-empty-title">En attente des clips…</div>
        <div className="replay-empty-sub">Les replays de but apparaîtront ici automatiquement</div>
      </div>
    );
  }

  const clip = clips[Math.min(current, clips.length - 1)];
  const teamLabel = clip.team === 0 ? 'ÉQUIPE BLEUE' : clip.team === 1 ? 'ÉQUIPE ORANGE' : '';

  return (
    <div className="replay-view">
      <video
        ref={videoRef}
        className="replay-video"
        playsInline
        onEnded={handleEnded}
        onError={handleVideoError}
      >
        <source src={clip.clipSrc}/>
      </video>

      {/* Écran d'attente — visible quand non actif (hors OBS, pour les tests) */}
      {!playing && !inOBS && (
        <div className="replay-standby" onClick={startPlayback}>
          <div className="replay-standby-icon">▶</div>
          <div className="replay-standby-label">{clips.length} clip{clips.length !== 1 ? 's' : ''} prêt{clips.length !== 1 ? 's' : ''} — cliquer pour lancer</div>
        </div>
      )}

      {/* Goal info badge — bottom left */}
      {playing && (
        <div className="replay-badge">
          <span className="replay-badge-num">BUT #{clip.n}</span>
          <span className="replay-badge-scorer">{clip.scorer}</span>
          {teamLabel && <span className="replay-badge-team">{teamLabel}</span>}
        </div>
      )}

      {/* Navigation dots — bottom center */}
      {playing && clips.length > 1 && (
        <div className="replay-dots">
          {clips.map((_, i) => (
            <button
              key={i}
              className={`replay-dot${i === current ? ' active' : ''}`}
              onClick={() => setCurrent(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const [config, setConfig] = useState(defaultConfig);
  const [layoutMode, setLayoutMode] = useState(false);
  const [symmetricBoost, setSymmetricBoost] = useState(false);
  const [countdownNum, setCountdownNum] = useState(null);
  const [compactScoreboard, setCompactScoreboard] = useState(false);
  const compactTimer = useRef(null);

  useEffect(() => {
    loadConfig()
      .then(c => setConfig(mergeConfig(defaultConfig, c)))
      .catch(() => {});

    const onUpdate = (e) => setConfig(prev => mergeConfig(prev, e.detail));
    window.addEventListener('rl-config-updated', onUpdate);
    const onLayout = (e) => setLayoutMode(e.detail.active);
    window.addEventListener('rl-layout-mode', onLayout);
    return () => {
      window.removeEventListener('rl-config-updated', onUpdate);
      window.removeEventListener('rl-layout-mode', onLayout);
    };
  }, []);

  const state = useOverlayData(config);
  const targetPlayer = useMemo(() => findTargetPlayer(state), [state.players, state.target]);

  // 3-2-1 countdown timer
  useEffect(() => {
    if (!state.countdownAt) { setCountdownNum(null); return; }
    const compute = () => {
      const n = 3 - Math.floor((Date.now() - state.countdownAt) / 1000);
      setCountdownNum(n > 0 ? n : null);
    };
    compute();
    const id = setInterval(compute, 80);
    return () => clearInterval(id);
  }, [state.countdownAt]);

  // Scoreboard compact/full switching
  // Full during engagement (replay + countdown + 2.5s post-kickoff grace)
  // Compact during normal play
  useEffect(() => {
    const engaged = state.game.replay || (countdownNum !== null && countdownNum > 0);
    if (engaged) {
      // Cancel any pending compact transition
      if (compactTimer.current) { clearTimeout(compactTimer.current); compactTimer.current = null; }
      setCompactScoreboard(false);
    } else if (!compactTimer.current) {
      // Schedule compact mode 2.5s after engagement ends (post-kickoff grace period)
      compactTimer.current = setTimeout(() => {
        setCompactScoreboard(true);
        compactTimer.current = null;
      }, 2500);
    }
  }, [state.game.replay, countdownNum]);

  // Drop handler with optional boost symmetry
  const dropRef = useRef(null);
  dropRef.current = (key, posData) => {
    const updates = { [key]: posData };
    if (symmetricBoost) {
      if (key === 'boostLeft')  updates.boostRight = { ...posData, x: -posData.x };
      if (key === 'boostRight') updates.boostLeft  = { ...posData, x: -posData.x };
    }
    window.previewBridge?.sendPositionUpdate(updates);
  };

  const pos = config.positions || {};

  // ── Route: /start → waiting screen ──────────────────────────────────────────
  if (window.location.pathname === '/start') {
    return <WaitingScreen config={config}/>;
  }

  // ── Route: /data → stats table ───────────────────────────────────────────────
  if (window.location.pathname === '/data') {
    return <StatsView config={config} state={state}/>;
  }

  // ── Route: /replay → highlight reel ─────────────────────────────────────────
  if (window.location.pathname === '/replay') {
    return <ReplayView/>;
  }

  return <main className="overlay">
    <TopScoreboard config={config} state={state} layoutMode={layoutMode} pos={pos.scoreboard} compact={compactScoreboard}/>
    {config.ui.showSideBoosts && <>
      <BoostColumn side={0} players={state.players} events={config.ui.showEvents ? state.events : []} teamColor={config.teams.left.color} layoutMode={layoutMode} pos={pos.boostLeft} dropRef={dropRef}/>
      <BoostColumn side={1} players={state.players} events={config.ui.showEvents ? state.events : []} teamColor={config.teams.right.color} layoutMode={layoutMode} pos={pos.boostRight} dropRef={dropRef}/>
    </>}
    {config.ui.showPlayerCard && targetPlayer && <PlayerCard config={config} player={targetPlayer} layoutMode={layoutMode} pos={pos.playerCard}/>}
    {config.ui.showBoostRing && targetPlayer && <BoostRing player={targetPlayer} teamColor={targetPlayer.team === 0 ? config.teams.left.color : config.teams.right.color} layoutMode={layoutMode} pos={pos.boostRing}/>}

    {/* Replay bar — shown during any replay, scorer info appears when lastGoal is set */}
    {state.game.replay && <ReplayGoalBar lastGoal={state.lastGoal} config={config}/>}

    {/* 3-2-1 countdown */}
    <CountdownOverlay num={countdownNum}/>

    {/* Layout mode indicator */}
    {layoutMode && (
      <div className="layout-indicator">
        <span>✦ MODE LAYOUT</span>
        <button
          className={`sym-toggle${symmetricBoost ? ' active' : ''}`}
          onMouseDown={e => e.stopPropagation()}
          onClick={() => setSymmetricBoost(s => !s)}
        >
          🔗 Symétrie boost
        </button>
      </div>
    )}

    {config.match.showConnectionStatus && (
      <div className={`connection ${state.connected && (config.connection.mockMode || state.rlConnected) ? 'ok' : 'bad'}`}>
        {config.connection.mockMode ? 'MOCK' : state.connected ? state.rlConnected ? 'LIVE TCP' : 'RELAY OK / RL WAIT' : 'DISCONNECTED'}
      </div>
    )}
  </main>;
}

createRoot(document.getElementById('root')).render(<App/>);
