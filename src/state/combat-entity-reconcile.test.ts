import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useGame } from './store';
import { checkBattleOver } from './combatFlow';
import { removeEntities } from './combatGeometry';
import { createHero } from '../engine/character';
import { makeRNG } from '../engine/dice';
import { testScene } from '../scenes/test-fixture';
import type { Scene, SceneEntity } from './scene';
import { enemyRigProfile, entityRigProfile } from '../gameIso/rig/enemyProfile';
import { hashSeed } from '../gameIso/appearance';

/**
 * Identité UNIFIÉE SceneEntity ↔ Combatant : le combattant spawné GARDE l'id de l'entité de scène
 * qui l'a enrôlé (plus de ré-ID `enemy-${i}`). Conséquences vérifiées ici : parité d'apparence
 * explo↔combat (même seed), et réconciliation post-combat (les vaincus quittent la scène).
 */

function startFixtureCombat() {
  const hero = createHero({ speciesId: 'humains-reiklander', careerId: 'soldat', name: 'H', rng: makeRNG(1) });
  useGame.setState({ party: [hero], battle: null });
  useGame.getState().startScene(testScene);
  useGame.getState().startCombat('enc-mutants');
}

function enrolledEntityIds(): string[] {
  const enc = useGame.getState().scene!.encounters.find((e) => e.id === 'enc-mutants')!;
  return (enc.members ?? []).map((m) => m.entityId);
}

/** Résout la cascade de fin de combat (Tests de Résistance maladie/Corruption influençables) — lance
 *  chaque étape puis valide, jusqu'à fermeture (`finishCombatEnd` → écran de victoire). No-op si aucune. */
function drainCombatEndCascade(): void {
  for (let guard = 0; guard < 30; guard++) {
    const p = useGame.getState().pendingCascade;
    if (!p?.combatEndBoundary) break;
    const cur = p.participants[p.cursor];
    if (cur?.target != null && !cur.result) useGame.getState().cascadeRoll(cur.id);
    useGame.getState().cascadeNext();
  }
}

describe('Identité unifiée SceneEntity ↔ Combatant (fix embuscade)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllTimers();
    useGame.setState({ battle: null });
  });
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('les ennemis spawnés portent l’id de leur SceneEntity (plus de enemy-${i})', () => {
    startFixtureCombat();
    const enemyIds = useGame.getState().battle!.combatants.filter((c) => c.kind === 'enemy').map((c) => c.id).sort();
    expect(enemyIds).toEqual([...enrolledEntityIds()].sort());
    // Chaque id de combattant correspond bien à une entité de la scène.
    const entIds = new Set(useGame.getState().scene!.entities.map((e) => e.id));
    for (const id of enemyIds) expect(entIds.has(id)).toBe(true);
  });

  it('apparence identique en exploration et en combat (même seed → même sexe/carrure)', () => {
    startFixtureCombat();
    const scene = useGame.getState().scene!;
    const enemy = useGame.getState().battle!.combatants.find((c) => c.kind === 'enemy')!;
    const ent = scene.entities.find((e) => e.id === enemy.id)!;
    const combat = enemyRigProfile(enemy);
    const explo = entityRigProfile(ent.ref!, ent.appearance?.seed ?? hashSeed(ent.id), {
      species: ent.appearance?.species, tenue: ent.appearance?.tenue, sex: ent.appearance?.sex, build: ent.appearance?.build,
    });
    expect(combat).toBeTruthy();
    expect(explo).toBeTruthy();
    expect(combat!.appearance.seed).toBe(explo!.appearance.seed);
    expect(combat!.appearance.sex).toBe(explo!.appearance.sex);
    expect(combat!.appearance.build).toBe(explo!.appearance.build);
  });

  it('victoire : les ennemis vaincus quittent la scène ; un badaud non enrôlé reste', () => {
    startFixtureCombat();
    // Badaud non enrôlé (PNJ d'ambiance) : doit survivre à la fin du combat.
    const sc = useGame.getState().scene!;
    sc.entities.push({ id: 'badaud', kind: 'personnage', pos: { x: 2, y: 2 }, ref: 'mutant' });
    useGame.setState({ scene: { ...sc } });

    const ids = enrolledEntityIds();
    const b = useGame.getState().battle!;
    for (const c of b.combatants) if (c.kind === 'enemy') c.dead = true;
    useGame.setState({ battle: { ...b } });
    checkBattleOver(useGame.getState, useGame.setState);
    // Les mutants portent le Trait Corruption (Mineure) → cascade de fin de combat (Test de Résistance
    // INFLUENÇABLE) AVANT l'écran de victoire. On la résout pour atteindre la victoire (+ réconciliation).
    drainCombatEndCascade();

    expect(useGame.getState().battle!.over).toBe('victory');
    const remaining = new Set(useGame.getState().scene!.entities.map((e) => e.id));
    for (const id of ids) expect(remaining.has(id)).toBe(false);
    expect(remaining.has('badaud')).toBe(true);
  });

  it('défaite : les ennemis survivants restent dans la scène', () => {
    startFixtureCombat();
    const ids = enrolledEntityIds();
    const b = useGame.getState().battle!;
    for (const c of b.combatants) if (c.kind === 'hero') c.dead = true;
    useGame.setState({ battle: { ...b } });
    checkBattleOver(useGame.getState, useGame.setState);

    expect(useGame.getState().battle!.over).toBe('defeat');
    const remaining = new Set(useGame.getState().scene!.entities.map((e) => e.id));
    for (const id of ids) expect(remaining.has(id)).toBe(true);
  });
});

describe('removeEntities — retrait par lot (brique partagée)', () => {
  it('retire les ids donnés en un seul passage, ignore les inconnus, conserve le reste', () => {
    const scene: Scene = {
      id: 's', nom: '', description: '', dimensions: { w: 4, h: 4 },
      levels: [{ z: 0, tiles: new Array(16).fill('herbe') }],
      entities: (['a', 'b', 'c'] as const).map((id): SceneEntity => ({ id, kind: 'personnage', pos: { x: 0, y: 0 } })),
      dialogues: [], triggers: [], encounters: [], flags: {},
    };
    let stored: Scene = scene;
    const get = (() => ({ scene: stored })) as never;
    const set = ((patch: { scene: Scene }) => { stored = patch.scene; }) as never;
    removeEntities(get, set, ['a', 'c', 'inconnu']);
    expect(stored.entities.map((e) => e.id)).toEqual(['b']);
  });
});
