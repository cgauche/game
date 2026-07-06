// Hook pre-commit : la porte AU COMMIT — gardes anti-poison diff-scopées sur les fichiers stagés.
// Mécanique partagée : scripts/guards/lib/ (source unique avec les tests Vitest et le hook au stylo).
// Contrat : BLOQUE (exit 1) sur pierre tombale et logique-par-label (tolérance zéro, arbre à zéro) ;
// les excuses sans tag ne bloquent que quand EXCUSE_GUARD_ACTIVE est vrai (tri #136 fait) — d'ici là,
// avertissement stderr. `docs:check` tourne si un docs/*.md (hors plans/ et raw/) est stagé.
// Testabilité : des chemins passés en arguments remplacent la liste stagée (aucun toucher à l'index).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanTombstones, scanExcuses, EXCUSE_GUARD_ACTIVE } from '../guards/lib/commentPoison.mjs';
import { scanLabelLogic } from '../guards/lib/labelLogic.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const argFiles = process.argv.slice(2);
const staged = argFiles.length
  ? argFiles
  : execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean);

const offenders = [];
const warnings = [];

for (const f of staged) {
  const rel = f.replace(/\\/g, '/');
  if (!/^src\/.*\.(ts|tsx)$/.test(rel) || /\.test\.[tj]sx?$/.test(rel)) continue;
  let text;
  try { text = readFileSync(join(ROOT, rel), 'utf8'); } catch { continue; }
  for (const x of scanTombstones(rel, text)) offenders.push(`${rel}:${x.line} [pierre tombale] ${x.detail}`);
  for (const x of scanExcuses(rel, text))
    (EXCUSE_GUARD_ACTIVE ? offenders : warnings).push(`${rel}:${x.line} [excuse sans tag] ${x.detail}`);
  if (/^src\/(engine|state)\//.test(rel))
    for (const x of scanLabelLogic(rel, text)) offenders.push(`${rel}:${x.line} [logique par label] ${x.detail}`);
}

const docsStaged = staged.some((f) => /^docs\/[^/]+\.md$/.test(f.replace(/\\/g, '/')));
if (docsStaged) {
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'docs', 'check-doc-refs.mjs')], { cwd: ROOT, stdio: 'inherit' });
  } catch {
    offenders.push('docs:check en échec (référence vivante qui ment — corriger le doc ou le code, jamais commiter le mensonge)');
  }
}

if (warnings.length) {
  process.stderr.write(`pre-commit — excuses sans tag [entériné] détectées (non bloquant tant que le tri #136 n'est pas fait) :\n${warnings.map((w) => `  ${w}`).join('\n')}\n`);
}
if (offenders.length) {
  process.stderr.write(`pre-commit REFUSÉ — poison détecté (mêmes gardes que la CI, cf. scripts/guards/lib/) :\n${offenders.map((o) => `  ${o}`).join('\n')}\n`);
  process.exit(1);
}
