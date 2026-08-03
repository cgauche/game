// Hook PostToolUse(Write|Edit) : la porte AU STYLO — rejoue les gardes anti-poison sur le fichier
// que la session vient d'écrire et renvoie les trouvailles dans SON contexte, pendant qu'elle a
// encore tout le fil. Non bloquant (le blocage vit au pre-commit et en CI — mêmes libs, mêmes
// verdicts). Mécanique partagée : scripts/guards/lib/ (source unique avec les tests Vitest).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanTombstones, scanExcuses, scanRawClaims, scanDecisionClaims, EXCUSE_GUARD_ACTIVE,
  loadDecisionsBaseline, partitionBaseline, formatBaselineReport,
} from '../guards/lib/commentPoison.mjs';
import { scanLabelLogic } from '../guards/lib/labelLogic.mjs';

let raw = '';
process.stdin.setEncoding('utf8');
for await (const chunk of process.stdin) raw += chunk;

let fp = '';
try { fp = String(JSON.parse(raw)?.tool_input?.file_path ?? ''); } catch { /* stdin illisible → silence */ }

const norm = fp.replace(/\\/g, '/');
const rel = norm.includes('/src/') ? norm.slice(norm.lastIndexOf('/src/') + 1) : norm;
const isSrcTs = /(^|\/)src\/.*\.(ts|tsx)$/.test(norm) && !/\.test\.[tj]sx?$/.test(norm);

if (isSrcTs) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  let text;
  try { text = readFileSync(fp.startsWith('/') || /^[A-Za-z]:/.test(fp) ? fp : join(root, fp), 'utf8'); } catch { text = ''; }
  if (text) {
    const lines = [];
    for (const f of scanTombstones(rel, text))
      lines.push(`POISON pierre tombale (règle 6c, tolérance zéro) — ${rel}:${f.line} ${f.detail}`);
    for (const f of scanExcuses(rel, text))
      lines.push(`${EXCUSE_GUARD_ACTIVE ? 'POISON' : 'ALERTE'} commentaire-excuse sans tag [entériné AAAA-MM-JJ] (règle 6b) — ${rel}:${f.line} ${f.detail}`);
    // Familles 3 et 4 : le canal ALERTE passe par la baseline nominative — un site déjà tranché
    // (decisions-baseline.json) sort en une ligne compacte, la trouvaille NOUVELLE garde sa consigne.
    const signaux = [
      ...scanRawClaims(rel, text).map((f) => ({
        file: rel, line: f.line,
        detail: `${f.detail} → ouvre le Source : cite la réf dans CE commentaire, ou reformule en réf nue. Une thèse RAW non sourcée d'agent est du poison présumé.`,
      })),
      ...scanDecisionClaims(rel, text).map((f) => ({
        file: rel, line: f.line,
        detail: `${f.detail} → une revendication se TRACE (tag [entériné AAAA-MM-JJ] validé par l'utilisateur) ou n'existe pas. Sans trace = justification fallacieuse présumée.`,
      })),
    ];
    const verdict = partitionBaseline(signaux, loadDecisionsBaseline(), [rel]);
    // Ce qui appelle un geste (NOUVEAU, entrée de baseline périmée) rejoint les lignes à traiter ;
    // le rappel des sites tenus pour intentionnels sort à part, sans consigne de correction.
    lines.push(...formatBaselineReport({ ...verdict, connus: [] }));
    const rappelBaseline = formatBaselineReport({ nouveaux: [], connus: verdict.connus, perimees: [] });
    if (/(^|\/)src\/(engine|state)\//.test(norm))
      for (const f of scanLabelLogic(rel, text))
        lines.push(`POISON logique par label (#142, id STABLE seulement) — ${rel}:${f.line} ${f.detail}`);
    if (lines.length)
      lines.push('→ Corrige AVANT de poursuivre : le pre-commit et la CI portent les MÊMES gardes et refuseront.');
    const sortie = [...lines, ...rappelBaseline];
    if (sortie.length) {
      console.log(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: sortie.join('\n') },
      }));
    }
  }
}
