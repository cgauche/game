/**
 * TROIS CLIQUETS DU MURAGE DU TEXTE JOUEUR (#1318 V8a₀, étendus en V8a₁). Le verrou passe SEUL — la marque
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
 *  3. `dataLabel('…')` — le littéral FR passé au MINTEUR du texte authoré (V8a₁). Sans lui, `dataLabel`
 *     serait le fossile renommé. CIBLE 0 dès sa pose, donc SANS gel.
 *
 * Chaque cliquet a les mêmes DEUX rouges, mesurés plus bas : un fichier qui DÉPASSE son gel, un fichier
 * ABSENT du gel qui s'y met. Descendre SOUS son gel ne rougit pas (c'est le but) — mais le gel doit être
 * abaissé dans le même commit, ce que le volet « le gel est SERRÉ » rapporte.
 *
 * CE QUE CES CLIQUETS NE VOIENT PAS (dette nommée V8a₁ — ils comptent des APPELS, pas des littéraux
 * FR en général ; les deux dernières sont consignées AU SITE, pas seulement ici) :
 *  - les champs de texte encore NON marqués du seam : `RollRequest.actionLabel` (`rollSeam.ts`, 8ᵉ
 *    porte — ses littéraux sont policés par `roll-action-label-guard.test.ts`), `BandPorteur.label`,
 *    `CascadeStep.rollLabel`, `options[].detail` ;
 *  - `dataLabel(repli)` typé `string` et non `PlayerText` : un ID de dégradation doit y passer — c'est
 *    le cliquet 3 qui ferme ce trou, pas le type ;
 *  - les résolveurs de donnée encore `string` : `conditionLabel`, `damageTypeLabel`,
 *    `SPEC_SOURCES[].label` (`data/index.ts`) ;
 *  - `src/state/combatManeuvers.ts` — le dernier `rawText` de PRODUCTION, gelé nominativement ;
 *  - `src/ui/CityHubScreen.tsx` (`SCENE_WEATHER_LABEL`) — 2ᵉ carte météo FR hors catalogue, autre axe
 *    (`Scene['weather']`), même classe que ce lot ; consignée à sa carte sœur (`engine/travelStages.ts`) ;
 *  - le GEL DE LOCALE au chargement des cartes dérivées du catalogue — `setLocale` les laisserait en FR
 *    en silence ; consigné sur `setLocale` lui-même (`i18n/index.ts`).
 */
import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * GEL DU 2026-08-16, REGEL V8a₁ — 134 appels dans 28 fichiers, dont UN SEUL en PRODUCTION.
 * La production est passée aux fabriques (`dataLabel` pour le texte AUTHORÉ, `t('step.*')`/`t('opt.*')`
 * et les gabarits de `rollSeam` pour le texte de l'application) : 84 des 85 sites de prod ont été
 * migrés. Le survivant (`combatManeuvers.ts`) appartient au périmètre d'une session voisine ACTIVE et
 * se migre au lot suivant — c'est un fichier NOMMÉ, pas une tolérance. Le stock des TESTS a monté de
 * 108 à 133 : la marque s'est étendue à `ChoiceSpec.options[].label`, et les fixtures de test posent
 * ces libellés au call-site (arbitrage du lot d'extinction E7 — cf. le solde de la vague).
 */
export const GEL_RAW_TEXT: Readonly<Record<string, number>> = {
  'src/state/cadence-rapide.test.ts': 4,
  'src/state/cargo-risk.test.ts': 4,
  'src/state/cascade-quantite-second.test.ts': 6,
  'src/state/cascade-table-step.test.ts': 7,
  'src/state/cascade.test.ts': 18,
  'src/state/combat/blade-trap-test.test.ts': 3,
  'src/state/combatManeuvers.ts': 1,
  'src/state/fixed-die.test.ts': 1,
  'src/state/journal-projection.test.ts': 1,
  'src/state/night-bands.test.ts': 2,
  'src/state/pursuit-flow.test.ts': 4,
  'src/state/pursuit-fuite-variante.test.ts': 1,
  'src/state/pursuit-sacrifice.test.ts': 1,
  'src/state/rest-flow.test.ts': 1,
  'src/state/river-voyage-flow.test.ts': 4,
  'src/state/roll-seam-mints.test.ts': 25,
  'src/state/roll-seam-porte.test.ts': 21,
  'src/state/roll-seam-socle.test.ts': 5,
  'src/state/sea-voyage-flow.test.ts': 9,
  'src/state/sequence-familles.test.ts': 3,
  'src/state/sequence-socle-naval.test.ts': 2,
  'src/state/tavern-cerevis.test.ts': 1,
  'src/state/tavern-dominos-tiebreak.test.ts': 1,
  'src/state/tavern-lancers.test.ts': 1,
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

/**
 * LITTÉRAUX FR passés EN ARGUMENT DIRECT au minteur `dataLabel` (#1318 V8a₁) — la garde qui empêche
 * le fossile de renaître sous un autre nom. `dataLabel` mint le texte AUTHORÉ en donnée ; si un
 * call-site pouvait y écrire une phrase FR, il ne serait qu'un `rawText` renommé. CIBLE ZÉRO, SANS
 * GEL : ce cliquet n'a jamais eu de stock à absorber, donc il n'en accepte aucun.
 *
 * Balayage : chaque appel `dataLabel(` est lu jusqu'à SA parenthèse fermante, en suivant la
 * profondeur des `(`/`[`/`{` et en sautant le contenu des chaînes. Ne comptent que les littéraux de
 * PROFONDEUR 0 (les arguments eux-mêmes) portant AU MOINS DEUX lettres : un id passé à un appel
 * imbriqué (`dataLabel(refLabel('skills', …))`) ou une clé d'index (`CHAR_LABELS['intelligence']`)
 * n'est pas du texte joueur, et une dégradation d'UNE lettre (`'?'`, `'A'`) n'est pas de la prose.
 */
export function litterauxDataLabel(source: string): string[] {
  const out: string[] = [];
  const rx = /\bdataLabel\(/g;
  let m: RegExpExecArray | null;
  while ((m = rx.exec(source))) {
    let i = m.index + m[0].length, prof = 0;
    while (i < source.length) {
      const c = source[i];
      if (c === '(' || c === '[' || c === '{') { prof++; i++; continue; }
      if (c === ']' || c === '}') { prof--; i++; continue; }
      if (c === ')') { if (prof === 0) break; prof--; i++; continue; }
      if (c === "'" || c === '"' || c === '`') {
        const debut = i;
        for (i++; i < source.length && source[i] !== c; i++) if (source[i] === '\\') i++;
        i++;
        const lit = source.slice(debut, i);
        if (prof === 0 && (lit.slice(1, -1).match(/\p{L}/gu) ?? []).length >= 2) out.push(lit);
        continue;
      }
      i++;
    }
  }
  return out;
}

/** Le module qui DÉFINIT `dataLabel` (et le NOMME en JSDoc) est hors du balayage : il en parle. */
const HORS_DATA_LABEL = new Set(['src/data/index.ts', 'src/data/mutations.ts']);

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
    expect(somme(GEL_RAW_TEXT), 'le TOTAL regelé du 2026-08-16 (V8a₁) — il ne se relève pas, il se rabaisse').toBe(134);
  });

  it('la PRODUCTION est à UN fichier NOMMÉ — plus un stock, une exception qui a un nom et une date', () => {
    const prod = Object.entries(reel).filter(([f]) => !estTest(f)).map(([f]) => f);
    expect(prod, 'V8a₁ a migré 84 des 85 sites de prod ; `combatManeuvers.ts` est au périmètre d’une session voisine active').toEqual(['src/state/combatManeuvers.ts']);
  });

  it('MUTATION : un appel de PLUS dans un fichier gelé rougit', () => {
    expect(violations({ 'src/state/combatManeuvers.ts': 2 }, GEL_RAW_TEXT, 'appel(s) de rawText')).toEqual(['src/state/combatManeuvers.ts : 2 appel(s) de rawText pour un gel de 1']);
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

describe('#1318 V8a₁ T3 — le minteur `dataLabel` n’accepte AUCUN littéral FR (cible 0, sans gel)', () => {
  const reel = recense(process.cwd(), (s) => litterauxDataLabel(s).length, (f) => !HORS_DATA_LABEL.has(f));

  it('l’arbre RÉEL ne passe jamais de prose au minteur du texte AUTHORÉ', () => {
    expect(Object.keys(reel), '`dataLabel` mint la DONNÉE ; une phrase FR écrite au call-site va au catalogue (`t()`)').toEqual([]);
  });

  it('MUTATION : une phrase FR en argument est vue', () => {
    expect(litterauxDataLabel("label: dataLabel('Perte de sang'),")).toEqual(["'Perte de sang'"]);
  });

  it('MUTATION : une phrase FR en REPLI (2ᵉ argument) est vue aussi', () => {
    expect(litterauxDataLabel('label: dataLabel(peril.label, "Péril inconnu"),')).toEqual(['"Péril inconnu"']);
  });

  it('un appel à VARIABLES, et une dégradation à une seule lettre, restent verts', () => {
    expect(litterauxDataLabel('dataLabel(peril.label)')).toEqual([]);
    expect(litterauxDataLabel("dataLabel(src?.label, '?')")).toEqual([]);
    expect(litterauxDataLabel("dataLabel(x, 'A')")).toEqual([]);
  });

  it('le balayage s’arrête à SA parenthèse, et ne voit que les arguments DIRECTS', () => {
    // Un id de catégorie sous appel imbriqué, une clé d'index, le voisin d'à côté : rien de tout ça
    // n'est un texte joueur écrit en argument du minteur.
    expect(litterauxDataLabel("stepDetail(dataLabel(refLabel('skills', { id })), t('step.evitement'))")).toEqual([]);
    expect(litterauxDataLabel("dataLabel(CHAR_LABELS[o.char ?? 'intelligence'])")).toEqual([]);
    // …mais la prose posée EN argument reste vue, même après un argument imbriqué.
    expect(litterauxDataLabel("dataLabel(f(x), 'Péril inconnu')")).toEqual(["'Péril inconnu'"]);
  });
});
