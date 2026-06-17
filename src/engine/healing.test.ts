import { describe, it, expect } from 'vitest';
import type { Combatant } from './types';
import {
  hasHealSkill, isHealable, availableHealModes, healableTargets,
  healWoundsDelta, stopBleedOutcome, applyHealWounds, applyStopBleed,
} from './healing';

function hero(p: Partial<Combatant> = {}): Combatant {
  return {
    id: 'h', name: 'Soigneur', kind: 'hero',
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 38, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 12 }, advantage: 0, conditions: [], movement: 4,
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [{ skillId: 'guerison', advances: 10 }], talents: [],
    pos: { x: 1, y: 1 }, ...p,
  } as Combatant;
}

describe('engine/healing — gate compétence & cibles', () => {
  it('hasHealSkill : vrai si Compétence Guérison possédée, faux sinon (Avancée, LDB 09 l.226)', () => {
    expect(hasHealSkill(hero())).toBe(true);
    expect(hasHealSkill(hero({ skills: [] }))).toBe(false);
  });

  it('isHealable : blessé OU hémorragique ; pas mort/éjecté', () => {
    expect(isHealable(hero({ wounds: { current: 12, max: 12 }, conditions: [] }))).toBe(false);
    expect(isHealable(hero({ wounds: { current: 5, max: 12 } }))).toBe(true);
    expect(isHealable(hero({ wounds: { current: 12, max: 12 }, conditions: [{ name: 'hemorragique', value: 1 }] }))).toBe(true);
    expect(isHealable(hero({ wounds: { current: 5, max: 12 }, dead: true }))).toBe(false);
  });

  it('availableHealModes : « wounds » bloqué si déjà soigné cette rencontre ; « bleed » indépendant', () => {
    const t = hero({ wounds: { current: 5, max: 12 }, conditions: [{ name: 'hemorragique', value: 2 }] });
    expect(availableHealModes(t)).toEqual(['wounds', 'bleed']);
    expect(availableHealModes({ ...t, soinRencontreUtilise: true })).toEqual(['bleed']);
  });

  it('healableTargets (combat) : soi + alliés adjacents (Chebyshev ≤ 1), inconscient inclus', () => {
    const healer = hero({ wounds: { current: 12, max: 12 }, pos: { x: 2, y: 2 } }); // plein PB → pas auto-soignable
    const adj = hero({ id: 'a', wounds: { current: 0, max: 12 }, conditions: [{ name: 'inconscient', value: 1 }], pos: { x: 3, y: 2 } });
    const far = hero({ id: 'f', wounds: { current: 1, max: 12 }, pos: { x: 8, y: 8 } });
    const ids = healableTargets(healer, [healer, adj, far], { adjacency: true }).map((c) => c.id);
    expect(ids).toContain('a');
    expect(ids).not.toContain('f');
    expect(ids).not.toContain('h'); // healer plein PB, pas hémorragique → pas soignable
  });

  it('healableTargets : un soigneur blessé peut se soigner lui-même (auto-soin)', () => {
    const healer = hero({ wounds: { current: 8, max: 12 }, pos: { x: 2, y: 2 } });
    const ids = healableTargets(healer, [healer], { adjacency: true }).map((c) => c.id);
    expect(ids).toContain('h');
  });
});

describe('engine/healing — calculs DR (purs)', () => {
  it('healWoundsDelta : succès = BI+DR (plancher 0) ; échec BI+DR<0 = perte ; échec BI+DR≥0 = 0', () => {
    expect(healWoundsDelta(3, 2, true)).toBe(5);
    expect(healWoundsDelta(3, -5, true)).toBe(0);   // succès ne blesse jamais
    expect(healWoundsDelta(1, -4, false)).toBe(-3); // échec, BI+DR<0 → -3
    expect(healWoundsDelta(3, -1, false)).toBe(0);  // échec mais BI+DR≥0 → rien
  });

  it('stopBleedOutcome : retire 1+DR borné aux pions ; Exténué quand tout retiré ; échec = rien', () => {
    expect(stopBleedOutcome(2, 5, true)).toEqual({ removed: 3, gainExtenue: false });
    expect(stopBleedOutcome(2, 2, true)).toEqual({ removed: 2, gainExtenue: true });
    expect(stopBleedOutcome(0, 3, true)).toEqual({ removed: 1, gainExtenue: false });
    expect(stopBleedOutcome(5, 3, false)).toEqual({ removed: 0, gainExtenue: false });
  });
});

describe('engine/healing — mutateurs', () => {
  it('applyHealWounds : +PB plafonné max, pose le flag, lève l’Inconscient quand on repasse >0 (LDB 18 l.28)', () => {
    const t = hero({ id: 't', wounds: { current: 0, max: 12 }, conditions: [{ name: 'inconscient', value: 1 }, { name: 'a-terre', value: 1 }], roundsAtZero: 3 });
    applyHealWounds(t, 5);
    expect(t.wounds.current).toBe(5);
    expect(t.soinRencontreUtilise).toBe(true);
    expect(t.conditions.find((c) => c.name === 'inconscient')).toBeUndefined(); // reprend connaissance
    expect(t.conditions.find((c) => c.name === 'a-terre')).toBeTruthy();        // mais reste à terre
    expect(t.roundsAtZero).toBe(0);
  });

  it('applyHealWounds : delta négatif inflige des Blessures (loseWounds : −Avantage + À Terre à 0)', () => {
    const t = hero({ id: 't', wounds: { current: 2, max: 12 }, advantage: 3 });
    applyHealWounds(t, -4);
    expect(t.wounds.current).toBe(0);
    expect(t.advantage).toBe(0);
    expect(t.conditions.find((c) => c.name === 'a-terre')).toBeTruthy();
    expect(t.soinRencontreUtilise).toBeUndefined(); // pas de bénéfice → flag non posé
  });

  it('applyStopBleed : retire les pions ; Exténué quand le dernier part (LDB 16 l.109)', () => {
    const t = hero({ id: 't', conditions: [{ name: 'hemorragique', value: 2 }] });
    applyStopBleed(t, 1); // 1+1 = 2 pions retirés
    expect(t.conditions.find((c) => c.name === 'hemorragique')).toBeUndefined();
    expect(t.conditions.find((c) => c.name === 'extenue')).toBeTruthy();
  });
});
