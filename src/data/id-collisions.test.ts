/**
 * Garde-fou d'INTÉGRITÉ des identifiants de données.
 *
 * (1) Unicité INTRA-catégorie : deux entrées de la même catalogue ne peuvent pas partager un id
 *     (un dup intra = vrai bug — les lookups par id deviennent ambigus). Couvre les tableaux
 *     EXPORTÉS (donc base + frenchy concaténés pour traits/spells).
 *
 * (2) Collisions INTER-catégorie : un même id peut exister dans deux catalogues distincts. Les
 *     lookups étant SCOPÉS par catégorie (`findTraitById`/`findTalentById`/`findManeuverById`/…),
 *     ces collisions sont inoffensives à l'exécution, MAIS sources de confusion. On VERROUILLE
 *     l'ensemble connu/voulu : toute NOUVELLE collision accidentelle (un id réutilisé sans le
 *     vouloir) casse ce test → décision consciente (renommer, ou ajouter à la liste ci-dessous).
 *     Familles documentées :
 *       • trait↔manœuvre : un trait de créature confère une manœuvre de même id (`grantsManeuvers`)
 *         — arme, cornes, morsure, tentacules, etreinte-glaciale, hurlement-fantomatique,
 *           langue-prehensile, regard-petrifiant, vomissement.
 *       • trait↔talent : homonymes distincts (créature vs joueur) — beni, frenesie, haine,
 *           resistance-a-la-magie, vision-nocturne.
 *       • trait↔qualité : homonymes (créature vs qualité d'arme/armure) — infecte, magique, rapide, taille.
 *       • trait↔sort : un trait de créature porte le nom d'un sort/effet homonyme — nuee, perturbant,
 *           protection, regeneration, sang-corrosif, souffle, vol.
 *       • sort↔possession : un sort et l'objet homonyme (Bouclier le sort vs le bouclier) — bouclier,
 *           broyeur-d-os, carreau, flechette.
 *       • divers : effrayant (sort↔talent), pistolet (qualité↔possession), resistance (compétence↔talent),
 *           belier (qualité de siège « Bélier » ADE II 8 ↔ sort homonyme « Bélier »), filet (trapping
 *           « Filet » ZI 3 p.31 ↔ qualité « Filet » ZI 2 p.29 — l'arme PORTE la qualité qui pose son Empêtré),
 *           poudre-impregnee-d-aqshy (trapping ↔ qualité, AA 08 l.544 — la munition PORTE la qualité
 *           qui pose son seuil de Maladresse élargi {8,9}, même patron que `filet`).
 *       • créature↔trapping [TRANSITIONNEL — SOCLE POSSESSIONS #611] : une monture/bête existe à la fois
 *           comme créature (bestiaire = son identité) ET comme trapping-bête legacy — cheval-de-guerre-leger,
 *           cheval-de-trait, chien, mule, pigeon-voyageur, poney, poulet, singe, vers. Ces trappings-bêtes
 *           sont RETIRÉS en T1 (bascule au registre de possessions) ; ces entrées de KNOWN_CROSS devront
 *           alors disparaître (l'overlap s'évanouit).
 *       • créature↔trait : une créature confère à ses combattants un trait de même id — ogre (PERMANENT).
 */
import { describe, it, expect } from 'vitest';
import { traits, talents, qualities, maneuvers, spells, trappings, skills, creatures } from './index';

const CATEGORIES: Record<string, { id: string }[]> = { traits, talents, qualities, maneuvers, spells, trappings, skills, creatures };

/** Ensemble VOULU des ids partagés entre ≥ 2 catalogues (cf. familles documentées ci-dessus). */
const KNOWN_CROSS = [
  'arme', 'belier', 'beni', 'bouclier', 'broyeur-d-os', 'carreau', 'cheval-de-guerre-leger',
  'cheval-de-trait', 'chien', 'cornes', 'effrayant', 'etreinte-glaciale',
  'filet', 'flechette', 'frenesie', 'frisson-paralysant', 'haine', 'hurlement-de-la-bete-indomptable',
  'hurlement-fantomatique', 'infecte', 'langue-prehensile', 'magique',
  'morsure', 'mule', 'nuee', 'ogre', 'perturbant', 'pigeon-voyageur', 'pistolet', 'poney', 'poudre-impregnee-d-aqshy',
  'poulet', 'protection', 'rapide', 'regard-petrifiant', 'regeneration', 'resistance', 'resistance-a-la-magie',
  'sang-corrosif', 'singe', 'souffle', 'taille', 'tentacules', 'vers', 'vision-nocturne', 'vol', 'vomissement',
].sort();

describe('intégrité des ids de données', () => {
  for (const [name, arr] of Object.entries(CATEGORIES)) {
    it(`${name} : aucun id dupliqué intra-catégorie`, () => {
      const ids = arr.map((x) => x.id);
      const dups = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
      expect(dups).toEqual([]);
    });
  }

  it("collisions inter-catégorie = exactement l'ensemble documenté (toute nouvelle collision échoue)", () => {
    const where = new Map<string, Set<string>>();
    for (const [name, arr] of Object.entries(CATEGORIES)) {
      for (const id of new Set(arr.map((x) => x.id))) {
        (where.get(id) ?? where.set(id, new Set()).get(id)!).add(name);
      }
    }
    const cross = [...where].filter(([, cats]) => cats.size > 1).map(([id]) => id).sort();
    expect(cross).toEqual(KNOWN_CROSS);
  });
});
