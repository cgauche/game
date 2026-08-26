/**
 * REJEU DES MIGRATIONS (#1466 L1a) — `npm run migrations:replay`.
 *
 * Une migration de donnée est REJOUABLE : rejouée sur l'arbre courant, elle ne réécrit RIEN. Cette
 * porte le mesure pour de bon — les scripts de `scripts/migrations/*.mjs` sont rejoués DANS L'ORDRE
 * LEXICAL, EN PLACE (ils lisent `src/data`, `src/scenes` et `Source/` : une copie tmp mesurerait un
 * autre arbre), puis l'arbre est mesuré de DEUX façons complémentaires : `git diff` pour ce qui est
 * SUIVI, `git status --porcelain` pour ce qui ne l'est pas — un fichier CRÉÉ par une migration est
 * invisible à `git diff`, et le rejeu y serait aveugle.
 *
 * Quatre verdicts, aucun silence :
 *  - un script sans en-tête d'ENTRÉES (JSDoc « Entrées : … » — ce qu'il LIT) est ROUGE : une
 *    migration dont on ignore le périmètre de lecture ne se rejoue pas en confiance ;
 *  - un script dont le FAIL-FAST est ATTENDU sur l'arbre sain se déclare dans `ATTENDU_ROUGE` avec
 *    sa raison MESURÉE ET son ÉCHÉANCE (le ticket avec lequel l'entrée meurt) — nommé, jamais sauté
 *    en silence, et son exit 0 devient ROUGE à son tour (une raison périmée est une dérive) ;
 *  - tout autre exit non nul, ou toute donnée SUIVIE réécrite, est ROUGE ;
 *  - tout fichier NEUF apparu dans le périmètre pendant le rejeu est ROUGE et NOMMÉ.
 *
 * ENTRÉES : `scripts/migrations/*.mjs` (les migrations elles-mêmes) — le rejeu ne lit aucune donnée
 * de son propre chef, il délègue aux scripts.
 *
 * NOMMAGE À VENIR (lot #1467 L1b, aucune de ces migrations n'existe encore ici) : elles porteront le
 * préfixe `2026-08-27-l1b-<n><lettre>-<concept>.mjs`, l'ordre lexical valant ordre des vagues — la
 * porte ci-dessus rejoue dans cet ordre. Elles seront NO-OP TOLÉRANTES À LA FORME : rejouées sur
 * l'état final, elles reconnaîtront « déjà migré » et sortiront 0 — une migration absente d'
 * `ATTENDU_ROUGE` qui fail-fast sur « forme inattendue » sort ROUGE du rejeu (`replay.mjs:110`).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const ICI = fileURLToPath(new URL('.', import.meta.url));
const RACINE = fileURLToPath(new URL('../../', import.meta.url));

/**
 * Migrations dont le FAIL-FAST est ATTENDU sur l'arbre sain — liste NOMINATIVE datée (2026-08-25),
 * chaque entrée portant sa raison MESURÉE au rejeu et son ÉCHÉANCE (le ticket avec lequel elle
 * meurt). Elle ne fait que DÉCROÎTRE : un script dont la cause disparaît redevient vert, et son
 * entrée part avec.
 * @type {Record<string, string>}
 */
const ATTENDU_ROUGE = {
  '2026-08-23-spec-competence-libelle-vers-id.mjs':
    'ARBITRAGE REQUIS mesuré sur l’arbre sain — 6 occurrences / 3 specs de `creatures.json` sont des CHOIX ' +
    'BORNÉS imprimés au statbloc (metier/« Armurier OU Forgeron » ×1, savoir/« Divinité » ×3, savoir/' +
    '« Rivières ou Chemins » ×2) : le catalogue ne peut pas les résoudre en UN id, et la migration REFUSE ' +
    'de deviner. Le fail-fast est le contrat, pas un incident. ÉCHÉANCE : #1456, ÉTENDU le 2026-08-26 aux ' +
    'choix bornés — les 6 occurrences y sont nominatives, et cette entrée meurt AVEC lui.',
  '2026-08-23-specs-livres-autorises.mjs':
    'MÊME cause, même donnée : les 6 occurrences ci-dessus restent « hors catalogue sous un livre EXTRAIT » ' +
    '(`frenchy-bzh`), ce que ce script déclare comme arrêt en 1. ÉCHÉANCE : les deux entrées meurent ' +
    'ENSEMBLE avec #1456, étendu le 2026-08-26 pour les porter nominativement.',
};

/** Bloc de commentaire d'en-tête d'un script (jusqu'au premier `*​/`). */
const enTete = (texte) => texte.slice(0, Math.max(0, texte.indexOf('*/')));

/** Le script DÉCLARE-t-il ses entrées ? (`Entrées :` ou `ENTRÉES (…)` dans son en-tête) */
const declareSesEntrees = (texte) => /ENTR[ÉE]ES?\s*[:(]/i.test(enTete(texte));

/** Périmètre ÉCRIT par les migrations : les deux racines de documents, plus l'AUTHORING qui produit
 *  l'artefact de scène (`scripts/arene`, écrit par la migration `give-trapping` — migrer l'artefact
 *  sans sa source serait une demi-migration). */
const PERIMETRE = ['src/data', 'src/scenes', 'scripts/arene'];

/**
 * Fichiers NEUFS (non suivis, `??` de `git status --porcelain`) du périmètre, dans `cwd`.
 *
 * `git diff` ne voit QUE le suivi : une migration qui CRÉE un document à chaque passage y est
 * parfaitement invisible. Ce relevé est la seconde moitié de la mesure d'idempotence.
 * @param {string} cwd racine du dépôt à mesurer
 * @param {readonly string[]} perimetre chemins passés en pathspec à `git status`
 * @returns {string[]} chemins relatifs, dans l'ordre rendu par git
 */
export function neufsDe(cwd, perimetre) {
  const r = spawnSync('git', ['status', '--porcelain', '--', ...perimetre], { cwd, encoding: 'utf8' });
  return (r.stdout ?? '')
    .split(/\r?\n/)
    .filter((l) => l.startsWith('?? '))
    .map((l) => l.slice(3).trim())
    .filter(Boolean);
}

function main() {
  /** État du diff AVANT le rejeu : ce que l'arbre portait déjà n'est pas imputable aux migrations. */
  const diffAvant = spawnSync('git', ['diff', '--', ...PERIMETRE], { cwd: RACINE, encoding: 'utf8' });
  /** Idem pour les fichiers NEUFS : un WIP voisin non suivi n'est pas l'œuvre du rejeu. */
  const neufsAvant = new Set(neufsDe(RACINE, PERIMETRE));

  const scripts = readdirSync(ICI)
    .filter((f) => f.endsWith('.mjs') && f !== 'replay.mjs')
    .sort((a, b) => a.localeCompare(b, 'en'));

  /** @type {string[]} */
  const rouges = [];
  console.log(`migrations:replay — ${scripts.length} migration(s), ordre lexical, EN PLACE`);

  for (const f of scripts) {
    const texte = readFileSync(join(ICI, f), 'utf8');
    if (!declareSesEntrees(texte)) {
      console.log(`  ✗ ${f} — en-tête SANS « Entrées : » (ce que le script LIT)`);
      rouges.push(`${f} : en-tête sans déclaration d'ENTRÉES`);
      continue;
    }
    const debut = Date.now();
    const r = spawnSync(process.execPath, [join(ICI, f)], { cwd: RACINE, encoding: 'utf8' });
    const secondes = ((Date.now() - debut) / 1000).toFixed(1);
    const attendu = ATTENDU_ROUGE[f];
    const ok = attendu ? r.status !== 0 : r.status === 0;
    console.log(`  ${ok ? '✓' : '✗'} ${f} — exit ${r.status} (${secondes}s)${attendu ? ` [rouge ATTENDU : ${attendu}]` : ''}`);
    if (ok) continue;
    const queue = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split(/\r?\n/).slice(-8).join('\n      ');
    console.log(`      ${queue}`);
    rouges.push(attendu ? `${f} : exit 0 alors que le rouge est déclaré ATTENDU (raison périmée)` : `${f} : exit ${r.status}`);
  }

  const diffApres = spawnSync('git', ['diff', '--exit-code', '--', ...PERIMETRE], { cwd: RACINE, encoding: 'utf8' });

  if (diffApres.status === 0) {
    console.log(`\ngit diff --exit-code -- ${PERIMETRE.join(' ')} : rien n’a bougé`);
  } else if (diffApres.stdout === diffAvant.stdout) {
    // L'arbre portait DÉJÀ ce diff avant le rejeu (WIP d'une autre session, édition en cours) : le
    // rejeu, lui, n'a rien écrit. En CI l'arbre est propre et `--exit-code` suffit ; ici on mesure la
    // DELTA, seule chose que ce script a le droit d'imputer aux migrations.
    console.log(`\ngit diff -- ${PERIMETRE.join(' ')} : INCHANGÉ par le rejeu (l’arbre portait déjà ce diff — WIP hors rejeu) :`);
    console.log(spawnSync('git', ['diff', '--stat', '--', ...PERIMETRE], { cwd: RACINE, encoding: 'utf8' }).stdout ?? '');
  } else {
    console.log('\nDONNÉE RÉÉCRITE par le rejeu — une migration n’est pas idempotente :');
    console.log(spawnSync('git', ['diff', '--stat', '--', ...PERIMETRE], { cwd: RACINE, encoding: 'utf8' }).stdout ?? '');
    rouges.push(`git diff : ${PERIMETRE.join('/')} réécrits par le rejeu`);
  }

  const apparus = neufsDe(RACINE, PERIMETRE).filter((f) => !neufsAvant.has(f));
  if (apparus.length) {
    console.log('\nFICHIER(S) NEUF(S) créé(s) par le rejeu — invisibles à `git diff` :');
    for (const f of apparus) console.log(`  + ${f}`);
    rouges.push(`git status : ${apparus.length} fichier(s) NEUF(S) créé(s) par le rejeu (${apparus.join(', ')})`);
  } else {
    console.log(`git status --porcelain -- ${PERIMETRE.join(' ')} : aucun fichier NEUF créé par le rejeu`);
  }

  if (rouges.length) {
    console.error(`\nmigrations:replay ROUGE (${rouges.length}) :\n  - ${rouges.join('\n  - ')}`);
    process.exit(1);
  }
  console.log('migrations:replay — OK');
}

// Le module est IMPORTABLE (la garde de `neufsDe` le monte) : le rejeu ne part que si ce fichier est
// le point d'entrée du process.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) main();
