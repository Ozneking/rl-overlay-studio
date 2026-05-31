# RL Overlay Studio — Lanceur dev
# Utilisation : ./start.ps1

$rootDir = $PSScriptRoot

# Tuer les eventuels serveurs Vite bloques sur les ports 5173 / 5174
# (processus orphelins d'une session precedente)
foreach ($port in @(5173, 5174, 49124)) {
    $pids = (netstat -ano 2>$null | Select-String ":$port\s") |
            ForEach-Object { ($_ -split '\s+')[-1] } |
            Where-Object { $_ -match '^\d+$' } |
            Select-Object -Unique
    foreach ($p in $pids) {
        try { Stop-Process -Id ([int]$p) -Force -ErrorAction Stop
              Write-Host "[RL Studio] Port $port libere (PID $p)" -ForegroundColor Yellow
        } catch {}
    }
}

Write-Host "[RL Studio] Demarrage via npm run dev..." -ForegroundColor Cyan
Set-Location $rootDir
npm run dev
