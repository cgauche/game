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
import { scanTombstones, scanExcuses, scanRawClaims, EXCUSE_GUARD_ACTIVE } from '../guards/lib/commentPoison.mjs';
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
  try {
    // Mode stagé : scanner le BLOB DE L'INDEX (`:<chemin>`), pas le working tree — sur l'arbre
    // partagé, le fichier disque peut porter le WIP d'une AUTRE session que ce commit n'embarque pas.
    text = argFiles.length ? readFileSync(join(ROOT, rel), 'utf8') : execFileSync('git', ['show', `:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  } catch { continue; }
  for (const x of scanTombstones(rel, text)) offenders.push(`${rel}:${x.line} [pierre tombale] ${x.detail}`);
  for (const x of scanExcuses(rel, text))
    (EXCUSE_GUARD_ACTIVE ? offenders : warnings).push(`${rel}:${x.line} [excuse sans tag] ${x.detail}`);
  for (const x of scanRawClaims(rel, text))
    warnings.push(`${rel}:${x.line} [affirmation RAW non ancrée] ${x.detail}`);
  if (/^src\/(engine|state)\//.test(rel))
    for (const x of scanLabelLogic(rel, text)) offenders.push(`${rel}:${x.line} [logique par label] ${x.detail}`);
}

const dataStaged = staged.filter((f) => /^src\/data\/[^/]+\.json$/.test(f.replace(/\\/g, '/')));
if (dataStaged.length) {
  try {
    execFileSync(
      process.execPath,
      [join(ROOT, 'node_modules', 'tsx', 'dist', 'cli.mjs'), join(ROOT, 'scripts', 'guards', 'validate-data.mts'), ...dataStaged],
      { cwd: ROOT, stdio: 'inherit' },
    );
  } catch {
    offenders.push('contrat de donnée VIOLÉ (schéma zod, rapport ci-dessus) — corriger la donnée, jamais le contourner');
  }
}

// Tag [entériné] NOUVELLEMENT introduit dans le diff stagé : visibilité systématique (la validation
// utilisateur vit au stylo — dialogue du hook enterine-guard ; ici on rend tout ajout VISIBLE).
try {
  const addedTags = execFileSync('git', ['diff', '--cached', '-U0'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++') && /\[entériné[^\]]*\]/i.test(l));
  if (addedTags.length) {
    process.stderr.write(`pre-commit — tag(s) [entériné] AJOUTÉ(s) par ce commit (mot réservé à l'utilisateur — vérifier que CHAQUE site a reçu sa validation) :\n${addedTags.map((l) => `  ${l.slice(0, 160)}`).join('\n')}\n`);
  }
} catch { /* diff illisible → pas de scan */ }

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
