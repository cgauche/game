import { describe, it, expect } from 'vitest';
import {
  traitCharMods, traitMovementMod, traitBonusWoundsBE, wardSaves, attacksAreMagical, isEtherial,
  banishedAtZero, hasChampionDefense, meleeHitPenalty, hasPerturbingAura, hasCorrosiveBlood,
  webForce, magicResistanceOf, immunityTypes, isUnstable, isPainless, regenerates,
  bellicosePsychImmune, isMindless, isBestial, isColdBlooded, gorgesOnKill, isStupid, hasRage,
  isNervous, isTerritorial, flyMeters, runMultiplier, traitSeesInDark, hasStealthAgBonus, mutationsAtSpawn,
} from './dispatch';
import { coldBloodedAdjust, isPsychImmune } from '../psychology';
import { attackModifiers } from '../combat';
import { traumaCharPenalties } from '../trauma';
import type { Combatant } from '../../engine/types';
import { statblockToCombatant } from '../../state/spawn';

/** Lot C — Traits de créature (LDB 85). Tests PURS des helpers + dérivation de profil au spawn. */

function mk(over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'c', name: 'C', kind: 'enemy',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
    ...over,
  } as Combatant;
}

describe('dispatch — parsing et prédicats (LDB 85)', () => {
  it('modificateurs de profil : Élite, Coriace, Brutal, Rapide, Rusé', () => {
    expect(traitCharMods(['Élite'])).toEqual({ CC: 20, CT: 20, FM: 20 });
    expect(traitCharMods(['Coriace', 'Brutal'])).toEqual({ E: 20, FM: 10, Ag: -10, F: 10 });
    expect(traitMovementMod(['Brutal'])).toBe(-1);
    expect(traitMovementMod(['Rapide'])).toBe(1);
    expect(traitCharMods(['Rusé'])).toEqual({ Soc: 10, Int: 10, I: 10 });
    expect(traitBonusWoundsBE(['Endurant'])).toBe(true);
  });
  it('sauvegardes : Démoniaque 8+, Protection 9', () => {
    expect(wardSaves(['Démoniaque 8+'])).toEqual([8]);
    expect(wardSaves(['Protection 9'])).toEqual([9]);
    expect(wardSaves(['Arme +8'])).toEqual([]);
  });
  it('attaques magiques / Éthéré / bannissement', () => {
    expect(attacksAreMagical(mk({ traits: ['Démoniaque 8+'] }))).toBe(true);
    expect(attacksAreMagical(mk({ traits: ['Magique'] }))).toBe(true);
    expect(attacksAreMagical(mk({ traits: ['Fabriqué'] }))).toBe(true);
    expect(isEtherial(mk({ traits: ['Éthéré'] }))).toBe(true);
    expect(banishedAtZero(['Démoniaque 8+'])).toBe(true);
  });
  it('divers combat : Champion, Parasité, Perturbant, Sang corrosif, Toile, Instable', () => {
    expect(hasChampionDefense(['Champion'])).toBe(true);
    expect(meleeHitPenalty(['Parasité'])).toBe(-10);
    expect(hasPerturbingAura(['Perturbant'])).toBe(true);
    expect(hasCorrosiveBlood(['Sang corrosif'])).toBe(true);
    expect(webForce(['Toile 40'])).toBe(40);
    expect(isUnstable(['Instable'])).toBe(true);
  });
  it('magie : Résistance à la Magie, Immunité (Poison)', () => {
    expect(magicResistanceOf(['Résistance à la Magie 2'])).toBe(2);
    expect(magicResistanceOf(['Résistance à la Magie'])).toBe(1); // Indice absent → 1 (donnée naine)
    expect(immunityTypes(['Immunité (Poison)'])).toEqual(['poison']);
  });
  it('psy/IA : Bestial, À sang-froid, Affamé, Stupide, Rage, Nerveux, Territorial, Fabriqué', () => {
    expect(isBestial(['Bestial'])).toBe(true);
    expect(isColdBlooded(['À Sang-froid'])).toBe(true); // casse de la donnée
    expect(gorgesOnKill(['Affamé'])).toBe(true);
    expect(isStupid(['Stupide'])).toBe(true);
    expect(hasRage(['Rage'])).toBe(true);
    expect(isNervous(['Nerveux'])).toBe(true);
    expect(isTerritorial(['Territorial'])).toBe(true);
    expect(isMindless(['Fabriqué'])).toBe(true);
  });
  it('mouvement & vision : Vol, Bond/Foulée, Vision nocturne/Infravision, Furtif', () => {
    expect(flyMeters(['Vol 100'])).toBe(100);
    expect(flyMeters(['Foulée'])).toBeNull();
    expect(runMultiplier(['Bond'])).toBe(2);
    expect(runMultiplier(['Foulée'])).toBe(1.5);
    expect(runMultiplier(['Bond', 'Foulée'])).toBe(2); // Bond prime
    expect(traitSeesInDark(['Vision nocturne'])).toBe(true);
    expect(traitSeesInDark(['Infravision'])).toBe(true);
    expect(hasStealthAgBonus(['Furtif'])).toBe(true);
    expect(mutationsAtSpawn(['Mutation', 'Corruption mentale'])).toEqual(['physique', 'mentale']);
  });
});

describe('spawn — profil dérivé des statblocks d’éditeur (LDB 77 « ajoutez les Traits »)', () => {
  it('Élite +20 CC/CT/FM, Brutal −1 M', () => {
    const c = statblockToCombatant({ name: 'Vétéran', char: { CC: 30, CT: 30, FM: 30, M: 4 }, traits: ['Élite', 'Brutal'] } as any, 'e1', { x: 0, y: 0 });
    expect(c.characteristics.CC).toBe(50);
    expect(c.characteristics.FM).toBe(50);
    expect(c.characteristics.F).toBe(40); // Brutal +10 F
    expect(c.movement).toBe(3); // Brutal −1 M
  });
  it('Endurant : +BE Blessures (formule)', () => {
    const sans = statblockToCombatant({ name: 'A', char: { E: 30 }, traits: [] } as any, 'e2', { x: 0, y: 0 });
    const avec = statblockToCombatant({ name: 'B', char: { E: 30 }, traits: ['Endurant'] } as any, 'e3', { x: 0, y: 0 });
    expect(avec.wounds.max - sans.wounds.max).toBe(3);
  });
  it('Fabriqué → immunité psychologique ; Mutation → mutation tirée (graine stable)', () => {
    const c = statblockToCombatant({ name: 'Golem', char: {}, traits: ['Fabriqué', 'Mutation'] } as any, 'e4', { x: 0, y: 0 });
    expect(c.psychImmune).toBe(true);
    expect(c.mutations?.length).toBe(1);
    expect(c.mutations![0].kind).toBe('physique');
    // Déterminisme : même id → même mutation.
    const c2 = statblockToCombatant({ name: 'Golem', char: {}, traits: ['Fabriqué', 'Mutation'] } as any, 'e4', { x: 0, y: 0 });
    expect(c2.mutations![0].label).toBe(c.mutations![0].label);
  });
});

describe('câblages moteur', () => {
  it('Parasité : −10 pour toucher en mêlée (attackModifiers)', () => {
    const atk = mk({ id: 'a' });
    const tgt = mk({ id: 't', traits: ['Parasité'] });
    const mods = attackModifiers(atk, tgt, { name: 'Épée', type: 'melee', damage: '+BF', qualities: [] }, { kind: 'melee' });
    expect(mods.find((m) => m.label === 'Parasité')?.value).toBe(-10);
  });
  it('À sang-froid : un Test de FM raté est inversé s’il devient réussi', () => {
    expect(coldBloodedAdjust({ roll: 91, target: 40, success: false, sl: -5 }, true).success).toBe(true); // 91 → 19
    expect(coldBloodedAdjust({ roll: 99, target: 40, success: false, sl: -5 }, true).success).toBe(false); // 99 → 99
    expect(coldBloodedAdjust({ roll: 91, target: 40, success: false, sl: -5 }, false).success).toBe(false);
  });
  it('Belliqueux : immunité psy si plus d’Avantages que l’adversaire', () => {
    const c = mk({ traits: ['Belliqueux'], advantage: 2 });
    expect(bellicosePsychImmune(c, 1)).toBe(true);
    expect(bellicosePsychImmune(c, 2)).toBe(false);
    expect(isPsychImmune(c, 1)).toBe(true);
    expect(isPsychImmune(c)).toBe(false); // sans contexte d'adversaire, le trait est inerte
  });
  it('Insensible à la douleur : pénalités de Critique ignorées (hors amputations)', () => {
    const t = { label: 'Déchirure musculaire (Majeure)', location: 'jambeG', charPenalty: { Ag: -10 } } as any;
    const douillet = mk({ traumas: [t] });
    const stoique = mk({ traumas: [t], traits: ['Insensible à la douleur'] });
    expect(traumaCharPenalties(douillet, 'Ag')).toEqual([-10]);
    expect(traumaCharPenalties(stoique, 'Ag')).toEqual([]);
    // … mais une AMPUTATION reste pénalisante (LDB 85 p.340).
    const ampute = mk({ traumas: [{ label: 'Amputation (Doigt)', location: 'brasD', charPenalty: { CC: -5 } } as any], traits: ['Insensible à la douleur'] });
    expect(traumaCharPenalties(ampute, 'CC')).toEqual([-5]);
  });
});
