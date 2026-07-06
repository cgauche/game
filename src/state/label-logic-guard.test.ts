import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanLabelLogic } from '../../scripts/guards/lib/labelLogic.mjs';

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

// Mécanique de scan (stripComments + BY_LABEL_RX/LABEL_EQ_RX + scanLabelLogic) :
// `scripts/guards/lib/labelLogic.mjs` (module .mjs pur, partagé avec un futur hook pre-commit).

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
      const contenu = readFileSync(f, 'utf8');
      for (const finding of scanLabelLogic(rel, contenu)) offenders.push(`${rel}:${finding.line}: ${finding.detail}`);
    }
    expect(
      offenders,
      'Logique par LABEL détectée dans src/engine ou src/state — doctrine : `id` stable pour la logique, ' +
        '`label` = affichage seul. Migrer vers un keying par id (cf. `src/data/index.ts` pour la seule ' +
        'couture label→id tolérée, au CHARGEMENT).',
    ).toEqual([]);
  });
});
