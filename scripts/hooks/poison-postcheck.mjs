// Hook PostToolUse(Write|Edit) : la porte AU STYLO — rejoue les gardes anti-poison sur le fichier
// que la session vient d'écrire et renvoie les trouvailles dans SON contexte, pendant qu'elle a
// encore tout le fil. Non bloquant (le blocage vit au pre-commit et en CI — mêmes libs, mêmes
// verdicts). Mécanique partagée : scripts/guards/lib/ (source unique avec les tests Vitest).
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanTombstones, scanExcuses, scanRawClaims, scanDecisionClaims, EXCUSE_GUARD_ACTIVE } from '../guards/lib/commentPoison.mjs';
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
    for (const f of scanRawClaims(rel, text))
      lines.push(`ALERTE affirmation sur le RAW SANS réf de livre (règle 6a — classe « bélier ») — ${rel}:${f.line} ${f.detail} → ouvre le Source : cite la réf dans CE commentaire, ou reformule en réf nue. Une thèse RAW non sourcée d'agent est du poison présumé.`);
    for (const f of scanDecisionClaims(rel, text))
      lines.push(`ALERTE revendication d'autorité SANS trace (credo : une excuse n'est pas une autorisation) — ${rel}:${f.line} ${f.detail} → un arbitrage se TRACE ([entériné], issue #N, date + origine, valeur maison éditable) ou n'existe pas. « Notre arbitrage » sans trace = justification fallacieuse présumée.`);
    if (/(^|\/)src\/(engine|state)\//.test(norm))
      for (const f of scanLabelLogic(rel, text))
        lines.push(`POISON logique par label (#142, id STABLE seulement) — ${rel}:${f.line} ${f.detail}`);
    if (lines.length) {
      lines.push('→ Corrige AVANT de poursuivre : le pre-commit et la CI portent les MÊMES gardes et refuseront.');
      console.log(JSON.stringify({
        hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: lines.join('\n') },
      }));
    }
  }
}
