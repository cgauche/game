import { describe, it, expect } from 'vitest';
import { shipHasNavalTrait, navalTraitLevel, effectiveDeckPostes } from './navalTraits';
import { resolveCollision } from './collision';
import { findVehicleById } from '../data';

/**
 * EFFETS des Traits & Améliorations de navire (MDG ch.12) mécanisés là où une brique EXISTANTE les consomme,
 * sans système parallèle : **Bélier** dans la collision (l.221), **Sabord** dans le couvert du pont (l.362-364).
 * On ne RÉ-applique pas Renforcé/Solide (déjà bakés dans les colonnes E/B des navires nommés).
 */
describe('shipHasNavalTrait — lecture des libellés verbatim', () => {
  it('reconnaît un Trait présent (insensible à la casse) et tolère l’Indice', () => {
    const patrouille = findVehicleById('bateau-de-patrouille')!.ship!.traits; // ['Bélier','Renforcé 2','Solide 2']
    expect(shipHasNavalTrait(patrouille, 'Bélier')).toBe(true);
    expect(shipHasNavalTrait(patrouille, 'bélier')).toBe(true);
    expect(shipHasNavalTrait(patrouille, 'Renforcé')).toBe(true); // « Renforcé 2 » ⊃ « Renforcé »
    expect(shipHasNavalTrait(patrouille, 'Solide')).toBe(true);
  });
  it('Trait absent / liste vide / undefined → false (pas de faux positif)', () => {
    expect(shipHasNavalTrait(findVehicleById('cogue')!.ship!.traits, 'Bélier')).toBe(false); // cogue : Peu maniable, Robuste
    expect(shipHasNavalTrait([], 'Bélier')).toBe(false);
    expect(shipHasNavalTrait(undefined, 'Bélier')).toBe(false);
  });
  it('navalTraitLevel : Indice nu = 1, « N » explicite, absent = 0', () => {
    expect(navalTraitLevel(['Peu maniable', 'Robuste'], 'Peu maniable')).toBe(1); // libellé nu → 1
    expect(navalTraitLevel(['Renforcé 2', 'Solide 2'], 'Renforcé')).toBe(2);
    expect(navalTraitLevel(['Renforcé 2'], 'Solide')).toBe(0); // absent
    expect(navalTraitLevel(undefined, 'Peu maniable')).toBe(0);
  });
});

describe('Bélier dans la collision (MDG ch.12 l.221)', () => {
  it('éperonner de sa proue → +5 à l’IC du causeur (la victime encaisse +5) + 5 PA frontaux au causeur', () => {
    const causer = { ic: 5, m: 4, belier: true };
    const victim = { ic: 3, m: 3 };
    const sansBelier = resolveCollision({ ic: 5, m: 4 }, victim, { ramProue: true });
    const avecBelier = resolveCollision(causer, victim, { ramProue: true });
    // Offensif : la victime encaisse 5 de plus qu'un éperonnage sans Bélier.
    expect(avecBelier.victim.damage).toBe(sansBelier.victim.damage + 5);
    expect(avecBelier.victim.damage).toBe(14); // 5 (IC) + 5 (Bélier) + 4 (M du causeur)
    // Défensif : le causeur encaisse autant, mais ses 5 PA frontaux le protègent.
    expect(avecBelier.causer.damage).toBe(sansBelier.causer.damage); // 3 (IC victime) + 4 (M) = 7
    expect(avecBelier.causer.armorBonus).toBe(5);
  });

  it('sans frapper de la proue (ni ramProue ni frontal) → le Bélier ne joue pas', () => {
    const causer = { ic: 5, m: 4, belier: true };
    const victim = { ic: 3, m: 3 };
    const r = resolveCollision(causer, victim, {}); // pas de proue
    expect(r.victim.damage).toBe(9); // 5 + 4, sans bonus de Bélier
    expect(r.causer.armorBonus).toBe(0);
  });

  it('collision frontale → la proue de la victime encaisse aussi : son Bélier lui donne 5 PA', () => {
    const r = resolveCollision({ ic: 5, m: 4 }, { ic: 3, m: 3, belier: true }, { frontal: true });
    expect(r.victim.armorBonus).toBe(5); // victime à Bélier, frappée de face
    expect(r.causer.armorBonus).toBe(0); // causeur sans Bélier
    // M frontal = M total des deux (l.462) → 4 + 3 = 7.
    expect(r.victim.damage).toBe(5 + 7);
  });
});

describe('Sabord → couvert des postes (MDG ch.12 l.362-364)', () => {
  const postes = findVehicleById('cogue')!.deck!.postes!; // 3 emplacements, aucun sabord par défaut

  it('sans Sabord : tir depuis le pont, aucun couvert (postes inchangés)', () => {
    const eff = effectiveDeckPostes(postes, false);
    expect(eff).toBe(postes); // identité : aucune copie inutile
    expect(eff.every((p) => !p.sabord)).toBe(true);
  });

  it('Amélioration Sabord : TOUS les emplacements passent à couvert total (sabord:true)', () => {
    const eff = effectiveDeckPostes(postes, true);
    expect(eff.every((p) => p.sabord === true)).toBe(true);
    expect(postes.every((p) => !p.sabord)).toBe(true); // le gabarit de TYPE n'est pas muté (copie)
  });
});
