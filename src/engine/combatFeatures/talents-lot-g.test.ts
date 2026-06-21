import { describe, it, expect } from 'vitest';
import {
  talentDamageBonus, isSlayer, talentDamageReduction, talentCritExtraWounds, talentRangedAPIgnore,
  ignoresCalledShotPenalty, ignoresSizeRangedMods, sniperRangeAdjust, talentInitiativeBonus,
  canPreemptRanged, hasSurpriseSave, reloadDRBonus, runMovementBonus, fleeMovementBonus,
  shieldAdvantageLevel, hasRiposte, hasStealAdvantage, outnumberCountBonus,
  hasBraveheart, bleedIgnoreLevel, talentMagicResistance, talentFearIndice, talentTestDR,
  talentReverseFailed, offHandPenalty,
} from './dispatch';
import { attackModifiers, woundsFromHit } from '../combat';
import { endOfRound } from '../conditions';
import { makeRNG } from '../dice';
import { slugId } from '../../data/slug';
import type { Combatant, Weapon } from '../types';

/** Lot G — Talents à effet de jeu (LDB 10) : helpers du registre + câblages moteur purs. */
const w = (over: Partial<Weapon> = {}): Weapon => ({ name: 'Épée', type: 'melee', damage: { plusBF: true, flat: 0, bare: true }, qualities: [], ...over });

function mk(talents: { name: string; times: number }[] = [], over: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'H', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: talents.map((t) => ({ talentId: slugId(t.name), times: t.times })), movement: 4,
    ...over,
  } as Combatant;
}

describe('dégâts (LDB 10) — Coup puissant / Tir précis / Combat déloyal / Charge berserk / Tueur / Robuste', () => {
  it('talentDamageBonus par contexte d’arme', () => {
    const c = mk([{ name: 'Coup puissant', times: 2 }, { name: 'Tir précis', times: 1 }, { name: 'Combat déloyal', times: 1 }, { name: 'Charge berserk', times: 3 }]);
    expect(talentDamageBonus(c, w(), false)).toBe(2); // mêlée
    expect(talentDamageBonus(c, w({ type: 'ranged' }), false)).toBe(1); // distance
    expect(talentDamageBonus(c, w({ subType: 'bagarre' }), false)).toBe(3); // mêlée + Bagarre (id de Groupe)
    expect(talentDamageBonus(c, w(), true)).toBe(5); // mêlée + Charge berserk 3
  });
  it('Tueur / Robuste / Frappe blessante / Tir sûr', () => {
    expect(isSlayer(mk([{ name: 'Tueur', times: 1 }]))).toBe(true);
    expect(talentDamageReduction(mk([{ name: 'Robuste', times: 2 }]))).toBe(2);
    expect(talentCritExtraWounds(mk([{ name: 'Frappe blessante', times: 2 }]))).toBe(2);
    expect(talentRangedAPIgnore(mk([{ name: 'Tir sûr', times: 1 }]))).toBe(1);
  });
  it('woundsFromHit : Robuste réduit les Dégâts subis (plancher 1 conservé)', () => {
    const cible = mk([{ name: 'Robuste', times: 2 }]);
    const naive = mk([]);
    expect(woundsFromHit(w(), naive, 'corps', 10) - woundsFromHit(w(), cible, 'corps', 10)).toBe(2);
    expect(woundsFromHit(w(), cible, 'corps', 2)).toBe(1); // min 1 Blessure
  });
});

describe('modificateurs de Test (LDB 10)', () => {
  it('Frappe assommante : pas de −10 à la Tête avec une arme Assommante', () => {
    const c = mk([{ name: 'Frappe assommante', times: 1 }]);
    const tgt = mk([], { id: 't' });
    const mods = attackModifiers(c, tgt, w({ qualities: [{ id: 'assommante' }] }), { kind: 'melee', location: 'tete' });
    expect(mods.find((m) => m.label === 'Localisation visée')).toBeUndefined();
    const sans = attackModifiers(mk([]), tgt, w({ qualities: [{ id: 'assommante' }] }), { kind: 'melee', location: 'tete' });
    expect(sans.find((m) => m.label === 'Localisation visée')?.value).toBe(-10);
  });
  it('Tir mortel : pas de −10 de Localisation à distance', () => {
    const c = mk([{ name: 'Tir mortel', times: 1 }]);
    const tgt = mk([], { id: 't' });
    const mods = attackModifiers(c, tgt, w({ type: 'ranged', range: 30 }), { kind: 'ranged', location: 'tete', distanceTiles: 5 });
    expect(mods.find((m) => m.label === 'Localisation visée')).toBeUndefined();
  });
  it('Tireur d’élite : ignore la Taille de la cible ; Tireur embusqué : Longue 0 / Extrême ÷2', () => {
    const c = mk([{ name: "Tireur d'élite", times: 1 }]);
    const grand = mk([], { id: 't', size: 'enorme' });
    const mods = attackModifiers(c, grand, w({ type: 'ranged', range: 30 }), { kind: 'ranged', distanceTiles: 5 });
    expect(mods.find((m) => m.label.startsWith('Taille (cible)'))).toBeUndefined();
    const sniper = mk([{ name: 'Tireur embusqué', times: 1 }]);
    expect(sniperRangeAdjust(sniper, -10)).toBe(0);
    expect(sniperRangeAdjust(sniper, -30)).toBe(-15);
    expect(sniperRangeAdjust(mk([]), -10)).toBe(-10);
  });
});

describe('initiative / économie d’action (LDB 10)', () => {
  it('Combat instinctif +10×niveau ; Tir rapide pré-empte avec une arme chargée', () => {
    expect(talentInitiativeBonus(mk([{ name: 'Combat instinctif', times: 2 }]))).toBe(20);
    const tireur = mk([{ name: 'Tir rapide', times: 1 }], { weapons: [w({ type: 'ranged' })], loaded: true });
    expect(canPreemptRanged(tireur)).toBe(true);
    expect(canPreemptRanged({ ...tireur, loaded: false } as Combatant)).toBe(false);
  });
  it('Rechargement rapide (toutes) / Artilleur (Poudre noire seulement)', () => {
    const c = mk([{ name: 'Rechargement rapide', times: 1 }, { name: 'Artilleur', times: 2 }]);
    expect(reloadDRBonus(c, w({ type: 'ranged', subType: 'arbalete' }))).toBe(1);
    expect(reloadDRBonus(c, w({ type: 'ranged', subType: 'poudre-noire' }))).toBe(3);
  });
  it('Sprinter / Fuite ! / Vigilance / Maîtrise du combat', () => {
    expect(runMovementBonus(mk([{ name: 'Sprinter', times: 1 }]))).toBe(1);
    expect(fleeMovementBonus(mk([{ name: 'Fuite !', times: 1 }]))).toBe(1);
    expect(hasSurpriseSave(mk([{ name: 'Vigilance', times: 1 }]))).toBe(true);
    expect(outnumberCountBonus(mk([{ name: 'Maîtrise du combat', times: 2 }]))).toBe(2);
  });
});

describe('défense / récupération (LDB 10)', () => {
  it('Porte-Bouclier (au bouclier seulement) / Riposte / Renversement', () => {
    const c = mk([{ name: 'Porte-Bouclier', times: 2 }]);
    expect(shieldAdvantageLevel(c, w({ name: 'Bouclier', qualities: [{ id: 'protectrice', value: 2 }] }))).toBe(2); // bouclier = Atout Protectrice (id stable)
    expect(shieldAdvantageLevel(c, w({ name: 'Épée' }))).toBe(0);
    expect(hasRiposte(mk([{ name: 'Riposte', times: 1 }]))).toBe(true);
    expect(hasStealAdvantage(mk([{ name: 'Renversement', times: 1 }]))).toBe(true);
  });
  it('Endurci : ignore niveau PB d’Hémorragique en fin de Round', () => {
    const c = mk([{ name: 'Endurci', times: 1 }], { conditions: [{ name: 'hemorragique', value: 2 }] });
    endOfRound(c, makeRNG(3));
    expect(c.wounds.current).toBe(11); // 2 pions − 1 ignoré = 1 PB perdu
    expect(bleedIgnoreLevel(c)).toBe(1);
  });
  // (Mâchoires d'acier n'est plus une CombatFeature `stunSave` : c'est un effet `onGainCondition`
  //  data-driven — couvert par les tests de la brique `state/combat/triggeredTest`.)
  it('Cœur vaillant / Résistance à la Magie (talent) / Effrayant', () => {
    expect(hasBraveheart(mk([{ name: 'Cœur vaillant', times: 1 }]))).toBe(true);
    expect(talentMagicResistance(mk([{ name: 'Résistance à la Magie', times: 2 }]))).toBe(4);
    expect(talentFearIndice(mk([{ name: 'Effrayant', times: 2 }]))).toBe(2);
  });
});

describe('tests hors combat (LDB 10)', () => {
  it('Menaçant : +niveau DR aux Tests d’Intimidation', () => {
    const c = mk([{ name: 'Menaçant', times: 2 }]);
    expect(talentTestDR(c, 'Intimidation')).toBe(2);
    expect(talentTestDR(c, 'Charme')).toBe(0);
  });
  it('talents d’inversion : Sociable (Ragot), Pansement de fortune (Guérison, plafond +1 DR)', () => {
    const c = mk([{ name: 'Sociable', times: 1 }, { name: 'Pansement de fortune', times: 1 }]);
    expect(talentReverseFailed(c, 'Ragot')).toEqual({ capDR: undefined });
    expect(talentReverseFailed(c, 'Guérison')).toEqual({ capDR: 1 });
    expect(talentReverseFailed(c, 'Charme')).toBeNull();
  });
  it('Ambidextre toujours fonctionnel après la refonte (régression)', () => {
    expect(offHandPenalty(mk([{ name: 'Ambidextre', times: 1 }]))).toBe(-10);
    expect(offHandPenalty(mk([{ name: 'Ambidextre', times: 2 }]))).toBe(0);
    expect(offHandPenalty(mk([]))).toBe(-20);
  });
});
