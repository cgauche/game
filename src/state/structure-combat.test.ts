import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { applyAttackResult, applyStructureCriticalToTarget, collapseStructure } from './combatFlow';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { woundsFromHit } from '../engine/woundsCalc';
import { structureIsDown, structureDownKey, wallBetween, type Scene } from './scene';
import { testScene } from '../scenes/test-fixture';
import type { Weapon, Combatant } from '../engine/types';
import type { AttackResult } from '../engine/combat';

/**
 * Structures destructibles JOUABLES en combat (AA p.120-121) : enrôlement depuis les arêtes de mur,
 * Dégâts par le CHEMIN combat (`applyAttackResult`), BRÈCHE à 0 Blessure et Critique de Structure.
 * Déterministe (RNG seedé, `forcedRoll` pour les Critiques) — on dépose un `WallSeg.structure` dans la
 * scène de fixture puis on `startCombat`, et la structure devient un Combattant inerte ciblable.
 */
const mkWeapon = (over: Partial<Weapon> = {}): Weapon => ({
  name: 'arme', type: 'melee', damage: { plusBF: false, flat: 0 }, qualities: [], ...over,
});
const hache = mkWeapon({ name: 'Hache', type: 'melee' });
const fleche = mkWeapon({ name: 'Flèche', type: 'ranged' });
const canon = mkWeapon({ name: 'Canon', type: 'ranged', qualities: [{ id: 'siege' }] });
const belier = mkWeapon({ name: 'Bélier', type: 'melee', qualities: [{ id: 'siege' }, { id: 'belier' }] });

/** Arête E de (2,2) — sépare (2,2) de (3,2). On y pose la structure `structId` (intacte sauf `down`). */
const EDGE = { x: 2, y: 2, side: 'E' as const };
function sceneWithStructure(structId: string, down = false): Scene {
  const s = structuredClone(testScene);
  s.walls = [{ x: EDGE.x, y: EDGE.y, side: EDGE.side, structure: structId }];
  if (down) s.flags = { ...s.flags, [structureDownKey(EDGE.x, EDGE.y, EDGE.side, 0)]: true };
  return s;
}

/** Lance un combat sur la scène de fixture munie d'une structure d'arête, RNG seedé. Renvoie la structure
 *  enrôlée (undefined si `down`), un héros attaquant et l'accès store. */
function start(structId: string, opts?: { down?: boolean; seed?: number }) {
  useGame.getState().seedRng(opts?.seed ?? 1);
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(opts?.seed ?? 1) });
  useGame.setState({ party: [hero] });
  useGame.getState().startScene(sceneWithStructure(structId, opts?.down));
  useGame.getState().startCombat('enc-mutants');
  useGame.getState().confirmRoundStart();
  vi.clearAllTimers();
  const b = useGame.getState().battle!;
  const S = b.combatants.find((c) => c.bodyShape === 'structure');
  const H = b.combatants.find((c) => c.kind === 'hero')!;
  return { S, H, b };
}

/** Construit un AttackResult de touche dont les Blessures sont calculées par le VRAI résolveur de Dégâts
 *  (`woundsFromHit`) — on teste ainsi le CHEMIN combat (Siège ×2 / immunités) jusqu'à l'application. */
function hitRes(weapon: Weapon, target: Combatant, totalDamage: number, over: Partial<AttackResult> = {}): AttackResult {
  return {
    hit: true, attackerRoll: 41, netSL: 2, location: 'corps', damage: totalDamage,
    woundsLost: woundsFromHit(weapon, target, 'corps', totalDamage),
    critical: false, advantageTo: 'attacker', defenderDefeated: false, log: 'touche', ...over,
  };
}

describe('Structures de siège — enrôlement au combat (AA p.120-121)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('une arête `structure` INTACTE devient un Combattant bodyShape=structure (pos=arête, structureEdge renseigné)', () => {
    const { S } = start('porte-de-ville');
    expect(S).toBeTruthy();
    expect(S!.id).toBe('structure-2-2-E-0');
    expect(S!.bodyShape).toBe('structure');
    expect(S!.kind).toBe('npc');
    expect(S!.pos).toEqual({ x: 2, y: 2 });
    expect(S!.structureEdge).toEqual({ x: 2, y: 2, side: 'E', z: 0 });
  });

  it("une structure déjà ABATTUE n'est pas ré-instanciée", () => {
    const { S } = start('porte-de-ville', { down: true });
    expect(S).toBeUndefined();
  });

  it("la présence de la structure ne déclenche pas la victoire, et elle n'a PAS de tour (hors `order`)", () => {
    const { S, b } = start('porte-de-ville');
    expect(b.over).toBeNull(); // 3 Mutants vivants → combat en cours
    expect(b.order).not.toContain(S!.id); // inerte 'npc' → aucun tour (sinon boucle figée)
    expect(b.combatants).toContain(S); // mais RESTE ciblable
  });
});

describe('Structures de siège — Dégâts par le chemin combat', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('Canon (Atout Siège) sur Mur en pierre : ×2 appliqué aux Blessures de la structure', () => {
    const { S, H } = start('mur-en-pierre'); // B 40, BE 12, Impénétrable
    // 20 × 2 (Siège) = 40 ; − BE 12 = 28 retirés → 40 − 28 = 12 restants (Impénétrable franchi par Siège).
    applyAttackResult(useGame.getState, useGame.setState, H, S!, canon, hitRes(canon, S!, 20));
    const s = useGame.getState().battle!.combatants.find((c) => c.id === S!.id)!;
    expect(s.wounds.current).toBe(12);
  });

  it('Flèche sur Mur en pierre (Impénétrable) : 0 Blessure (immunité dans le chemin combat)', () => {
    const { S, H } = start('mur-en-pierre');
    applyAttackResult(useGame.getState, useGame.setState, H, S!, fleche, hitRes(fleche, S!, 30));
    const s = useGame.getState().battle!.combatants.find((c) => c.id === S!.id)!;
    expect(s.wounds.current).toBe(40); // intacte
  });

  it('Bélier sur Porte : endommage (×2, porte = cible légitime) ; Bélier sur Mur : 0', () => {
    // Porte B 8 / BE 2 ; 3 × 2 = 6 − 2 = 4 retirés → 8 − 4 = 4 restants (pas de brèche).
    const door = start('porte');
    applyAttackResult(useGame.getState, useGame.setState, door.H, door.S!, belier, hitRes(belier, door.S!, 3));
    expect(useGame.getState().battle!.combatants.find((c) => c.id === door.S!.id)!.wounds.current).toBe(4);
    // Bélier sur un MUR : n'endommage QUE les portes → 0.
    const wall = start('mur-en-pierre');
    applyAttackResult(useGame.getState, useGame.setState, wall.H, wall.S!, belier, hitRes(belier, wall.S!, 50));
    expect(useGame.getState().battle!.combatants.find((c) => c.id === wall.S!.id)!.wounds.current).toBe(40);
  });
});

describe('Structures de siège — BRÈCHE à 0 Blessure', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it('amener une Porte à 0 Blessure → structure abattue, retirée du combat, passage rouvert', () => {
    const { S, H } = start('porte'); // B 8, Résistant (mêlée passe)
    expect(wallBetween(useGame.getState().scene!, 2, 2, 3, 2)).toBe(true); // intacte : bloque
    // Hache (mêlée) 20 Dégâts − BE 2 = 18 ≥ 8 → 0 Blessure → Effondrement.
    applyAttackResult(useGame.getState, useGame.setState, H, S!, hache, hitRes(hache, S!, 20));
    const after = useGame.getState();
    expect(structureIsDown(after.scene!, { x: 2, y: 2, side: 'E', structure: 'porte' })).toBe(true);
    expect(after.battle!.combatants.some((c) => c.id === S!.id)).toBe(false); // retirée
    expect(wallBetween(after.scene!, 2, 2, 3, 2)).toBe(false); // brèche : passage rouvert
  });
});

describe('Structures de siège — Critique de Structure (AA p.121)', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.clearAllTimers(); useGame.setState({ battle: null }); });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

  it("Effondrement (forcedRoll 98) → Blessures à 0 puis BRÈCHE via collapseStructure", () => {
    const { S, H } = start('mur-en-pierre');
    const log: string[] = [];
    applyStructureCriticalToTarget(useGame.setState, S!, { attackerId: H.id, attackerKind: 'hero' }, log, 98);
    expect(S!.wounds.current).toBe(0); // Effondrement → détruite
    expect(S!.criticalWounds).toBe(1);
    collapseStructure(useGame.getState, useGame.setState, S!);
    expect(structureIsDown(useGame.getState().scene!, { x: 2, y: 2, side: 'E', structure: 'mur-en-pierre' })).toBe(true);
    expect(useGame.getState().battle!.combatants.some((c) => c.id === S!.id)).toBe(false);
  });

  it("ligne à Blessures (forcedRoll 40, Secouée = 1) → 1 Blessure retirée", () => {
    const { S, H } = start('mur-en-pierre');
    const before = S!.wounds.current;
    applyStructureCriticalToTarget(useGame.setState, S!, { attackerId: H.id, attackerKind: 'hero' }, [], 40);
    expect(S!.wounds.current).toBe(before - 1);
  });

  it("Blessure Triviale (forcedRoll 10, Ébréchée) → 0 Blessure retirée", () => {
    const { S, H } = start('mur-en-pierre');
    const before = S!.wounds.current;
    applyStructureCriticalToTarget(useGame.setState, S!, { attackerId: H.id, attackerKind: 'hero' }, [], 10);
    expect(S!.wounds.current).toBe(before);
  });

  it("un double retirant ≥25 % des Blessures restantes déclenche un Critique dans le chemin combat", () => {
    const { S, H } = start('mur-en-pierre'); // B 40 → 25 % = 10
    // Canon Siège : 20 × 2 = 40 − 12 = 28 retirés (≥10), sur un DOUBLE → Critique de Structure.
    applyAttackResult(useGame.getState, useGame.setState, H, S!, canon, hitRes(canon, S!, 20, { critical: true, attackerRoll: 22 }));
    const s = useGame.getState().battle!.combatants.find((c) => c.id === S!.id);
    // 28 de base ; le Critique a incrémenté criticalWounds (et peut avoir retiré des Blessures en plus).
    const live = s ?? S!;
    expect(live.criticalWounds).toBe(1);
    expect(live.wounds.current).toBeLessThanOrEqual(12); // au moins les 28 de base retirés
  });
});
