// SONDE (lecture seule) — PÉRIMÈTRE du garde de solde de ticket : il ne voit qu'un `git commit`.
// `extractClosedIssues` sort la liste VIDE dès que `isGitCommitCommand` rend `false`
// (`scripts/hooks/solde-ticket-guard.mjs:268`), et `evaluate` rend `null` sur liste vide (l.396).
// Deux commandes fermant les MÊMES tickets sont donc jugées différemment : le message de commit est
// REFUSÉ sans solde conforme, la fermeture par `gh issue close` passe hors du garde.
// COMPTEUR : verdict rendu pour chacune des deux commandes (attendu DENY / SILENCE).
// Usage : node scripts/ops/sondes/audit-2026-09-01/sonde-guard-fermetures.mjs
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { RACINE } from './_socle.mjs';

const { evaluate, extractClosedIssues } = await import(
  pathToFileURL(join(RACINE, 'scripts', 'hooks', 'solde-ticket-guard.mjs')).href
);

const CAS = [
  ['git commit', 'git commit -m "fix(data): stock recalé — corrige #1636 corrige #1637"'],
  ['gh issue close', 'gh issue close 1636 1637 --comment "corrige #1636 corrige #1637"'],
];

for (const [nom, command] of CAS) {
  const verdict = evaluate({
    command,
    today: '2026-09-01',
    readSolde: () => null,
    soldeOnDisk: () => null,
    counter: 0,
    readRevuePalier: () => null,
  });
  console.log(
    `${nom.padEnd(15)} issues détectées = [${extractClosedIssues(command)}]  ->  ${verdict ? 'DENY' : 'SILENCE'}`,
  );
}
