'use strict';
/**
 * Config store (CommonJS) — stockage JSON simple via fs.
 */
const { app } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_CONFIG = {
  connection: { mockMode: false, websocketUrl: 'ws://127.0.0.1:49124', reconnectMs: 2000 },
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
    showSideBoosts: true, showPlayerCard: true, showBoostRing: true, showEvents: true,
    eventTtlMs: 2200, teamSize: 3, updateThrottleMs: 80, targetGraceMs: 900,
  },
};

let _broadcastFn = null;

const publicConfigPath = path.join(__dirname, '../public/config/overlay-config.json');

function getUserDataPath() { return path.join(app.getPath('userData'), 'rl-overlay-config.json'); }
function getProfilesPath()  { return path.join(app.getPath('userData'), 'rl-overlay-profiles.json'); }

function deepMerge(base, override) {
  if (!override || typeof override !== 'object') return base;
  const result = Object.assign({}, base);
  for (const [k, v] of Object.entries(override)) {
    result[k] = (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object')
      ? deepMerge(base[k], v) : v;
  }
  return result;
}

function readJson(filePath, fallback) {
  try { if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch {}
  return fallback;
}

function writeJson(filePath, data) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) { console.warn('[config-store] write failed:', filePath, e.message); }
}

function setBroadcastFn(fn) { _broadcastFn = fn; }

function getConfig() { return deepMerge(DEFAULT_CONFIG, readJson(getUserDataPath(), {})); }

function setConfig(partial) {
  const next = deepMerge(getConfig(), partial);
  writeJson(getUserDataPath(), next);
  writeJson(publicConfigPath, next);
  if (_broadcastFn) _broadcastFn({ Event: 'ConfigUpdated', Data: next });
  return next;
}

function listProfiles()        { return Object.keys(readJson(getProfilesPath(), {})); }
function saveProfile(name)     { const p = readJson(getProfilesPath(), {}); p[name] = getConfig(); writeJson(getProfilesPath(), p); return Object.keys(p); }
function loadProfile(name)     { const p = readJson(getProfilesPath(), {}); if (!p[name]) throw new Error(`Profile "${name}" not found`); return setConfig(p[name]); }
function deleteProfile(name)   { const p = readJson(getProfilesPath(), {}); delete p[name]; writeJson(getProfilesPath(), p); return Object.keys(p); }

module.exports = { setBroadcastFn, getConfig, setConfig, listProfiles, saveProfile, loadProfile, deleteProfile };
