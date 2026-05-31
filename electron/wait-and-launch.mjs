/**
 * Attend que les deux serveurs Vite soient prêts avant de lancer Electron.
 * Utilisé uniquement en mode dev via `npm run dev`.
 */
import { spawn }        from 'node:child_process';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname   = dirname(fileURLToPath(import.meta.url));
const require     = createRequire(import.meta.url);
// require('electron') retourne le chemin vers le binaire Electron (cross-platform)
const electronBin = require('electron');

// Supprimer ELECTRON_RUN_AS_NODE : même vide (""), la variable fait croire à
// Electron qu'il doit tourner en mode Node.js pur → app = undefined → crash.
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

async function waitFor(url, maxMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(800) });
      if (res.ok || res.status < 500) return true;
    } catch {}
    await new Promise(r => setTimeout(r, 600));
  }
  return false;
}

function launchElectron() {
  const proc = spawn(electronBin, ['.'], {
    stdio: 'inherit',
    cwd:   join(__dirname, '..'),
    env,
  });

  proc.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      // Crash → propager le code d'erreur (--kill-others-on-fail tuera les Vite)
      console.log(`[launcher] Electron exited with code ${code}`);
      process.exit(code);
    }
    // Fermeture normale (code 0) → les serveurs Vite restent actifs
    // L'APP process se termine proprement sans tuer les serveurs OVL/CTRL
    console.log('[launcher] Electron closed (code 0) — shutting down.');
    process.exit(0);
  });
}

console.log('[launcher] waiting for Vite servers…');
await Promise.all([
  waitFor('http://127.0.0.1:5173'),
  waitFor('http://127.0.0.1:5174'),
]);
console.log('[launcher] Vite ready → launching Electron');
launchElectron();
