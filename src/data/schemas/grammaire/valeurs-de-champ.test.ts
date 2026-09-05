/**
 * STOCK des champs ÉNUMÉRÉS encore sans libellés de valeurs (#1686 lot 3a-2) — banc À PART, et pas
 * dans `grammaire.test.ts` : l'index `ENUMS_DE_DOCUMENT` est peuplé à la CONSTRUCTION, si bien qu'un
 * document SYNTHÉTIQUE bâti par un test (les fabriques y sont exercées sur le type `talent`) s'y
 * inscrirait à côté des vrais defs et fausserait la mesure. Ici, le seul peuplement est le REGISTRE.
 */
import { describe, it, expect } from 'vitest';
import { ENUMS_DE_DOCUMENT } from './document';
import { DEFS_DE_DOCUMENT } from '../validate';

/** Champs énumérés des documents RÉELS — retrouvés par l'IDENTITÉ de leur méta publiée (`SchemaDef.meta`),
 *  jamais par leur type : la suite tourne sans isolation de modules, et un document synthétique bâti
 *  par un autre banc porte le même type qu'un vrai def. */
const enumsDesDefs = () =>
  DEFS_DE_DOCUMENT.map((d) => (d.meta ? ENUMS_DE_DOCUMENT.get(d.meta) : undefined)).filter((e) => e !== undefined);

describe('libellés de VALEURS — stock nominatif décroissant', () => {
  /**
   * STOCK DÉCROISSANT — champs énumérés d'un document EXPOSÉ au Codex dont les valeurs restent
   * SANS libellé FR. 58 au 2026-09-05 (70 champs énumérés exposés, 12 nommés par le lot 3a-2 :
   * les 11 que des tables `X_LABEL` d'UI nommaient, plus `materials · domain`). Cette liste ne fait
   * que DÉCROÎTRE : nommer un champ, c'est le retirer d'ici.
   * NE PAS y ajouter par recopie d'un libellé qui vit DÉJÀ ailleurs comme donnée : les valeurs de
   * `skills · characteristic`, `species · refChar`, `talents · size`… sont des ids d'entités
   * (`characteristics.json`, `species.json`, tailles), dont le nom FR est déjà porté par l'entrée
   * référencée — les redéclarer ici en ferait une SECONDE vérité.
   */
  const SANS_LIBELLES_DE_VALEURS = [
    'activities · difficulty',
    'activities · generalDownOn',
    'activities · resolver',
    'activities · sceneKind',
    'activities · stageOutcome',
    'activities · stakeForm',
    'activities · testModFrom',
    'careerLevels · characteristics',
    'characteristics · nature',
    'combat-stakes · form',
    'criticals · jeu',
    'criticals · localisation',
    'domains · castingChar',
    'flow-stakes · form',
    'maneuvers · kind',
    'maneuvers · stakeForm',
    'naval-traits · deckCover',
    'naval-traits · kind',
    'night-stakes · form',
    'peripeties · kind',
    'pregens · sex',
    'psychology · resolution',
    'psychology · stakeForm',
    'psychology · triggerOn',
    'qualities · polarite',
    'qualities · subType',
    'raceAppearance · extremites',
    'raceAppearance · sex',
    'river-navigation · navBaseDifficulty',
    'river-navigation · tackDifficulty',
    'skills · characteristic',
    'skills · specsSource',
    'species · arcaneDomainsBonusOf',
    'species · refCareer',
    'species · refChar',
    'spells · family',
    'structures · couvertPenalty',
    'structures · edgeKind',
    'structures · kind',
    'symptoms · visibleLocations',
    'tables · die',
    'talents · size',
    'talents · specsSource',
    'tavernGames · campScore',
    'tavernGames · characteristic',
    'tavernGames · drBonus',
    'tavernGames · mode',
    'tavernGames · roundShape',
    'tavernGames · tieBreak',
    'traits · specsSource',
    'trappings · categorie',
    'trappings · minRangeBand',
    'trappings · sizeFor',
    'traumas · kind',
    'traumas · passiveKind',
    'traumas · severity',
    'weaponGroups · combat',
    'weaponGroups · material',
  ];

  it('le stock des champs énumérés SANS libellés de valeurs est celui déclaré, et il DÉCROÎT', () => {
    const stock: string[] = [];
    let nommes = 0;
    for (const d of enumsDesDefs()) {
      for (const [champ, c] of Object.entries(d.champs)) {
        if (c.nomme) { nommes++; continue; }
        if (d.codex) stock.push(`${d.type} · ${champ}`);
      }
    }
    expect(stock.sort()).toEqual(SANS_LIBELLES_DE_VALEURS);
    // Les 12 NOMMÉS sont l'autre côté de la mesure : un stock qui décroît parce qu'un champ a DISPARU
    // n'est pas une migration — celui-ci ne bouge qu'en nommant.
    expect(nommes).toBe(12);
  });

  it('les 12 champs NOMMÉS le sont sur les documents attendus (les tables `X_LABEL` d’UI qui ont migré)', () => {
    const nommes = enumsDesDefs().flatMap((d) =>
      Object.entries(d.champs).filter(([, c]) => c.nomme).map(([champ]) => `${d.type} · ${champ}`),
    );
    expect(nommes.sort()).toEqual([
      'activities · contexts',
      'maneuvers · activation',
      'maneuvers · advantageMode',
      'maneuvers · defense',
      'maneuvers · stat',
      'maneuvers · targeting',
      'materials · domain',
      'mutations · kind',
      'oups · kind',
      'reglesOptionnelles · kind',
      'skills · acces',
      'weaponGroups · kind',
    ]);
  });
});
