/**
 * Curation élargie (Lot 8 bis) : Magie mineure + Arcanes communs + Miracles
 * Sigmar/Shallya curés, ops missile (Drain soigne le lanceur, Grands feux posent
 * leurs États), PA temporisés (Armure Aethyrique), désambiguïsation des labels
 * en double, inventaire d'implémentation.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyCast } from './combatFlow';
import { makePregens } from '../data/pregens';
import { spells, findSpell } from '../data';
import { curatedSpec, spellSpecFor } from '../data/spellspecs';
import { spellSupport } from '../engine/spellspec';
import { woundsFromHit } from '../engine/combat';
import { effectiveArmourAt } from '../engine/characteristics';
import { isMagicMissile, type CastResult, type MissileResult } from '../engine/magic';
import type { Combatant, Weapon } from '../engine/types';

const ok = (sl: number): CastResult => ({ cast: true, roll: 21, target: 70, sl, isCritical: false, isFumble: false, log: 'lancé' });

beforeEach(() => {
  useGame.setState({ battle: null, party: [], journal: [], pendingCast: null, pendingReveals: [] });
  useGame.getState().seedRng(51);
});

describe('couverture de curation', () => {
  it('Magie mineure, Arcanes communs, Domaines Feu/Lumière, Miracles Sigmar+Shallya : tous curés', () => {
    const curedArcaneDomains = ['Feu', 'Lumière', 'Cieux', 'Métal', 'Ombres', 'Gueule', 'Bête', 'Sorcellerie', 'Démonologie', 'Mort', 'Vie', 'Magie naturelle'];
    for (const s of spells) {
      const fam = s.type === 'Magie mineure' || (s.type === 'Magie des Arcanes' && s.subType == null)
        || (s.type === 'Magie des Arcanes' && curedArcaneDomains.includes(s.subType ?? ''))
        || (s.type === 'Invocation' && (s.subType === 'Sigmar' || s.subType === 'Shallya'));
      if (fam) expect(spellSpecFor(s).curated, s.label).toBe(true);
    }
  });

  it('labels en double : « Enchevêtrement » d\'Arcane est curé, le miracle de Taal reste en repli', () => {
    expect(curatedSpec('Enchevêtrement', 'Magie des Arcanes')).toBeTruthy();
    expect(curatedSpec('Enchevêtrement', 'Invocation')).toBeUndefined();
    const taal = spells.find((s) => s.label === 'Enchevêtrement' && s.type === 'Invocation')!;
    expect(spellSpecFor(taal).curated).toBe(false);
  });

  it('spellSupport : classification mécanique / partiel / narratif', () => {
    const choc = spells.find((s) => s.label === 'Choc' && s.type === 'Magie mineure')!;
    expect(spellSupport(spellSpecFor(choc), isMagicMissile(choc))).toBe('mecanique');
    const lumiere = findSpell('Lumière')!;
    expect(spellSupport(spellSpecFor(lumiere), false)).toBe('narratif');
    // Cautériser est devenu 100 % mécanique (op preventInfection, Jalon 2.6) — l'exemple
    // « partiel » est désormais Couronne de Flammes (grantTrait + volet talent journalisé).
    const cauteriser = findSpell('Cautériser')!;
    expect(spellSupport(spellSpecFor(cauteriser), false)).toBe('mecanique');
    const couronne = findSpell('Couronne de Flammes')!;
    expect(spellSupport(spellSpecFor(couronne), false)).toBe('partiel');
  });
});

describe('Armure Aethyrique — PA temporisés', () => {
  it('pose un effet apAll, lu par effectiveArmourAt et la mitigation woundsFromHit', () => {
    const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
    useGame.setState({ party: [w] as Combatant[] });
    const before = effectiveArmourAt(w, 'corps');
    applyCast(useGame.getState, useGame.setState, w, w, findSpell('Armure Aethyrique')!, ok(3), false, false);
    expect(effectiveArmourAt(w, 'corps')).toBe(before + 1);
    const arme: Weapon = { name: 'Épée', type: 'melee', damage: '+BF+4', qualities: [], subType: 'Base' } as never;
    const sans = { ...w, activeEffects: [] } as Combatant;
    expect(woundsFromHit(arme, w, 'corps', 10)).toBe(woundsFromHit(arme, sans, 'corps', 10) - 1);
  });
});

describe('ops de spec sur la branche Projectile (curées seulement)', () => {
  it('Drain : le LANCEUR regagne 1 PB après la touche', () => {
    const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
    const cible = makePregens().find((h) => h.name === 'Sigmund Reikhardt')!;
    w.wounds.current = w.wounds.max - 3;
    useGame.setState({ party: [w, cible] as Combatant[] });
    const drain = spells.find((s) => s.label === 'Drain' && s.type === 'Magie mineure')!;
    const res: CastResult & Partial<MissileResult> = { ...ok(2), hit: true, location: 'corps', damage: 5, woundsLost: 2, defenderDefeated: false };
    const before = w.wounds.current;
    applyCast(useGame.getState, useGame.setState, w, cible, drain, res, true, false);
    expect(useGame.getState().party.find((h) => h.id === w.id)!.wounds.current).toBe(before + 1);
  });

  it('Éblouissant : Aveuglé immédiat + récurrent porté par un effet actif', () => {
    const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
    const cible = makePregens().find((h) => h.name === 'Sigmund Reikhardt')!;
    useGame.setState({ party: [w, cible] as Combatant[] });
    applyCast(useGame.getState, useGame.setState, w, cible, findSpell('Éblouissant')!, ok(2), false, false);
    const after = useGame.getState().party.find((h) => h.id === cible.id)!;
    expect(after.conditions.find((x) => x.name === 'Aveuglé')?.value).toBe(1);
    expect(after.activeEffects?.some((e) => e.condPerRound?.name === 'Aveuglé')).toBe(true);
  });

  it('Innocence immaculée : retire 1 Point de Corruption (jamais sous 0)', () => {
    const p = makePregens().find((h) => h.name === 'Frère Anselm')!;
    const w = makePregens().find((h) => h.name === 'Wilhelmina Faust')!;
    w.corruption = 2;
    useGame.setState({ party: [p, w] as Combatant[] });
    applyCast(useGame.getState, useGame.setState, p, w, findSpell('Innocence immaculée')!, ok(1), false, false);
    expect(useGame.getState().party.find((h) => h.id === w.id)!.corruption).toBe(1);
  });
});
