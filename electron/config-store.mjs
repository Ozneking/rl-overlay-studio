/**
 * Config store — stockage JSON simple via fs (pas de dépendance externe).
 * Écrit dans : <userData>/rl-overlay-config.json
 * Et dans     : public/config/overlay-config.json (pour OBS fallback)
 */
import { app } from 'electron';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DEFAULT_CONFIG = {
  connection: {
    mockMode: false,
    websocketUrl: 'ws://127.0.0.1:49124',
    reconnectMs: 2000,
  },
  match: {
    eventTitle: 'EVENT TITLE',
    seriesType: 'BO7',
    seriesScore: { left: 0, right: 0 },
    showConnectionStatus: true,
    autoIncrementSeries: true,
  },
  teams: {
    left:  { name: 'BLUE',   shortName: 'BLU', logo: '/assets/teams/left.svg',  color: '#2257ff', side: 0 },
    right: { name: 'ORANGE', shortName: 'ORA', logo: '/assets/teams/right.svg', color: '#ff335f', side: 1 },
  },
  ui: {
    showSideBoosts: true,
    showPlayerCard: true,
    showBoostRing: true,
    showEvents: true,
    eventTtlMs: 2200,
    teamSize: 3,
    updateThrottleMs: 80,
    targetGraceMs: 900,
  },
};

let _broadcastFn = null;

function getUserDataPath() {
  return join(app.getPath('userData'), 'rl-overlay-config.json');
}

function getProfilesPath() {
  return join(app.getPath('userData'), 'rl-overlay-profiles.json');
}

const publicConfigPath = join(__dirname, '../public/config/overlay-config.json');

function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base;
  const result = { ...base };
  for (const [k, v] of Object.entries(override)) {
    result[k] = (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object')
      ? deepMerge(base[k], v)
      : v;
  }
  return result;
}

function readJson(filePath, fallback) {
  try {
    if (existsSync(filePath)) return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {}
  return fallback;
}

function writeJson(filePath, data) {
  try {
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.warn('[config-store] write failed:', filePath, e.message);
  }
}

/** Called from main.mjs to wire live config push */
export function setBroadcastFn(fn) {
  _broadcastFn = fn;
}

export function getConfig() {
  const stored = readJson(getUserDataPath(), {});
  return deepMerge(DEFAULT_CONFIG, stored);
}

export function setConfig(partial) {
  const current = getConfig();
  const next = deepMerge(current, partial);
  writeJson(getUserDataPath(), next);
  writeJson(publicConfigPath, next);
  _broadcastFn?.({ Event: 'ConfigUpdated', Data: next });
  return next;
}

export function listProfiles() {
  const profiles = readJson(getProfilesPath(), {});
  return Object.keys(profiles);
}

export function saveProfile(name) {
  const profiles = readJson(getProfilesPath(), {});
  profiles[name] = getConfig();
  writeJson(getProfilesPath(), profiles);
  return Object.keys(profiles);
}

export function loadProfile(name) {
  const profiles = readJson(getProfilesPath(), {});
  if (!profiles[name]) throw new Error(`Profile "${name}" not found`);
  return setConfig(profiles[name]);
}

export function deleteProfile(name) {
  const profiles = readJson(getProfilesPath(), {});
  delete profiles[name];
  writeJson(getProfilesPath(), profiles);
  return Object.keys(profiles);
}
