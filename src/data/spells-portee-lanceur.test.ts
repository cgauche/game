/**
 * CONTRAT (#1463, L-ref-2) — la Portée et la Cible d'un Sort ne DÉSIGNENT jamais son lanceur en
 * toutes lettres : ce que les tables du livre `frenchy-bzh` impriment « Sorcier|Sorcier »,
 * « Skaven|Skaven », « Démon|Démon », « Mage|Mage », « Shaman|Shaman », « Rebouteux|Rebouteux »,
 * « Sorcière|Sorcière », « démon|démon » là où le Livre de base imprime « Vous », la donnée l'écrit
 * `{kind:'self'}`. Le mot change avec le chapitre (le ch. 46 l.70 imprime même « Sorcier|Shaman »
 * pour le seul Bélier) : c'est le PORTEUR de la table, jamais une cible tierce.
 *
 * `Source/Warhammer - Habitants & Créatures  du Vieux-Monde (Discord) PDF/71 - Nécromanciens.md`
 * l.249 ; `57 - Clan Eshin.md` l.264 ; `50 - Démons de Nurgle.md` l.214 ;
 * `51 - Démons de Tzeentch.md` l.188 ; `26 - Services Ruraux Fréquents & Usuels.md` l.385 et l.575 ;
 * `43 - Ungors, Gors & Bestigors.md` l.584 et l.804 ; `49 - Démons de Slaanesh.md` l.79 ;
 * `61 - Prophète Gris.md` l.97 ; `67 - Orcs.md` l.605.
 *
 * L'échappatoire `special` reste entière pour ce qui n'a pas de forme (« Spécial », « Voir texte »,
 * « 1 voilier dans la Ligne de vue ») : ce contrat ne parle QUE des désignations de lanceur, et sa
 * liste est FERMÉE, en donnée du test.
 */
import { describe, it, expect } from 'vitest';
import { spells } from './index';
import { spellRangeTiles } from '../engine/magic';
import type { Combatant } from '../engine/types';
import type { SpellRange, SpellTarget } from '../engine/spellRange';

/** LISTE CLOSE des désignations de lanceur, graphies EXACTES du livre (minuscule comprise). */
const LANCEUR = ['Sorcier', 'Sorcière', 'Skaven', 'Démon', 'démon', 'Rebouteux', 'Mage', 'Shaman'];

type Portee = { id: string; range?: SpellRange | null; target?: SpellTarget | null };
const CATALOGUE = spells as unknown as Portee[];

/** Les 32 Sorts du livre `frenchy-bzh` dont la Portée disait le lanceur — la LISTE est le cardinal. */
const SORTS_SUR_SOI = [
  'ame-devoilee', 'armure-d-aethyr', 'armure-d-obscurite', 'avatar-du-rat-cornu', 'belier',
  'bienveillance', 'bouclier', 'cacophonie-scabreuse', 'crevasse', 'desarroi', 'faux-semblant',
  'faveur-du-rat-cornu', 'flamme', 'forme-spectrale', 'furoncle-infecte', 'langue-des-gors',
  'langue-des-pestigors', 'langue-des-slaangors', 'langue-des-tzaangors', 'maitrise-du-destin',
  'nuee-de-mouches', 'pattes-gluantes', 'pied-leger', 'poids-plume', 'position',
  'poudre-d-escampette', 'rafale-hurlante', 'secousse-tellurique', 'shurikens-enchantes', 'trouble',
  'vol', 'waaagh',
];

const dummy = { id: 'x', characteristics: {} } as unknown as Combatant;

describe('spells.json — Portée/Cible ne désigne jamais le lanceur en toutes lettres', () => {
  it('aucune entrée ne porte une désignation de lanceur en `special`', () => {
    const fautifs = CATALOGUE.flatMap((s) => (['range', 'target'] as const).flatMap((champ) => {
      const v = s[champ] as { kind?: string; text?: string } | null | undefined;
      return v?.kind === 'special' && LANCEUR.includes(v.text ?? '') ? [`${s.id}.${champ} = « ${v.text} »`] : [];
    }));
    expect(fautifs, `Portées/Cibles désignant le lanceur (→ {kind:'self'}) :\n${fautifs.join('\n')}`).toEqual([]);
  });

  it('les 32 Sorts concernés portent une Portée CHIFFRABLE par le moteur (`self` → 0 case)', () => {
    const muets = SORTS_SUR_SOI.filter((id) => {
      const s = CATALOGUE.find((e) => e.id === id);
      expect(s, `sort absent du catalogue : ${id}`).toBeTruthy();
      return spellRangeTiles(s!.range, dummy) !== 0;
    });
    expect(muets, `Portées encore non chiffrables (null) : ${muets.join(', ')}`).toEqual([]);
  });

  it('leur Cible est `self` quand le livre y disait aussi le lanceur (22 des 54 occurrences)', () => {
    const surSoi = CATALOGUE.filter((s) => SORTS_SUR_SOI.includes(s.id) && s.target?.kind === 'self').map((s) => s.id);
    expect(surSoi).toEqual([
      'ame-devoilee', 'armure-d-aethyr', 'armure-d-obscurite', 'avatar-du-rat-cornu', 'belier',
      'faux-semblant', 'faveur-du-rat-cornu', 'flamme', 'forme-spectrale', 'furoncle-infecte',
      'langue-des-gors', 'langue-des-pestigors', 'langue-des-slaangors', 'langue-des-tzaangors',
      'maitrise-du-destin', 'pattes-gluantes', 'pied-leger', 'poids-plume', 'position',
      'poudre-d-escampette', 'trouble', 'vol',
    ]);
  });

  /** La colonne « Cible » ne disait PAS toujours le lanceur : quand le livre y imprime une ZdE, elle
   *  reste une ZdE — la migration n'a touché que la Portée de ces quatre-là (`43 - Ungors…` l.593
   *  et l.804, `49 - Démons de Slaanesh` l.289, `67 - Orcs` l.605). */
  it('les Cibles en ZONE des mêmes Sorts restent des ZdE (jamais aplaties en `self`)', () => {
    for (const id of ['bouclier', 'desarroi', 'secousse-tellurique', 'waaagh']) {
      const s = CATALOGUE.find((e) => e.id === id)!;
      expect(s.target?.kind, id).toBe('area');
      expect(s.range?.kind, id).toBe('self');
    }
  });
});
