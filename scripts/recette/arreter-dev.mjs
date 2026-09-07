#!/usr/bin/env node
/**
 * Éteint le serveur de dev qui écoute un PORT — `node scripts/recette/arreter-dev.mjs <port>`.
 *
 * Le port est le seul identifiant fiable : `npm run dev` monte une CHAÎNE de processus (npm → node →
 * vite) et le PID du job du shell est celui du wrapper, pas celui qui écoute. Le PID écoutant se lit
 * donc sur la table TCP, et l'ARBRE entier est tué (`taskkill /T` sous Windows, `process.kill` du
 * groupe ailleurs) : tuer le seul écoutant laisse le wrapper npm relancer ou tenir le port.
 *
 * Rend 0 même si rien n'écoutait (l'arrêt est un état, pas un geste) ; 1 si un arrêt a échoué.
 */
import { execFileSync } from 'node:child_process';

const port = String(process.argv[2] ?? '').trim();
if (!/^\d+$/.test(port)) {
  console.error('usage : node scripts/recette/arreter-dev.mjs <port>');
  process.exit(2);
}

/** PIDs qui ÉCOUTENT ce port, par la table TCP du système. */
function ecoutants(p) {
  const pids = new Set();
  if (process.platform === 'win32') {
    // `Get-NetTCPConnection`, et NON `netstat -p TCP` : celui-ci ne liste que l'IPv4, et Vite écoute
    // sur `::1` — mesuré, le port pris n'y apparaissait pas et l'arrêt annonçait « personne n'écoute ».
    // `exit 0` finit la commande : sans lui, un port LIBRE fait rendre 1 à PowerShell et le script
    // mourrait là où il doit simplement dire « personne n'écoute ».
    const sortie = execFileSync('powershell', ['-NoProfile', '-Command',
      `@(Get-NetTCPConnection -State Listen -LocalPort ${p} -ErrorAction SilentlyContinue) | ForEach-Object { $_.OwningProcess }; exit 0`],
    { encoding: 'utf8' });
    for (const l of sortie.split('\n')) if (l.trim()) pids.add(Number(l.trim()));
    return [...pids];
  }
  const sortie = execFileSync('lsof', ['-nP', `-iTCP:${p}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' });
  for (const l of sortie.split('\n')) if (l.trim()) pids.add(Number(l.trim()));
  return [...pids];
}

const pids = ecoutants(port);
if (pids.length === 0) {
  console.log(`port ${port} : personne n'écoute — rien à arrêter`);
  process.exit(0);
}

let echec = false;
for (const pid of pids) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' });
    else process.kill(pid);
    console.log(`port ${port} : arbre du PID ${pid} arrêté`);
  } catch (e) {
    echec = true;
    console.error(`port ${port} : échec sur le PID ${pid} — ${e instanceof Error ? e.message : String(e)}`);
  }
}
process.exit(echec ? 1 : 0);
