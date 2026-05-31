'use strict';
const { execSync, spawn } = require('child_process');
const path = require('path');

// Project root = dossier où se trouve l'exe
const projectDir = path.dirname(process.execPath);

const PORTS = [5173, 5174, 49124];

console.log('');
console.log(' RL Overlay Studio v2.0.0 — Lanceur');
console.log(' ====================================');

// Libérer les ports (processus orphelins d'une session précédente)
for (const port of PORTS) {
  try {
    const out = execSync(`netstat -ano 2>nul`, { encoding: 'utf8', shell: true });
    const pids = [...new Set(
      out.split('\n')
        .filter(l => l.includes(`:${port} `) || l.includes(`:${port}\t`))
        .map(l => l.trim().split(/\s+/).pop())
        .filter(p => /^\d+$/.test(p) && p !== '0')
    )];
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore', shell: true });
        console.log(` [OK] Port ${port} libéré (PID ${pid})`);
      } catch {}
    }
  } catch {}
}

console.log(' [>>] Démarrage de rl-overlay-studio...');
console.log('');

const child = spawn('npm.cmd', ['run', 'dev'], {
  cwd: projectDir,
  stdio: 'inherit',
  shell: false,
  windowsHide: false,
});

child.on('exit', code => process.exit(code ?? 0));
child.on('error', err => {
  console.error(' [ERREUR] Impossible de lancer npm:', err.message);
  console.error(' Vérifiez que Node.js et npm sont dans votre PATH.');
  setTimeout(() => process.exit(1), 3000);
});
