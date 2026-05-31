// ── Tournament types ──────────────────────────────────────────────────────────
export interface TournamentPlayer {
  name: string;
  country?: string;   // emoji flag or 2-letter code
  role?: 'player' | 'coach' | 'sub';
  photo?: string;     // URL
}

export interface TournamentTeam {
  id: string;
  name: string;
  shortName: string;
  logo: string;
  color: string;
  players: TournamentPlayer[];
}

export interface PoolMatch {
  id: string;
  team1Id: string;
  team2Id: string;
  score1: number;
  score2: number;
  played: boolean;
}

export interface Pool {
  id: string;
  name: string;
  teamIds: string[];
  matches: PoolMatch[];
}

export interface BracketMatch {
  id: string;
  team1Id?: string;
  team2Id?: string;
  score1: number;
  score2: number;
  winnerId?: string;
}

export interface BracketRound {
  id: string;
  name: string;
  type: 'upper' | 'lower' | 'grand';
  matches: BracketMatch[];
}

export interface ScheduleEntry {
  id: string;
  time: string;
  team1Id: string;
  team2Id: string;
  label?: string;
}

export interface TournamentConfig {
  eventName: string;
  phaseLabel: string;
  dayLabel: string;
  waitingScreen: {
    views: Array<'bracket' | 'nextMatch' | 'schedule'>;
    rotationSec: number;
    countdownTarget: string | null;
    sidebarTitle: string;
  };
  teams: TournamentTeam[];
  pools: Pool[];
  bracket: { format: 'single' | 'double'; rounds: BracketRound[] };
  schedule: ScheduleEntry[];
  nextMatch: { label: string; sublabel: string; team1Id: string | null; team2Id: string | null };
}

// ── Match team ────────────────────────────────────────────────────────────────
export interface TeamConfig {
  name: string;
  shortName: string;
  logo: string;
  color: string;
  side: 0 | 1;
}

export interface Position { x: number; y: number; scale?: number; }

export interface OverlayConfig {
  tournament?: TournamentConfig;
  connection: {
    mockMode: boolean;
    websocketUrl: string;
    reconnectMs: number;
  };
  match: {
    eventTitle: string;
    seriesType: 'BO3' | 'BO5' | 'BO7';
    seriesScore: { left: number; right: number };
    showConnectionStatus: boolean;
    autoIncrementSeries: boolean;
  };
  teams: {
    left: TeamConfig;
    right: TeamConfig;
  };
  ui: {
    showSideBoosts: boolean;
    showPlayerCard: boolean;
    showBoostRing: boolean;
    showEvents: boolean;
    eventTtlMs: number;
    teamSize: number;
    updateThrottleMs: number;
    targetGraceMs: number;
  };
  positions?: {
    scoreboard?: Position;
    boostLeft?:  Position;
    boostRight?: Position;
    playerCard?: Position;
    boostRing?:  Position;
  };
}

// Extend window with Electron API
declare global {
  interface Window {
    electronAPI: {
      getConfig: () => Promise<OverlayConfig>;
      setConfig: (partial: Partial<OverlayConfig>) => Promise<OverlayConfig>;
      listProfiles: () => Promise<string[]>;
      saveProfile: (name: string) => Promise<string[]>;
      loadProfile: (name: string) => Promise<OverlayConfig>;
      deleteProfile: (name: string) => Promise<string[]>;
      sendMockEvent: (type: 'goal' | 'save' | 'demo' | 'shot' | 'replay' | 'countdown' | 'kickoff') => Promise<void>;
      openOverlayWindow: () => Promise<void>;
      pickLogoFile: (side: 'left' | 'right') => Promise<string | null>;
      getRelayStatus: () => Promise<RelayStatus>;
      onRelayStatus: (cb: (data: RelayStatus) => void) => () => void;
      showPreview: (bounds: { x: number; y: number; width: number; height: number }) => Promise<void>;
      hidePreview: () => Promise<void>;
      setLayoutMode: (active: boolean) => Promise<void>;
      reloadOverlay: () => Promise<void>;
    };
  }
}

export interface RelayStatus {
  rlConnected: boolean;
  relay?: string;
  message?: string;
  error?: string;
}
