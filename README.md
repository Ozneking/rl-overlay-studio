# RL Overlay Studio v2

Application desktop Electron pour la diffusion de Rocket League en compétition.  
Panneau de configuration visuel, overlay OBS temps réel, clips replay automatiques.

> Made with ❤️ by **Ozneking**

Si le projet vous est utile, n'hésitez pas à ⭐ liker le repo et à poser vos questions dans les Issues !

---

## Fonctionnalités

- **Overlay OBS** — Scoreboard, boost, carte joueur, événements (buts, saves, demos)
- **Panneau de contrôle** — Configuration des équipes, couleurs, logos, format de série
- **Replay Clips** — Enregistrement automatique de chaque replay de but via OBS WebSocket
- **Tableau des stats** — Affiché en fin de match avec les statistiques figées
- **Waiting Screen** — Bracket, programme, prochain match pour l'attente entre les games
- **Profils** — Sauvegarde/restauration de configuration par événement
- **Preview intégré** — Aperçu de l'overlay en temps réel dans le panneau

---

## Prérequis

| Outil | Version |
|---|---|
| Node.js | 18+ |
| npm | 9+ |
| OBS Studio | 28+ (WebSocket intégré) |
| Rocket League | Socket stats activé (voir configuration) |

---

## Configuration Rocket League

Avant de lancer le jeu, activer le socket stats dans :
```
<Répertoire d'installation RL>\TAGame\Config\DefaultStatsAPI.ini
```

| Paramètre | Type | Par défaut | Description |
|---|---|---|---|
| `PacketSendRate` | float | `0` (désactivé) | Nombre de paquets UpdateState par seconde. **Doit être > 0** pour activer le socket. Valeur recommandée : `30`. Limite max : 120. |
| `Port` | int | `49123` | Port local du socket (ne pas modifier sauf conflit). |

Exemple :
```ini
[StatsAPI]
PacketSendRate=30
Port=49123
```

---

## Démarrage rapide

### Option 1 — Launcher exe (recommandé)

Double-cliquer sur **`rl-studio.exe`** à la racine du projet.  
Libère automatiquement les ports et lance `npm run dev`.

> Pour recompiler le launcher : voir [`tools/launcher.cs`](tools/launcher.cs)

### Option 2 — PowerShell

```powershell
./start.ps1
```

### Option 3 — npm direct

```bash
npm run dev
```

> ⚠️ Depuis un terminal VS Code, utiliser `./start.ps1` ou le launcher exe.  
> VS Code injecte `ELECTRON_RUN_AS_NODE=1` qui empêche Electron de démarrer.

---

## Configuration OBS

### Overlay principal
Ajouter une **Browser Source** dans OBS :
```
URL : http://127.0.0.1:5173
```

### Tableau des stats (fin de match)
```
URL : http://127.0.0.1:5173/data
```

### Waiting Screen (entre les games)
```
URL : http://127.0.0.1:5173/start
```

### Replay Clips (highlight)
```
URL : http://127.0.0.1:5173/replay
```

---

## Replay Clips — Configuration OBS

1. OBS 28+ ouvert avec **WebSocket activé** (Outils → WebSocket Server Settings)
2. Activer **Tampon de relecture (Replay Buffer)** ou laisser l'enregistrement standard
3. Dans le panneau Replay de l'app : entrer l'URL WebSocket + mot de passe, cliquer **Connecter**

**Audio jeu uniquement** (sans micro cast) :
- Paramètres OBS → Sortie → Mode Avancé → Enregistrement → Piste audio : sélectionner uniquement la Piste 2
- Mixeur audio → Desktop Audio : cocher Piste 2 — Microphone : décocher Piste 2

---

## Structure du projet

```
rl-overlay-studio/
├── electron/
│   ├── main.cjs          → Main process (fenêtres, IPC, gestion clips)
│   ├── relay.cjs         → Relay TCP→WebSocket (Rocket League → overlay)
│   ├── obs-client.cjs    → Client OBS WebSocket (StartRecord / StopRecord)
│   ├── config-store.cjs  → Persistance config JSON (electron-store)
│   └── preload.cjs       → Bridge IPC → window.electronAPI
├── renderer/
│   ├── control/          → Interface de configuration (React 18 + Tailwind v4)
│   │   ├── components/
│   │   │   ├── layout/   → TopBar, Sidebar
│   │   │   ├── panels/   → Match, Teams, UI, Profiles, Tournament, Clips
│   │   │   └── preview/  → PreviewFrame, MockControls
│   │   └── store/        → Zustand (config-store, relay-store)
│   └── overlay/          → Overlay OBS (React)
│       ├── main.jsx       → Tous les composants overlay
│       └── style.css      → Styles overlay (police Orbitron)
├── public/
│   ├── config/           → overlay-config.json (écrit par Electron, lu par OBS)
│   ├── replays/          → Clips vidéo auto-générés (ignorés par git)
│   └── assets/teams/     → Logos équipes par défaut
├── tools/
│   └── launcher.cs       → Source C# du launcher exe
├── start.ps1             → Lanceur PowerShell alternatif
├── rl-studio.exe         → Launcher compilé (re-compilable depuis tools/)
├── vite.overlay.config.mjs
└── vite.control.config.mjs
```

---

## Ports utilisés

| Port | Usage |
|---|---|
| `5173` | Overlay OBS (Vite) |
| `5174` | Panneau de contrôle (Vite) |
| `49123` | Rocket League TCP (StatsAPI) |
| `49124` | Relay WebSocket (overlay ↔ RL) |
| `4455` | OBS WebSocket |

---

## Recompiler le launcher exe

Le launcher est un petit programme C# compilé avec .NET Framework 4 (intégré à Windows) :

```powershell
& "C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe" `
    /target:exe /out:rl-studio.exe tools/launcher.cs
```

---

## Profils

Les profils de configuration sont sauvegardés dans :
```
%APPDATA%\rl-overlay-studio\
```
