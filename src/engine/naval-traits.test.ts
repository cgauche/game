import { describe, it, expect } from 'vitest';
import { shipHasNavalTrait, navalTraitLevel, navalPassiveOps, navalMoveMod, navalSkillTestDR, hullArmourBonus, belierRam, hasDeckCover, effectiveDeckPostes } from './navalTraits';
import { resolveCollision } from './collision';
import { findVehicleById } from '../data';

/**
 * EFFETS des Traits & Améliorations de navire (MDG ch.12) — DATA-DRIVEN : les valeurs vivent dans le catalogue
 * `naval-traits.json` (éditable au Codex), `navalTraits.ts` ne fait que les LIRE et les exposer là où une brique
 * EXISTANTE les consomme (collision pour le Bélier, pont pour le Sabord, manœuvre/spawn pour Lissage/Blindage).
 * On ne RÉ-applique pas Renforcé/Solide (déjà bakés dans les colonnes E/B des navires nommés → pas de `passive`).
 * Les Traits/Améliorations sont des RÉFS par id (`NavalTraitRef = { id, value? }`), JAMAIS des libellés.
 */
describe('shipHasNavalTrait / navalTraitLevel — réfs par id (NavalTraitRef)', () => {
  it('reconnaît un Trait présent par son id ; l’Indice vient de `value`', () => {
    const patrouille = findVehicleById('bateau-de-patrouille')!.ship!.traits; // [{belier},{renforce,2},{solide,2}]
    expect(shipHasNavalTrait(patrouille, 'belier')).toBe(true);
    expect(shipHasNavalTrait(patrouille, 'renforce')).toBe(true);
    expect(shipHasNavalTrait(patrouille, 'solide')).toBe(true);
    expect(navalTraitLevel(patrouille, 'renforce')).toBe(2); // value:2
    expect(navalTraitLevel(patrouille, 'belier')).toBe(1); // value absent → Indice 1
  });
  it('Trait absent / liste vide / undefined → false (pas de faux positif)', () => {
    expect(shipHasNavalTrait(findVehicleById('cogue')!.ship!.traits, 'belier')).toBe(false); // cogue : peu-maniable, robuste
    expect(shipHasNavalTrait([], 'belier')).toBe(false);
    expect(shipHasNavalTrait(undefined, 'belier')).toBe(false);
  });
  it('navalTraitLevel : `value` explicite, défaut 1 si absent, 0 si le Trait n’est pas là', () => {
    expect(navalTraitLevel([{ id: 'peu-maniable' }, { id: 'robuste' }], 'peu-maniable')).toBe(1); // value absent → 1
    expect(navalTraitLevel([{ id: 'renforce', value: 2 }, { id: 'solide', value: 2 }], 'renforce')).toBe(2);
    expect(navalTraitLevel([{ id: 'renforce', value: 2 }], 'solide')).toBe(0); // absent
    expect(navalTraitLevel(undefined, 'peu-maniable')).toBe(0);
  });
});

describe('navalPassiveOps — effets en GameOp (langue unique), répétés ×Indice (Trait ranked)', () => {
  it('aplatit le `passive` du catalogue : Lissage → moveMod ; Peu maniable → 2× skillDRBonus (Ramer/Voile)', () => {
    expect(navalPassiveOps([{ id: 'lissage' }])).toEqual([{ op: 'moveMod', mod: 1 }]);
    expect(navalPassiveOps([{ id: 'peu-maniable' }])).toEqual([
      { op: 'skillDRBonus', skill: 'ramer', bonus: -1 },
      { op: 'skillDRBonus', skill: 'voile', bonus: -1 },
    ]);
    // ranked → le bloc `passive` est répété par `value` (« Peu maniable 3 » = 3× les deux ops).
    expect(navalPassiveOps([{ id: 'peu-maniable', value: 3 }])).toHaveLength(6);
    expect(navalPassiveOps([{ id: 'robuste' }])).toEqual([]); // effet déféré : pas de `passive`
    expect(navalPassiveOps(undefined)).toEqual([]);
  });
});

describe('navalMoveMod — Lissage → M, op moveMod (MDG ch.12 l.293)', () => {
  it('Lissage → +1 ; sans Lissage → 0', () => {
    expect(navalMoveMod([{ id: 'lissage' }])).toBe(1);
    expect(navalMoveMod([{ id: 'belier' }, { id: 'sabord' }])).toBe(0);
    expect(navalMoveMod(undefined)).toBe(0);
  });
});

describe('navalSkillTestDR — Peu maniable → DR de Voile/Ramer, op skillDRBonus (MDG ch.12 l.173)', () => {
  it('−1 DR/niveau aux Tests de Voile ET de Ramer ; autre compétence ou Trait → 0', () => {
    expect(navalSkillTestDR([{ id: 'peu-maniable' }], 'voile')).toBe(-1);
    expect(navalSkillTestDR([{ id: 'peu-maniable' }], 'ramer')).toBe(-1);
    expect(navalSkillTestDR([{ id: 'peu-maniable', value: 3 }], 'voile')).toBe(-3); // × Indice (value)
    expect(navalSkillTestDR([{ id: 'peu-maniable' }], 'navigation')).toBe(0); // ne touche pas les autres compétences
    expect(navalSkillTestDR([{ id: 'robuste' }], 'voile')).toBe(0);
    expect(navalSkillTestDR(undefined, 'voile')).toBe(0);
  });
});

describe('hullArmourBonus — Blindage → PA de coque, op `ap` (MÊME op qu’une mutation ; MDG ch.12 l.234/236)', () => {
  it('Fer → 2 PA, Bronze → 1 PA (sommés depuis le `passive`) ; hors catalogue → 0', () => {
    expect(hullArmourBonus([{ id: 'blindage-fer' }])).toBe(2);
    expect(hullArmourBonus([{ id: 'blindage-bronze' }])).toBe(1);
    expect(hullArmourBonus([{ id: 'blindage' }])).toBe(0); // pas d'entrée générique : le matériau (bronze/fer) est requis
    expect(hullArmourBonus([{ id: 'lissage' }, { id: 'sabord' }])).toBe(0); // pas de Blindage
    expect(hullArmourBonus(undefined)).toBe(0);
  });
});

describe('belierRam — bonus de collision lu en DONNÉE (MDG ch.12 l.221)', () => {
  it('Bélier → { ic: 5, ap: 5 } depuis le catalogue ; absent → { 0, 0 }', () => {
    expect(belierRam([{ id: 'belier' }])).toEqual({ ic: 5, ap: 5 });
    expect(belierRam([{ id: 'lissage' }])).toEqual({ ic: 0, ap: 0 });
    expect(belierRam(undefined)).toEqual({ ic: 0, ap: 0 });
  });
});

describe('Bélier dans la collision — valeurs data-driven (MDG ch.12 l.221)', () => {
  const belier = belierRam([{ id: 'belier' }]); // { ic: 5, ap: 5 } depuis naval-traits.json

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

  it('hasDeckCover lit le champ `deckCover` du catalogue (Sabord → vrai ; autre / absent → faux)', () => {
    expect(hasDeckCover([{ id: 'sabord' }])).toBe(true);
    expect(hasDeckCover([{ id: 'lissage' }, { id: 'belier' }])).toBe(false);
    expect(hasDeckCover(undefined)).toBe(false);
  });

  it('sans Sabord : tir depuis le pont, aucun couvert (postes inchangés)', () => {
    const eff = effectiveDeckPostes(postes, hasDeckCover([]));
    expect(eff).toBe(postes); // identité : aucune copie inutile
    expect(eff.every((p) => !p.sabord)).toBe(true);
  });

  it('Amélioration Sabord : TOUS les emplacements passent à couvert total (sabord:true)', () => {
    const eff = effectiveDeckPostes(postes, hasDeckCover([{ id: 'sabord' }]));
    expect(eff.every((p) => p.sabord === true)).toBe(true);
    expect(postes.every((p) => !p.sabord)).toBe(true); // le gabarit de TYPE n'est pas muté (copie)
  });
});
