import { create } from 'zustand';
import type { OverlayConfig, TournamentConfig } from '../types';

interface ConfigStore {
  config: OverlayConfig | null;
  loading: boolean;
  saving: boolean;
  // Load initial config from Electron
  loadConfig: () => Promise<void>;
  // Patch and persist
  setMatch: (patch: Partial<OverlayConfig['match']>) => void;
  setTeam: (side: 'left' | 'right', patch: Partial<OverlayConfig['teams']['left']>) => void;
  setUI: (patch: Partial<OverlayConfig['ui']>) => void;
  setConnection: (patch: Partial<OverlayConfig['connection']>) => void;
  setTournament: (patch: Partial<TournamentConfig>) => void;
  // Profile management
  profiles: string[];
  loadProfiles: () => Promise<void>;
  saveProfile: (name: string) => Promise<void>;
  loadProfile: (name: string) => Promise<void>;
  deleteProfile: (name: string) => Promise<void>;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

function debounceSetConfig(config: OverlayConfig) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    window.electronAPI.setConfig(config).catch(console.error);
    debounceTimer = null;
  }, 150);
}

export const useConfigStore = create<ConfigStore>((set, get) => ({
  config: null,
  loading: false,
  saving: false,
  profiles: [],

  loadConfig: async () => {
    set({ loading: true });
    try {
      const config = await window.electronAPI.getConfig();
      set({ config, loading: false });
    } catch (e) {
      console.error('[config-store] loadConfig failed', e);
      set({ loading: false });
    }
  },

  setMatch: (patch) => {
    const { config } = get();
    if (!config) return;
    const next = { ...config, match: { ...config.match, ...patch } };
    set({ config: next });
    debounceSetConfig(next);
  },

  setTeam: (side, patch) => {
    const { config } = get();
    if (!config) return;
    const next = { ...config, teams: { ...config.teams, [side]: { ...config.teams[side], ...patch } } };
    set({ config: next });
    debounceSetConfig(next);
  },

  setUI: (patch) => {
    const { config } = get();
    if (!config) return;
    const next = { ...config, ui: { ...config.ui, ...patch } };
    set({ config: next });
    debounceSetConfig(next);
  },

  setConnection: (patch) => {
    const { config } = get();
    if (!config) return;
    const next = { ...config, connection: { ...config.connection, ...patch } };
    set({ config: next });
    debounceSetConfig(next);
  },

  setTournament: (patch) => {
    const { config } = get();
    if (!config) return;
    const next = { ...config, tournament: { ...(config.tournament as TournamentConfig), ...patch } };
    set({ config: next });
    debounceSetConfig(next);
  },

  loadProfiles: async () => {
    const profiles = await window.electronAPI.listProfiles();
    set({ profiles });
  },

  saveProfile: async (name) => {
    const profiles = await window.electronAPI.saveProfile(name);
    set({ profiles });
  },

  loadProfile: async (name) => {
    const loaded = await window.electronAPI.loadProfile(name);
    set({ config: loaded });
  },

  deleteProfile: async (name) => {
    const profiles = await window.electronAPI.deleteProfile(name);
    set({ profiles });
  },
}));
