// Hook pre-commit : la porte AU COMMIT — gardes anti-poison diff-scopées sur les fichiers stagés.
// Mécanique partagée : scripts/guards/lib/ (source unique avec les tests Vitest et le hook au stylo).
// Contrat : BLOQUE (exit 1) sur pierre tombale et logique-par-label (tolérance zéro, arbre à zéro) ;
// les excuses sans tag bloquent quand EXCUSE_GUARD_ACTIVE est vrai, sinon elles rejoignent le canal
// non bloquant. Ce canal (affirmations RAW, revendications d'autorité, hardcode réactif) est trié par
// la baseline nominative `scripts/guards/lib/decisions-baseline.json` : NOUVEAU en tête, sites déjà
// tranchés en une ligne compacte. `docs:check` tourne si un docs/*.md à plat est stagé (racine ou
// docs/raw/, les fiches régénérables — #487).
// Testabilité : des chemins passés en arguments remplacent la liste stagée (aucun toucher à l'index).
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  scanTombstones, scanExcuses, scanRawClaims, scanDecisionClaims, EXCUSE_GUARD_ACTIVE,
  loadDecisionsBaseline, partitionBaseline, formatBaselineReport,
} from '../guards/lib/commentPoison.mjs';
import {
  scanLabelLogic, scanLabelAsIdArg, collectIdParamFnsAcrossDirs, effectiveIdParamFns,
  scanLabelLiteralCompare, LABEL_LITERAL_STOCK,
  STRICT_DIRS, RATCHET_DIRS, RATCHET_EXCEPTIONS, ratchetShortKey,
} from '../guards/lib/labelLogic.mjs';
import { emojisIn } from '../guards/lib/emojiAffordance.mjs';
import { scanHardcode } from '../guards/lib/hardcode.mjs';
import { scanRollSeamExclusivity } from '../guards/lib/rollSeamExclusivity.mjs';
import { rollSeamExcluded } from '../guards/lib/rollSeamWhitelist.mjs';
import { scanBattleRngEngineLeak } from '../guards/lib/battleRngEngineLeak.mjs';
import { battleRngEngineLeakExcluded } from '../guards/lib/battleRngEngineLeakWhitelist.mjs';
import { scanNpmLockHoisted } from '../guards/lib/npmLockHoisted.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// 5ᵉ forme du garde-fou #142 (`.label` passé où le paramètre de déclaration est `id`) : map GLOBALE
// des déclarations id-param sur le MÊME périmètre que `label-logic-guard.test.ts` (déclaration et
// appel peuvent vivre dans des fichiers différents, ex. `bodyShapeOf`) — composition PARTAGÉE
// (`collectIdParamFnsAcrossDirs`, scripts/guards/lib/labelLogic.mjs), aucune copie ici.
const ID_PARAM_FNS = collectIdParamFnsAcrossDirs(ROOT, [...STRICT_DIRS, ...RATCHET_DIRS]);
const strictRe = new RegExp(`^(?:${STRICT_DIRS.join('|')})/`);
const ratchetRe = new RegExp(`^(?:${RATCHET_DIRS.join('|')})/`);

const argFiles = process.argv.slice(2);
const staged = argFiles.length
  ? argFiles
  : execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').filter(Boolean);

const offenders = [];
// Signaux non bloquants, en OBJETS `{ file, line, detail }` : ils passent par la baseline
// nominative (`decisions-baseline.json`) avant impression, qui les range en NOUVEAU / BASELINE.
const warnings = [];
// Fichiers TS réellement scannés — périmètre sur lequel la péremption d'une entrée se juge.
const scannedTs = [];

for (const f of staged) {
  const rel = f.replace(/\\/g, '/');
  if (!/^src\/.*\.(ts|tsx)$/.test(rel) || /\.test\.[tj]sx?$/.test(rel)) continue;
  let text;
  try {
    // Mode stagé : scanner le BLOB DE L'INDEX (`:<chemin>`), pas le working tree — sur l'arbre
    // partagé, le fichier disque peut porter le WIP d'une AUTRE session que ce commit n'embarque pas.
    text = argFiles.length ? readFileSync(join(ROOT, rel), 'utf8') : execFileSync('git', ['show', `:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  } catch { continue; }
  scannedTs.push(rel);
  for (const x of scanTombstones(rel, text)) offenders.push(`${rel}:${x.line} [pierre tombale] ${x.detail}`);
  for (const x of scanExcuses(rel, text)) {
    if (EXCUSE_GUARD_ACTIVE) offenders.push(`${rel}:${x.line} [excuse sans tag] ${x.detail}`);
    else warnings.push({ file: rel, line: x.line, detail: `[excuse sans tag] ${x.detail}` });
  }
  for (const x of scanRawClaims(rel, text))
    warnings.push({ file: rel, line: x.line, detail: `[affirmation RAW non ancrée] ${x.detail}` });
  for (const x of scanDecisionClaims(rel, text))
    warnings.push({ file: rel, line: x.line, detail: `[revendication d'autorité sans trace] ${x.detail}` });
  if (strictRe.test(rel)) {
    for (const x of scanLabelLogic(rel, text)) offenders.push(`${rel}:${x.line} [logique par label] ${x.detail}`);
    for (const x of scanLabelAsIdArg(rel, text, effectiveIdParamFns(text, ID_PARAM_FNS))) offenders.push(`${rel}:${x.line} [logique par label — id STABLE attendu] ${x.detail}`);
    // hardcode.mjs porte des BASELINES par-fichier (policy dans combat-hardcode-guard.test.ts, PAS
    // dupliquée ici) — un nouveau site réactif par-nom peut rester SOUS une baseline tolérée : simple
    // signal, la CI (cliquet complet) reste la porte bloquante pour cette famille.
    for (const x of scanHardcode(rel, text)) warnings.push({ file: rel, line: x.line, detail: `[hardcode réactif par-nom] ${x.detail}` });
  } else if (ratchetRe.test(rel)) {
    // MÊME périmètre RATCHET que `label-logic-guard.test.ts` (STRICT_DIRS/RATCHET_DIRS/RATCHET_EXCEPTIONS
    // partagés via labelLogic.mjs) : un site nouveau dans src/gameIso|ui BLOQUE le commit sauf entrée
    // JUSTIFIÉE dans la MÊME table d'exceptions que le test — jamais un périmètre plus étroit ici.
    const idParamFns = effectiveIdParamFns(text, ID_PARAM_FNS);
    for (const x of [...scanLabelLogic(rel, text), ...scanLabelAsIdArg(rel, text, idParamFns)]) {
      if (!(ratchetShortKey({ rel, line: x.line }) in RATCHET_EXCEPTIONS))
        offenders.push(`${rel}:${x.line} [logique par label — hors exception ratchet] ${x.detail}`);
    }
  }
  // #142 LOT 7 — libellé porté par un champ AUTRE que `label` (`w.reach === 'Très longue'`) : même
  // stock PAR FICHIER que `label-logic-guard.test.ts` (`LABEL_LITERAL_STOCK`, partagé par la lib).
  // Le hook ne voit qu'un fichier à la fois : seul un compte SUPÉRIEUR au stock y bloque — le volet
  // « dette soldée non retirée » reste à la CI, qui scanne le corpus entier.
  if (strictRe.test(rel) || ratchetRe.test(rel)) {
    const n = scanLabelLiteralCompare(rel, text).length;
    if (n > (LABEL_LITERAL_STOCK[rel] ?? 0)) offenders.push(`${rel} [logique par LIBELLÉ] ${n} site(s), stock = ${LABEL_LITERAL_STOCK[rel] ?? 0}`);
  }
  if (/^src\/(ui|state|gameIso)\//.test(rel))
    for (const emoji of emojisIn(text)) offenders.push(`${rel} [emoji d'affordance] ${emoji}`);
  // #274 — exclusivité du seam de jet : rollTest(/d100(/TestOutcome.seal( hors whitelist (double
  // détente avec src/state/roll-seam-exclusivity-guard.test.ts, SOURCE UNIQUE de la whitelist).
  if (!rollSeamExcluded(rel))
    for (const x of scanRollSeamExclusivity(rel, text)) offenders.push(`${rel}:${x.line} [seam de jet contourné] ${x.detail}`);
  // #370 — rng vivant → résolveur moteur : resolveXxx(…, battleRng()) hors whitelist (double détente
  // avec src/state/roll-seam-exclusivity-guard.test.ts, SOURCE UNIQUE de la whitelist).
  if (!battleRngEngineLeakExcluded(rel))
    for (const x of scanBattleRngEngineLeak(rel, text)) offenders.push(`${rel}:${x.line} [rng vivant → résolveur moteur] ${x.detail}`);
}

// #290 — emoji dans la DONNÉE (`src/scenes/**/*.json` + `src/data/*.json`) : même tolérance zéro que le code.
const emojiJsonStaged = staged.filter((f) => {
  const r = f.replace(/\\/g, '/');
  return /^src\/scenes\/.*\.json$/.test(r) || /^src\/data\/[^/]+\.json$/.test(r);
});
for (const f of emojiJsonStaged) {
  const rel = f.replace(/\\/g, '/');
  let text;
  try {
    text = argFiles.length ? readFileSync(join(ROOT, rel), 'utf8') : execFileSync('git', ['show', `:${rel}`], { cwd: ROOT, encoding: 'utf8' });
  } catch { continue; }
  for (const emoji of emojisIn(text)) offenders.push(`${rel} [emoji d'affordance] ${emoji}`);
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

// #528 — package-lock.json amputé des entrées hoistées @emnapi/* par une régénération npm 11.
if (staged.some((f) => f.replace(/\\/g, '/') === 'package-lock.json')) {
  let lockText;
  try {
    lockText = argFiles.length
      ? readFileSync(join(ROOT, 'package-lock.json'), 'utf8')
      : execFileSync('git', ['show', ':package-lock.json'], { cwd: ROOT, encoding: 'utf8' });
  } catch { lockText = undefined; }
  if (lockText !== undefined) {
    for (const x of scanNpmLockHoisted(lockText)) offenders.push(`package-lock.json:${x.line} [lock npm amputé] ${x.detail}`);
  }
}

const docsStaged = staged.some((f) => /^docs\/(?:raw\/)?[^/]+\.md$/.test(f.replace(/\\/g, '/')));
if (docsStaged) {
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'docs', 'check-doc-refs.mjs')], { cwd: ROOT, stdio: 'inherit' });
  } catch {
    offenders.push('docs:check en échec (référence vivante qui ment — corriger le doc ou le code, jamais commiter le mensonge)');
  }
}

// #487 — champ Implémente d'une fiche docs/raw ÉDITÉ à la main : le --check tourne UNIQUEMENT si une
// fiche docs/raw à plat est stagée (coût borné à ce cas), même patron bloquant que ci-dessus.
const rawFicheStaged = staged.some((f) => /^docs\/raw\/[^/]+\.md$/.test(f.replace(/\\/g, '/')));
if (rawFicheStaged) {
  try {
    execFileSync(process.execPath, [join(ROOT, 'scripts', 'raw', 'build-implemente.mjs'), '--check'], { cwd: ROOT, stdio: 'inherit' });
  } catch {
    offenders.push('raw:implemente --check en échec (champ Implémente périmé — relancer `npm run raw:implemente` et committer)');
  }
}

// #641 — la suite `test:raw` (harnais de couverture Atlas, node --test) échappait au gate : un
// commit touchant scripts/raw/** ou docs/raw/** pouvait laisser test:raw rouge (vécu #604). Même
// patron diff-scopé bloquant que docs:check ci-dessus.
const rawInfraStaged = staged.some((f) => {
  const r = f.replace(/\\/g, '/');
  return /^scripts\/raw\//.test(r) || /^docs\/raw\//.test(r);
});
if (rawInfraStaged) {
  try {
    execFileSync('npm', ['run', 'test:raw'], { cwd: ROOT, stdio: 'inherit', shell: process.platform === 'win32' });
  } catch {
    offenders.push('npm run test:raw en échec (suite de couverture Atlas rouge — corriger, jamais committer le rouge)');
  }
}

try {
  execFileSync('npm', ['run', 'agents:check'], {
    cwd: ROOT,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
} catch {
  offenders.push('agents:check en échec (adaptateurs Claude/Codex divergents — lancer `npm run agents:sync`)');
}

// Canal non bloquant : la baseline nominative sépare le DÉJÀ TRANCHÉ (compact, une ligne par site)
// de ce qui arrive avec ce commit — c'est la ligne NOUVEAU qui doit sauter aux yeux. Une entrée de
// baseline sans site correspondant dans les fichiers scannés est signalée pour purge.
const verdict = partitionBaseline(warnings, loadDecisionsBaseline(), scannedTs);
const rapport = formatBaselineReport(verdict);
if (rapport.length) {
  process.stderr.write(`pre-commit — signaux de commentaires (non bloquant) :\n${rapport.map((l) => `  ${l}`).join('\n')}\n`);
}
if (offenders.length) {
  process.stderr.write(`pre-commit REFUSÉ — poison détecté (mêmes gardes que la CI, cf. scripts/guards/lib/) :\n${offenders.map((o) => `  ${o}`).join('\n')}\n`);
  process.exit(1);
}
