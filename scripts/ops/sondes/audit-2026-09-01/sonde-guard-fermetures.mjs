// SONDE (lecture seule) — PÉRIMÈTRE du garde de solde de ticket, mesuré sur le CHEMIN RÉEL.
// Deux commandes qui ferment les MÊMES tickets sont-elles jugées pareil ? La mesure passe par le
// DRIVER stdin (`scripts/hooks/solde-ticket-guard.mjs` lancé comme le fait le hook PreToolUse), donc
// par le cumul de TOUS ses évaluateurs — interroger `evaluate` seul ne mesurerait que le volet
// « solde du commit » et rendrait SILENCE sur une fermeture qu'un AUTRE volet refuse.
// COMPTEUR : verdict rendu pour chacune des commandes (attendu : DENY partout, sauf le témoin
// `gh issue create` et `gh api --input -`, dont le corps arrive par l'entrée standard : SILENCE).
// Usage : node scripts/ops/sondes/audit-2026-09-01/sonde-guard-fermetures.mjs
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { RACINE } from './_socle.mjs';

const GARDE = join(RACINE, 'scripts', 'hooks', 'solde-ticket-guard.mjs');

const CAS = [
  ['git commit', 'git commit -m "fix(data): stock recalé — corrige #1636 corrige #1637"'],
  ['gh issue close', 'gh issue close 1636 1637 --comment "corrige #1636 corrige #1637"'],
  ['gh issue close (sous-shell)', 'bash -lc "gh issue close 1636 1637"'],
  ['gh api PATCH state', 'gh api repos/cgauche/game/issues/1636 -X PATCH -f state=closed'],
  ['gh issue create (témoin)', 'gh issue create --title "x" --body-file b.md'],
  // Le corps de la requête (donc l'état `closed`) vit dans un FICHIER dont le CHEMIN est sur la
  // ligne : le garde le LIT, et un corps illisible est refusé (fail-closed) plutôt que silencé.
  ['gh api --input (corps lu, fail-closed)', 'gh api repos/cgauche/game/issues/1636 -X PATCH --input corps.json'],
  // `--input -` reste HORS PORTÉE, dit : le corps arrive par l'entrée standard, il n'existe nulle
  // part avant l'exécution — la sonde le JOUE pour que le trou reste visible (SILENCE attendu).
  ['gh api --input - (hors portée : stdin)', 'gh api repos/cgauche/game/issues/1636 -X PATCH --input -'],
];

/** Verdict du hook pour une commande, tel que Claude Code le recevrait. */
function verdict(command) {
  const payload = JSON.stringify({
    session_id: 'sonde', hook_event_name: 'PreToolUse',
    tool_name: 'mcp__lean-ctx__ctx_shell', tool_input: { command, cwd: RACINE },
  });
  const run = spawnSync(process.execPath, [GARDE], { input: payload, encoding: 'utf8', cwd: RACINE });
  if (run.status !== 0) return { decision: `EXIT ${run.status}`, raison: run.stderr.trim().slice(0, 200) };
  if (!run.stdout.trim()) return { decision: 'SILENCE', raison: '' };
  const sortie = JSON.parse(run.stdout).hookSpecificOutput;
  return {
    decision: (sortie.permissionDecision ?? 'contexte').toUpperCase(),
    raison: (sortie.permissionDecisionReason ?? sortie.additionalContext ?? '').slice(0, 120),
  };
}

for (const [nom, command] of CAS) {
  const { decision, raison } = verdict(command);
  console.log(`${nom.padEnd(28)} -> ${decision.padEnd(8)} ${raison}`);
}
