import { describe, it, expect } from 'vitest';
import { shipHasNavalTrait, navalTraitLevel, navalPassiveOps, navalMoveMod, navalSkillTestDR, hullArmourBonus, belierRam, hasDeckCover, effectiveDeckPostes } from './navalTraits';
import { resolveCollision } from './collision';
import { findVehicleById } from '../data';

/**
 * EFFETS des Traits & Améliorations de navire (MDG ch.12) — DATA-DRIVEN : les valeurs vivent dans le catalogue
 * `naval-traits.json` (éditable au Codex), `navalTraits.ts` ne fait que les LIRE et les exposer là où une brique
 * EXISTANTE les consomme (collision pour le Bélier, pont pour le Sabord, manœuvre/spawn pour Lissage/Blindage).
 * On ne RÉ-applique pas Renforcé/Solide (déjà bakés dans les colonnes E/B des navires nommés → pas de champ d'effet).
 */
describe('shipHasNavalTrait / navalTraitLevel — lecture des libellés verbatim', () => {
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

describe('navalPassiveOps — effets en GameOp (langue unique), répétés ×Indice (Trait ranked)', () => {
  it('aplatit le `passive` du catalogue : Lissage → moveMod ; Peu maniable → 2× skillDRBonus (Ramer/Voile)', () => {
    expect(navalPassiveOps(['Lissage'])).toEqual([{ op: 'moveMod', mod: 1 }]);
    expect(navalPassiveOps(['Peu maniable'])).toEqual([
      { op: 'skillDRBonus', skill: 'ramer', bonus: -1 },
      { op: 'skillDRBonus', skill: 'voile', bonus: -1 },
    ]);
    // ranked → le bloc `passive` est répété par niveau (« Peu maniable 3 » = 3× les deux ops).
    expect(navalPassiveOps(['Peu maniable 3'])).toHaveLength(6);
    expect(navalPassiveOps(['Robuste'])).toEqual([]); // effet déféré : pas de `passive`
    expect(navalPassiveOps(undefined)).toEqual([]);
  });
});

describe('navalMoveMod — Lissage → M, op moveMod (MDG ch.12 l.293)', () => {
  it('Lissage → +1 ; sans Lissage → 0', () => {
    expect(navalMoveMod(['Lissage'])).toBe(1);
    expect(navalMoveMod(['Bélier', 'Sabord'])).toBe(0);
    expect(navalMoveMod(undefined)).toBe(0);
  });
});

describe('navalSkillTestDR — Peu maniable → DR de Voile/Ramer, op skillDRBonus (MDG ch.12 l.173)', () => {
  it('−1 DR/niveau aux Tests de Voile ET de Ramer ; autre compétence ou Trait → 0', () => {
    expect(navalSkillTestDR(['Peu maniable'], 'voile')).toBe(-1);
    expect(navalSkillTestDR(['Peu maniable'], 'ramer')).toBe(-1);
    expect(navalSkillTestDR(['Peu maniable 3'], 'voile')).toBe(-3); // × Indice
    expect(navalSkillTestDR(['Peu maniable'], 'navigation')).toBe(0); // ne touche pas les autres compétences
    expect(navalSkillTestDR(['Robuste'], 'voile')).toBe(0);
    expect(navalSkillTestDR(undefined, 'voile')).toBe(0);
  });
});

describe('hullArmourBonus — Blindage → PA de coque, op `ap` (MÊME op qu’une mutation ; MDG ch.12 l.234/236)', () => {
  it('Fer → 2 PA, Bronze → 1 PA (sommés depuis le `passive`) ; hors catalogue → 0', () => {
    expect(hullArmourBonus(['Blindage (fer)'])).toBe(2);
    expect(hullArmourBonus(['Blindage (bronze)'])).toBe(1);
    expect(hullArmourBonus(['Blindage'])).toBe(0); // pas d'entrée générique : le matériau (bronze/fer) est requis
    expect(hullArmourBonus(['Lissage', 'Sabord'])).toBe(0); // pas de Blindage
    expect(hullArmourBonus(undefined)).toBe(0);
  });
});

describe('belierRam — bonus de collision lu en DONNÉE (MDG ch.12 l.221)', () => {
  it('Bélier → { ic: 5, ap: 5 } depuis le catalogue ; absent → { 0, 0 }', () => {
    expect(belierRam(['Bélier'])).toEqual({ ic: 5, ap: 5 });
    expect(belierRam(['Lissage'])).toEqual({ ic: 0, ap: 0 });
    expect(belierRam(undefined)).toEqual({ ic: 0, ap: 0 });
  });
});

describe('Bélier dans la collision — valeurs data-driven (MDG ch.12 l.221)', () => {
  const belier = belierRam(['Bélier']); // { ic: 5, ap: 5 } depuis naval-traits.json

  it('éperonner de sa proue → +ic à l’IC du causeur (la victime encaisse +5) + ap PA frontaux au causeur', () => {
    const victim = { ic: 3, m: 3 };
    const sansBelier = resolveCollision({ ic: 5, m: 4 }, victim, { ramProue: true });
    const avecBelier = resolveCollision({ ic: 5, m: 4, belier }, victim, { ramProue: true });
    expect(avecBelier.victim.damage).toBe(sansBelier.victim.damage + 5); // +ic à l'IC du causeur
    expect(avecBelier.victim.damage).toBe(14); // 5 (IC) + 5 (Bélier) + 4 (M du causeur)
    expect(avecBelier.causer.damage).toBe(sansBelier.causer.damage); // 3 (IC victime) + 4 (M) = 7
    expect(avecBelier.causer.armorBonus).toBe(5); // ap PA frontaux
  });

  it('sans frapper de la proue (ni ramProue ni frontal) → le Bélier ne joue pas', () => {
    const r = resolveCollision({ ic: 5, m: 4, belier }, { ic: 3, m: 3 }, {});
    expect(r.victim.damage).toBe(9); // 5 + 4, sans bonus de Bélier
    expect(r.causer.armorBonus).toBe(0);
  });

  it('collision frontale → la proue de la victime encaisse aussi : son Bélier lui donne ap PA', () => {
    const r = resolveCollision({ ic: 5, m: 4 }, { ic: 3, m: 3, belier }, { frontal: true });
    expect(r.victim.armorBonus).toBe(5); // victime à Bélier, frappée de face
    expect(r.causer.armorBonus).toBe(0); // causeur sans Bélier
    expect(r.victim.damage).toBe(5 + 7); // M frontal = M total des deux (l.462) → 4 + 3 = 7
  });
});

describe('Sabord → couvert des postes (MDG ch.12 l.362-364), data-driven', () => {
  const postes = findVehicleById('cogue')!.deck!.postes!; // 3 emplacements, aucun sabord par défaut

  it('hasDeckCover lit le drapeau `deckCover` du catalogue (Sabord → vrai ; autre / absent → faux)', () => {
    expect(hasDeckCover(['Sabord'])).toBe(true);
    expect(hasDeckCover(['Lissage', 'Bélier'])).toBe(false);
    expect(hasDeckCover(undefined)).toBe(false);
  });

  it('sans Sabord : tir depuis le pont, aucun couvert (postes inchangés)', () => {
    const eff = effectiveDeckPostes(postes, hasDeckCover([]));
    expect(eff).toBe(postes); // identité : aucune copie inutile
    expect(eff.every((p) => !p.sabord)).toBe(true);
  });

  it('Amélioration Sabord : TOUS les emplacements passent à couvert total (sabord:true)', () => {
    const eff = effectiveDeckPostes(postes, hasDeckCover(['Sabord']));
    expect(eff.every((p) => p.sabord === true)).toBe(true);
    expect(postes.every((p) => !p.sabord)).toBe(true); // le gabarit de TYPE n'est pas muté (copie)
  });
});
