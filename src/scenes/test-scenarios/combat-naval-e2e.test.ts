import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useGame } from '../../state/store';
import { testScenarios } from './index';
import { seedBattleRng } from '../../state/battleRng';
import { checkBattleOver } from '../../state/combatFlow';
import { resolveShipUnits } from '../../state/shipCrew';
import { rederivePassiveAttack } from '../../engine/combat';
import { loseWounds, isOutOfAction } from '../../engine/conditions';
import { pathTo } from '../../state/path';
import { moveEnv } from '../../state/combatGeometry';
import { combatDistance } from '../../state/footprint';
import { placeCombatant } from '../../state/spawn';
import type { Combatant, Weapon } from '../../engine/types';
import type { Scene } from '../../state/scene';
import type { BattleState } from '../../state/store';
import type { TestResult } from '../../engine/tests';

const scen = testScenarios.find((s) => s.id === 'combat-naval')!;
const COGUE = 'enemy-enc-naval-0';

/** Lance le scénario EXACTEMENT comme le menu (setParty → loadProject → startCombat), timers gelés pour que la
 *  boucle d'IA (setTimeout) ne se déclenche pas : on PILOTE le combat pas à pas (jets déterministes). */
function launch(seed = 7): BattleState {
  vi.useFakeTimers(); // fige la chorégraphie d'IA (setTimeout) — restaurée par le afterEach global (test-setup)
  const g = useGame.getState();
  seedBattleRng(seed);
  g.setParty(scen.makeParty());
  g.loadProject([scen.scene, ...(scen.extraScenes ?? [])], scen.scene.id, scen.worldMap ?? null);
  g.startCombat(scen.autoCombat!);
  if (useGame.getState().pendingRoundStart) useGame.getState().confirmRoundStart();
  return useGame.getState().battle!;
}

const byId = (b: BattleState, id: string) => b.combatants.find((c) => c.id === id)!;

/** Jet de touche RÉUSSI déterministe (le boarder/canonnier place ses coups) — la RÉSOLUTION (Dégâts, coque,
 *  Tailles, BE) reste celle du moteur réel via `rederivePassiveAttack`. */
const goodHit: TestResult = { roll: 6, target: 70, success: true, sl: 5, isDouble: false } as TestResult;

/** Fait TRAVERSER `mover` jusqu'au contact de `target` : trouve une case adjacente ATTEIGNABLE (chemin réel,
 *  empreintes respectées), l'y place, et noue l'Engagement mutuel. Renvoie le chemin (preuve de traversée). */
function boardOnto(battle: BattleState, scene: Scene, mover: Combatant, target: Combatant): { x: number; y: number }[] | null {
  const env = moveEnv(battle, mover);
  const t = target.pos!;
  const neigh = [
    { x: t.x - 1, y: t.y }, { x: t.x + 1, y: t.y }, { x: t.x, y: t.y - 1 }, { x: t.x, y: t.y + 1 },
    { x: t.x - 1, y: t.y - 1 }, { x: t.x + 1, y: t.y - 1 }, { x: t.x - 1, y: t.y + 1 }, { x: t.x + 1, y: t.y + 1 },
  ];
  for (const dest of neigh) {
    if (dest.x < 0 || dest.y < 0 || dest.x >= scene.dimensions.w || dest.y >= scene.dimensions.h) continue;
    const path = pathTo(scene, mover.pos!, dest, env);
    if (!path) continue;
    placeCombatant(mover, scene, dest);
    mover.engagedWith = [...new Set([...(mover.engagedWith ?? []), target.id])];
    target.engagedWith = [...new Set([...(target.engagedWith ?? []), mover.id])];
    return path;
  }
  return null;
}

/** Le boarder abat une cible au corps à corps (blessures RÉELLES du moteur), jusqu'à ce qu'elle soit hors de
 *  combat (Mort Subite du figurant à 0 PB). Renvoie le nombre de coups portés (borné, anti-boucle). */
function meleeDown(attacker: Combatant, target: Combatant): number {
  const weapon = (attacker.weapons.find((w) => w.type === 'melee') ?? attacker.weapons[0]) as Weapon;
  let blows = 0;
  while (!isOutOfAction(target) && blows < 20) {
    const res = rederivePassiveAttack(attacker, target, weapon, goodHit, 'melee');
    if (res.hit && res.woundsLost) loseWounds(target, res.woundsLost);
    blows++;
  }
  return blows;
}

/** Résout une éventuelle cascade de fin de combat (maladie/Corruption) pour atteindre l'écran de victoire. */
function settle(): void {
  checkBattleOver(() => useGame.getState(), useGame.setState);
  if (useGame.getState().pendingCascade?.combatEndBoundary) {
    useGame.getState().cascadeResolveAll();
    useGame.getState().cascadeFinish();
  }
}

beforeEach(() => vi.useRealTimers());

/**
 * Test PUR de la résolution NAVIRE-UNITÉ (abordage & naufrage) — les deux issues, indépendamment du scénario.
 */
describe('resolveShipUnits — le navire est une UNITÉ (naufrage OU abordage)', () => {
  const mk = (id: string, patch: Partial<Combatant> = {}): Combatant =>
    ({ id, name: id, kind: 'enemy', wounds: { current: 10, max: 10 }, conditions: [], weapons: [], ...patch }) as unknown as Combatant;

  it('coque COULÉE (0 PB) → l\'équipage encore debout passe par-dessus bord (outOfRencontre)', () => {
    const hull = mk('h', { bodyShape: 'vehicule', wounds: { current: 0, max: 50 } as never, crewIds: ['a', 'b'] });
    const a = mk('a'); const b = mk('b');
    const lines = resolveShipUnits([hull, a, b]);
    expect(a.outOfRencontre).toBe(true);
    expect(b.outOfRencontre).toBe(true);
    expect(lines.join(' ')).toMatch(/sombre/);
  });

  it('équipage TOUT vaincu → la coque intacte est prise et quitte le combat (outOfRencontre)', () => {
    const hull = mk('h', { bodyShape: 'vehicule', wounds: { current: 50, max: 50 } as never, crewIds: ['a', 'b'] });
    const a = mk('a', { dead: true }); const b = mk('b', { wounds: { current: 0, max: 10 } as never, dead: true });
    resolveShipUnits([hull, a, b]);
    expect(hull.outOfRencontre).toBe(true);
    expect(isOutOfAction(hull)).toBe(true);
  });

  it('coque SANS équipage déclaré → jamais « prise » d\'office (résolue par ses seules Blessures)', () => {
    const hull = mk('h', { bodyShape: 'vehicule', wounds: { current: 50, max: 50 } as never });
    resolveShipUnits([hull]);
    expect(hull.outOfRencontre).toBeUndefined();
  });
});

/**
 * BOUT-EN-BOUT depuis le menu : l'ABORDAGE se joue vraiment (le boarder TRAVERSE, ENGAGE, VAINC l'équipage) et
 * la victoire se déclenche — la cogue est PRISE à l'abordage (elle n'est pas entamable en mêlée : table des Tailles).
 */
describe('Combat naval e2e — VICTOIRE par ABORDAGE', () => {
  it('le Tueur traverse jusqu\'aux pirates, les abat, et la cogue crewless est prise → victoire', () => {
    const battle = launch(11);
    const scene = useGame.getState().scene!;
    const tueur = byId(battle, 'pregen-202'); // boarder de mêlée (le Tueur du groupe d'arène)
    const cogue = byId(battle, COGUE);
    const crewIds = [...cogue.crewIds!];

    // au départ, personne n'a gagné, et la cogue compte comme un ennemi vivant
    expect(battle.over).toBeFalsy();
    expect(checkBattleOver(() => useGame.getState(), useGame.setState)).toBe(false);

    for (const id of crewIds) {
      const pirate = byId(battle, id);
      const path = boardOnto(battle, scene, tueur, pirate); // TRAVERSÉE : chemin réel jusqu'au contact
      expect(path, `abordage injouable : aucun chemin vers ${id}`).not.toBeNull();
      expect(combatDistance(tueur, pirate)).toBeLessThanOrEqual(1); // ENGAGÉ
      const blows = meleeDown(tueur, pirate); // VAINCU au corps à corps
      expect(isOutOfAction(pirate), `le pirate ${id} n'est pas tombé en ${blows} coups`).toBe(true);
    }

    // équipage vaincu → la cogue (invulnérable en mêlée) est PRISE, plus aucun ennemi debout → VICTOIRE
    settle();
    const b2 = useGame.getState().battle!;
    expect(isOutOfAction(byId(b2, COGUE))).toBe(true); // prise à l'abordage
    expect(b2.over).toBe('victory');
  });
});

/**
 * BOUT-EN-BOUT : victoire par le NAUFRAGE — la bordée (artillerie servie) coule la cogue, dont l'équipage passe
 * par-dessus bord. On tire depuis le canon SERVI du poste (arme d'artillerie dérivée), résolution moteur réelle.
 */
describe('Combat naval e2e — VICTOIRE par NAUFRAGE', () => {
  it('les pierriers coulent la cogue ; l\'équipage sombre avec elle → victoire', () => {
    const battle = launch(23);
    const cogue = byId(battle, COGUE);
    // canonnier + son pierrier SERVI (arme d'artillerie dérivée par applyShipPostes au démarrage)
    const gunner = battle.combatants.find((c) => c.kind === 'hero' && c.mannedPoste)!;
    expect(gunner).toBeTruthy();
    const piece = gunner.weapons.find((w) => w.subType === 'armes-de-siege')! as Weapon;
    expect(piece).toBeTruthy();

    let shots = 0;
    while (cogue.wounds.current > 0 && shots < 20) {
      const res = rederivePassiveAttack(gunner, cogue, piece, goodHit, 'ranged');
      if (res.hit && res.woundsLost) loseWounds(cogue, res.woundsLost);
      shots++;
    }
    expect(cogue.wounds.current).toBe(0); // coque coulée par l'artillerie (Dégâts − BE − Blindage)

    settle();
    const b2 = useGame.getState().battle!;
    // équipage passé par-dessus bord (outOfRencontre) → plus aucun ennemi debout → VICTOIRE
    for (const id of cogue.crewIds!) expect(isOutOfAction(byId(b2, id))).toBe(true);
    expect(b2.over).toBe('victory');
  });
});
