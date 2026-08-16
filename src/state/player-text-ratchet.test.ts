/**
 * DEUX CLIQUETS NOMINATIFS DU MURAGE DU TEXTE JOUEUR (#1318 V8a₀). Le verrou passe SEUL — la marque
 * `PlayerText` est exigée par le champ pilote (`CascadeStep.label`) ET par les 7 portes du seam
 * (`rollSeam`) — et les deux STOCKS que ce verrou met au jour sont GELÉS ici plutôt que migrés dans le
 * même geste : ce sont des échafaudages à lot d'extinction NOMMÉ (V8a₁ : migration de masse vers `t()`
 * et les gabarits ; puis V8b/V8c), pas des baselines muettes.
 *
 *  1. `rawText(` — le FOSSILE (`i18n/rawText.ts`) : un libellé déjà écrit au call-site, gelé le temps
 *     que sa forme soit tranchée texte par texte. Le module MEURT au commit qui ramène le total à 0.
 *  2. `as CascadeStep` — le contournement de CONTENEUR (T2) dans les fichiers de TEST. En production
 *     il n'en reste AUCUN (mesuré, et le lint l'y refuse : `built-brand-lint.test.ts`) ; les tests sont
 *     hors du sélecteur, donc c'est CE cliquet qui les tient — sans lui, « les tests sont exclus »
 *     serait un trou et non un choix.
 *
 * Chaque cliquet a les mêmes DEUX rouges, mesurés plus bas : un fichier qui DÉPASSE son gel, un fichier
 * ABSENT du gel qui s'y met. Descendre SOUS son gel ne rougit pas (c'est le but) — mais le gel doit être
 * abaissé dans le même commit, ce que le volet « le gel est SERRÉ » rapporte.
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * GEL DU 2026-08-16 (fossile `rawText`) — 193 appels dans 49 fichiers, dont 22 en PRODUCTION. Le stock
 * a quadruplé au regel : le premier murage ne mordait que sur la déclaration DIRECTE d'une étape, alors
 * que la voie canonique passe par les portes du seam — marquer le `label` de leurs SPECS a fait
 * apparaître les ~140 sites que le cast interne des portes blanchissait.
 */
export const GEL_RAW_TEXT: Readonly<Record<string, number>> = {
  'src/state/cadence-rapide.test.ts': 2,
  'src/state/cargo-risk.test.ts': 1,
  'src/state/cascade-quantite-second.test.ts': 6,
  'src/state/cascade-table-step.test.ts': 7,
  'src/state/cascade.test.ts': 8,
  'src/state/cascade.ts': 1,
  'src/state/combat/blade-trap-test.test.ts': 1,
  'src/state/combat/roundHooks.ts': 4,
  'src/state/combat/triggeredTest.ts': 6,
  'src/state/combatEffects.ts': 1,
  'src/state/combatFlow.ts': 9,
  'src/state/combatManeuvers.ts': 1,
  'src/state/combatSlice.ts': 1,
  'src/state/corruptionFlow.ts': 2,
  'src/state/devtools.ts': 1,
  'src/state/embrigadementFlow.ts': 4,
  'src/state/encounterPsychFlow.ts': 2,
  'src/state/fixed-die.test.ts': 1,
  'src/state/interludeFlow.ts': 2,
  'src/state/journal-projection.test.ts': 1,
  'src/state/merchantFlow.ts': 1,
  'src/state/night-bands.test.ts': 2,
  'src/state/pursuit-flow.test.ts': 4,
  'src/state/pursuit-fuite-variante.test.ts': 1,
  'src/state/pursuit-sacrifice.test.ts': 1,
  'src/state/pursuitFlow.ts': 4,
  'src/state/rest-flow.test.ts': 1,
  'src/state/restFlow.ts': 9,
  'src/state/river-voyage-flow.test.ts': 4,
  'src/state/riverVoyageFlow.ts': 14,
  'src/state/roll-seam-mints.test.ts': 24,
  'src/state/roll-seam-porte.test.ts': 14,
  'src/state/roll-seam-socle.test.ts': 5,
  'src/state/rollSeam.ts': 2,
  'src/state/sea-voyage-flow.test.ts': 9,
  'src/state/seaVoyageFlow.ts': 5,
  'src/state/sequence-familles.test.ts': 3,
  'src/state/sequence-socle-naval.test.ts': 2,
  'src/state/shipwreck.ts': 1,
  'src/state/tavern-cerevis.test.ts': 1,
  'src/state/tavern-dominos-tiebreak.test.ts': 1,
  'src/state/tavern-lancers.test.ts': 1,
  'src/state/tavernFlow.ts': 4,
  'src/state/travelFlow.ts': 5,
  'src/state/travelPostes.ts': 6,
  'src/state/upkeep-in-combat.test.ts': 2,
  'src/ui/CascadeModal.test.ts': 1,
  'src/ui/CascadeRevealSubject.test.tsx': 1,
  'src/ui/CascadeTableMode.test.tsx': 4,
};

/** GEL DU 2026-08-16 (`as CascadeStep` en TEST) — 37 casts dans 17 fichiers. Zéro en production. */
export const GEL_AS_CASCADE_STEP: Readonly<Record<string, number>> = {
  'src/state/act-gate-possession.test.ts': 2,
  'src/state/bargain-soutien-departage.test.ts': 2,
  'src/state/cascade-bande-possession.test.ts': 1,
  'src/state/cascade-batch-socle.test.ts': 1,
  'src/state/cascade-quantite-second.test.ts': 6,
  'src/state/cascade.test.ts': 2,
  'src/state/combat-tables-choix-porte.test.ts': 1,
  'src/state/departage-etats-non-fondus.test.ts': 3,
  'src/state/miscast-step.test.ts': 1,
  'src/state/rest-flow.test.ts': 1,
  'src/state/roll-seam-mints.test.ts': 1,
  'src/state/tavern-cerevis.test.ts': 1,
  'src/state/zone-cross-test-gate.test.ts': 1,
  'src/ui/CascadeTableMode.test.tsx': 1,
  'src/ui/VoyageScreen.test.tsx': 1,
  'src/ui/cascade-rolled-phase.test.tsx': 1,
  'src/ui/cascade-subtitle.test.tsx': 11,
};

/** Appels du fossile dans un texte source (le module fossile le DÉFINIT, il ne l'appelle pas). */
export function compteAppels(source: string): number {
  return (source.match(/\brawText\s*\(/g) ?? []).length;
}

/** Casts de conteneur dans un texte source. TEXTUEL : il voit donc aussi les mentions en commentaire —
 *  d'où l'exclusion des deux fichiers qui NOMMENT le motif au lieu de l'employer (ci-dessous). */
export function compteCasts(source: string): number {
  return (source.match(/\bas\s+CascadeStep\b/g) ?? []).length;
}

/** Fichiers hors recensement : ils NOMMENT les motifs (sondes de mutation, JSDoc du verrou) au lieu de
 *  les employer — les compter ferait mentir un stock dont la cible est 0. */
const HORS_RECENSEMENT = new Set([
  'src/state/player-text-ratchet.test.ts',
  'src/state/built-brand-lint.test.ts',
  'src/state/pendings.ts',
]);

/** Recensement fichier → compte sur un arbre (chemins POSIX relatifs à la racine). */
export function recense(racine: string, compte: (s: string) => number, filtre?: (f: string) => boolean): Record<string, number> {
  const out: Record<string, number> = {};
  const parcours = (rel: string): void => {
    for (const e of readdirSync(join(racine, rel), { withFileTypes: true })) {
      const child = `${rel}/${e.name}`;
      if (e.isDirectory()) { parcours(child); continue; }
      if (!/\.tsx?$/.test(e.name) || HORS_RECENSEMENT.has(child)) continue;
      if (filtre && !filtre(child)) continue;
      const n = compte(readFileSync(join(racine, child), 'utf8'));
      if (n > 0) out[child] = n;
    }
  };
  parcours('src');
  return out;
}

/** Violations d'un cliquet : dépassement d'un gel, ou fichier NEUF hors gel. Vide = vert. */
export function violations(recensement: Record<string, number>, gel: Readonly<Record<string, number>>, quoi: string): string[] {
  return Object.entries(recensement)
    .filter(([f, n]) => n > (gel[f] ?? 0))
    .map(([f, n]) => `${f} : ${n} ${quoi} pour un gel de ${gel[f] ?? 0}`);
}

/** Entrées de gel qui SURESTIMENT l'arbre : à rabaisser dans le commit qui les a fait descendre. */
function relachees(reel: Record<string, number>, gel: Readonly<Record<string, number>>): string[] {
  return Object.entries(gel)
    .filter(([f, n]) => (reel[f] ?? 0) < n)
    .map(([f, n]) => `${f} : gel ${n} > ${reel[f] ?? 0} mesuré — abaisser le gel dans CE commit`);
}

const somme = (m: Record<string, number>): number => Object.values(m).reduce((a, b) => a + b, 0);
const estTest = (f: string): boolean => /\.test\.tsx?$/.test(f);

describe('#1318 V8a₀ — le fossile `rawText` est GELÉ, NOMINATIF et DÉCROISSANT (cible 0)', () => {
  const reel = recense(process.cwd(), compteAppels);

  it('l’arbre RÉEL ne dépasse son gel dans AUCUN fichier', () => {
    expect(violations(reel, GEL_RAW_TEXT, 'appel(s) de rawText'), 'un appel de plus = un texte joueur figé de plus : le migrer, pas relever le gel').toEqual([]);
  });

  it('le gel est SERRÉ : aucune entrée ne surestime l’arbre', () => {
    expect(relachees(reel, GEL_RAW_TEXT)).toEqual([]);
  });

  it('CIBLE 0 : le stock mesuré ne dépasse pas le TOTAL gelé, et ce total est DIT', () => {
    expect(somme(reel), 'V8a₁/V8b/V8c ramènent ce total à 0, puis `i18n/rawText.ts` est supprimé').toBeLessThanOrEqual(somme(GEL_RAW_TEXT));
    expect(somme(GEL_RAW_TEXT), 'le TOTAL gelé du 2026-08-16 — il ne se relève pas, il se rabaisse').toBe(193);
  });

  it('le stock de PRODUCTION est dit à part : c’est lui que V8a₁ migre en premier', () => {
    const prod = Object.entries(reel).filter(([f]) => !estTest(f));
    expect(prod.length, '22 fichiers de production portent encore un libellé écrit au call-site').toBeLessThanOrEqual(22);
  });

  it('MUTATION : un appel de PLUS dans un fichier gelé rougit', () => {
    expect(violations({ 'src/state/cascade.ts': 2 }, GEL_RAW_TEXT, 'appel(s) de rawText')).toEqual(['src/state/cascade.ts : 2 appel(s) de rawText pour un gel de 1']);
  });

  it('MUTATION : un fichier ABSENT du gel qui appelle le fossile rougit', () => {
    expect(violations({ 'src/state/nouveauFlux.ts': 1 }, GEL_RAW_TEXT, 'appel(s) de rawText')).toEqual(['src/state/nouveauFlux.ts : 1 appel(s) de rawText pour un gel de 0']);
  });

  it('MUTATION : un fichier qui DESCEND sous son gel ne rougit pas (la décroissance est le but)', () => {
    expect(violations({ 'src/state/sea-voyage-flow.test.ts': 3 }, GEL_RAW_TEXT, 'appel(s)')).toEqual([]);
  });

  it('le compteur voit les formes réelles d’appel, et pas la DÉFINITION du fossile', () => {
    expect(compteAppels("label: rawText('X'), autre: rawText(`${a}`)")).toBe(2);
    expect(compteAppels('export const rawText = (s: string): PlayerText => s as PlayerText;')).toBe(0);
  });
});

describe('#1318 V8a₀ T2 — les `as CascadeStep` des TESTS sont GELÉS (la production n’en a plus)', () => {
  const reel = recense(process.cwd(), compteCasts);

  it('AUCUN cast de conteneur en PRODUCTION — c’est le lint qui l’y refuse, et le fait le confirme', () => {
    expect(Object.keys(reel).filter((f) => !estTest(f)), 'un `as CascadeStep` hors test rouvrirait la voie canonique').toEqual([]);
  });

  it('les fichiers de TEST ne dépassent pas leur gel', () => {
    expect(violations(reel, GEL_AS_CASCADE_STEP, 'cast(s) `as CascadeStep`')).toEqual([]);
  });

  it('le gel est SERRÉ, et son TOTAL est dit (cible 0 — V8a₁ passe ces tests par les portes)', () => {
    expect(relachees(reel, GEL_AS_CASCADE_STEP)).toEqual([]);
    expect(somme(GEL_AS_CASCADE_STEP)).toBe(37);
  });

  it('MUTATION : un cast de PLUS dans un test gelé rougit', () => {
    expect(violations({ 'src/state/cascade.test.ts': 3 }, GEL_AS_CASCADE_STEP, 'cast(s) `as CascadeStep`'))
      .toEqual(['src/state/cascade.test.ts : 3 cast(s) `as CascadeStep` pour un gel de 2']);
  });

  it('MUTATION : un test NEUF qui caste rougit', () => {
    expect(violations({ 'src/state/neuf.test.ts': 1 }, GEL_AS_CASCADE_STEP, 'cast(s) `as CascadeStep`'))
      .toEqual(['src/state/neuf.test.ts : 1 cast(s) `as CascadeStep` pour un gel de 0']);
  });
});
