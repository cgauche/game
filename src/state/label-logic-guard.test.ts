import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Garde-fou « logique par LABEL interdite » (#142, doctrine CLAUDE.md bloc agents) : toute LOGIQUE est
 * keyée par `id` STABLE — le `label` est de l'AFFICHAGE (multilangue). Scanne `src/engine` + `src/state`
 * (récursif, `.ts`/`.tsx`, HORS `*.test.*`) : ÉCHEC si le code (commentaires retirés) porte une carte par
 * label (`XXX_BY_LABEL`/`byLabel`) ou une comparaison D'ÉGALITÉ sur `.label` (`x.label === …` /
 * `… === x.label`) — les deux formes remplacent un `id` STABLE par une identité de libellé. TOLÉRANCE
 * ZÉRO, AUCUNE liste d'exceptions (contrairement à `no-emoji-affordance.test.ts`/LOT 4 : ici l'instance
 * de référence, `creatureEquip.ts` SHAPE_BY_LABEL/RELOAD_BY_LABEL, est déjà migrée — rien ne justifie
 * un répit).
 *
 * Les seuls ponts label→id tolérés (`traitByLabel`, `qualityByLabel`, `domainByLabel`,
 * `conditionIdByLabel`, `weaponGroupIdByLabel`, `charKeyByLabel`, `ETAT_ID_BY_LABEL`,
 * `WEAPON_GROUP_ID_BY_LABEL`) vivent dans `src/data/index.ts` — HORS du périmètre scanné ici (couture de
 * CHARGEMENT, cf. CLAUDE.md). Leurs noms en camelCase (`xxxByLabel`, B majuscule) ne matchent d'ailleurs
 * PAS `byLabel` (b minuscule) : seule une carte/fonction NOMMÉE comme le motif interdit (SCREAMING_CASE
 * `XXX_BY_LABEL` ou camelCase `byLabel` en tête de mot) déclenche la garde si elle apparaissait ici.
 */
const ROOT = fileURLToPath(new URL('../..', import.meta.url)); // src/state/ → ../../ = racine du projet
const SCAN_DIRS = ['src/engine', 'src/state'];

const EXCLUDED = (rel: string) => /\.test\.[tj]sx?$/.test(rel);

/** Retire les commentaires de bloc et de ligne (pas les chaînes) — cf. combat-hardcode-guard.test.ts. */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => {
      const i = l.indexOf('//');
      return i >= 0 ? l.slice(0, i) : l;
    })
    .join('\n');
}

/** Carte par label : constante hurlante `XXX_BY_LABEL`/`XXXBYLABEL`, ou fonction/variable `byLabel`. */
const BY_LABEL = /(BY_?LABEL|byLabel)/;
/** Comparaison D'ÉGALITÉ sur `.label`, dans un sens ou l'autre. Le membre en face de `.label` doit être
 *  un accès `mot(.mot)*` COLLÉ (pas d'appel/parenthèse/optional-chaining entre les deux) : ça exclut
 *  `find((x) => x.id === id)?.label` (extraction d'AFFICHAGE après un lookup PAR ID — ex. riverNavigation
 *  `windForceLabel`/`windDirLabel`, seaWeather `windForceLabel`, store.ts `dialogue.speakerId`), qui
 *  n'est pas une comparaison mais une résolution de libellé légitime. */
const LABEL_EQ = /\.label\s*===|===\s*[\w.]+\.label\b/;

function scanFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e)) files.push(p);
    }
  };
  for (const d of SCAN_DIRS) walk(join(ROOT, d));
  return files;
}

describe('garde-fou « logique par label interdite » (src/engine + src/state, #142)', () => {
  it('aucune carte XXX_BY_LABEL/byLabel, aucune comparaison d’égalité sur .label', () => {
    const offenders: string[] = [];
    for (const f of scanFiles()) {
      const rel = relative(ROOT, f).split('\\').join('/');
      if (EXCLUDED(rel)) continue;
      const body = stripComments(readFileSync(f, 'utf8'));
      body.split('\n').forEach((line, i) => {
        if (BY_LABEL.test(line) || LABEL_EQ.test(line)) offenders.push(`${rel}:${i + 1}: ${line.trim()}`);
      });
    }
    expect(
      offenders,
      'Logique par LABEL détectée dans src/engine ou src/state — doctrine : `id` stable pour la logique, ' +
        '`label` = affichage seul. Migrer vers un keying par id (cf. `src/data/index.ts` pour la seule ' +
        'couture label→id tolérée, au CHARGEMENT).',
    ).toEqual([]);
  });
});
