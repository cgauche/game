import { describe, it, expect } from 'vitest';
import { resolveBattery } from './shipBattery';
import type { Combatant, ShipPoste, SkillInstance } from '../engine/types';
import type { FireArc } from '../engine/types';
import type { RNG } from '../engine/dice';
import { useGame } from './store';
import { seedBattleRng } from './battleRng';
import { rollCrewRole } from './shipManeuver';
import { makeRNG } from '../engine/dice';

/** Combattant d'équipage minimal (carac d'instance = Dex → valeur prévisible). Calqué sur crew-roles.test.ts. */
const mk = (chars: Partial<Record<string, number>>, skills: { skillId: string; advances: number; spec?: string }[] = []): Combatant =>
  ({
    characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30, ...chars },
    skills: skills.map((s) => ({ ...s, characteristic: 'Dex' }) as SkillInstance),
    conditions: [], talents: [],
  }) as unknown as Combatant;
const seq = (values: number[]): RNG => { let i = 0; return { int: () => values[i++] }; };

const poste = (side: FireArc, uid: string): ShipPoste => ({ item: { uid, name: `Canon ${side}` } as never, side });
const hull = (postes: ShipPoste[]): Combatant =>
  ({ id: 'hull', name: 'Galère', pos: { x: 5, y: 5 }, postes, conditions: [], weapons: [] }) as unknown as Combatant;
const target = (x: number, y: number): Combatant =>
  ({ id: 'cible', name: 'Cible', pos: { x, y }, conditions: [], weapons: [] }) as unknown as Combatant;
const artilleur = () => mk({ Dex: 80 }, [{ skillId: 'projectiles', advances: 0, spec: 'Poudre noire' }]); // valeur 80

/**
 * Tir de batterie (MDG ch.14 l.126-130) : « le total de DR s'applique à toutes les armes à feu tournées vers
 * l'ennemi ». Le résolveur PUR détermine la bordée qui porte + ses pièces + le DR PARTAGÉ (Test d'équipage
 * Artilleur essentiel). L'application par pièce (Dégâts + DR) est le suivi (flux/modale).
 */
describe('resolveBattery — lâcher une bordée (DR partagé, MDG ch.14)', () => {
  it('cap Nord, cible plein EST → bordée TRIBORD ; seules SES pièces tirent ; DR = total du Test d’équipage', () => {
    const h = hull([poste('tribord', 't1'), poste('tribord', 't2'), poste('babord', 'b1')]);
    const plan = resolveBattery(h, target(9, 5), 'N', [{ crew: artilleur(), roleId: 'artilleur' }], 80, seq([30]))!;
    expect(plan.side).toBe('tribord');
    expect(plan.postes.map((p) => p.item.uid)).toEqual(['t1', 't2']); // pas la pièce bâbord
    expect(plan.dr).toBe(plan.crewTest.total); // le DR partagé = le total du Test d'équipage
    expect(plan.crewTest.contributions[0].essential).toBe(true); // Artilleur = rôle ESSENTIEL (DR ×2)
  });

  it('cible plein OUEST → bordée BÂBORD (le bord opposé tire)', () => {
    const h = hull([poste('tribord', 't1'), poste('babord', 'b1'), poste('babord', 'b2')]);
    const plan = resolveBattery(h, target(1, 5), 'N', [{ crew: artilleur(), roleId: 'artilleur' }], 80, seq([30]))!;
    expect(plan.side).toBe('babord');
    expect(plan.postes.map((p) => p.item.uid)).toEqual(['b1', 'b2']);
  });

  it('aucune pièce sur la bordée qui porte → null (rien à lâcher, pas de Test gaspillé)', () => {
    const h = hull([poste('babord', 'b1')]); // que bâbord ; cible à l'est → tribord
    expect(resolveBattery(h, target(9, 5), 'N', [{ crew: artilleur(), roleId: 'artilleur' }], 80, seq([30]))).toBeNull();
  });

  it('positions non résolues → null (défensif)', () => {
    const h = hull([poste('tribord', 't1')]);
    h.pos = undefined as never;
    expect(resolveBattery(h, target(9, 5), 'N', [], 80, seq([30]))).toBeNull();
  });
});

// ── Flux JOUABLE (store) : Test d'équipage MULTI des Artilleurs → volée sur la coque (jumeau de la manœuvre). ──
const gunnerPJ = (): Combatant =>
  ({ id: 'gunner', name: 'Artilleur', kind: 'hero',
    characteristics: { CC: 30, CT: 40, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
    wounds: { current: 10, max: 10 }, advantage: 0, conditions: [], fortune: 2, resilience: 1,
    skills: [{ skillId: 'projectiles', spec: 'Poudre noire', characteristic: 'CT', advances: 30 }], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos: { x: 5, y: 5 } }) as unknown as Combatant;
const battPoste = (): ShipPoste =>
  ({ side: 'tribord', item: { uid: 'canon', name: 'Canon moyen', kind: 'ranged', damage: { flat: 14, plusBF: false }, range: 75, qualities: [{ id: 'recharge', value: 6 }] }, crewIds: ['gunner'] }) as unknown as ShipPoste;
const firingShip = (): Combatant =>
  ({ id: 'ship', name: 'Frégate', kind: 'npc', bodyShape: 'vehicule', creatureId: 'bateau-de-patrouille', crewIds: ['gunner'], postes: [battPoste()], pos: { x: 5, y: 5 }, conditions: [], weapons: [] }) as unknown as Combatant;
const enemyHull = (pos = { x: 9, y: 5 }): Combatant =>
  ({ id: 'target', name: 'Caraque', kind: 'enemy', bodyShape: 'vehicule', creatureId: 'knarr', pos,
    characteristics: { CC: 0, CT: 0, F: 0, E: 40, I: 0, Ag: 0, Dex: 0, Int: 0, FM: 0, Soc: 0 },
    wounds: { current: 90, max: 90, base: 90 }, advantage: 0, conditions: [], weapons: [], armour: { corps: 0 }, skills: [], talents: [], crewIds: [] }) as unknown as Combatant;

describe('flux shipBattery (store) — bordée jouable bout-en-bout (MDG ch.14 l.128)', () => {
  it('battleShipBattery ouvre le Test des Artilleurs (bord auto) ; roll ; Feu ! → la coque encaisse', () => {
    seedBattleRng(7);
    useGame.setState({ battle: { combatants: [firingShip(), gunnerPJ(), enemyHull()], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never, party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, scene: null as never });
    useGame.getState().battleShipBattery('ship', 'target');
    const p = useGame.getState().pendingShipBattery!;
    expect(p.side).toBe('tribord'); // cible plein est, cap N → bordée tribord
    expect(p.participants.some((x) => x.id === 'gunner' && x.essential)).toBe(true); // l'Artilleur est ESSENTIEL (★)
    const before = useGame.getState().battle!.combatants.find((c) => c.id === 'target')!.wounds.current;
    useGame.getState().shipBatteryRoll('gunner'); // le PJ Artilleur lance SON jet
    expect(useGame.getState().pendingShipBattery!.participants.every((x) => x.result)).toBe(true);
    useGame.getState().shipBatteryConfirm();
    expect(useGame.getState().pendingShipBattery).toBeNull();
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'target')!.wounds.current).toBeLessThan(before); // la coque encaisse
  });

  it('aucune pièce ne porte sur le bord visé (cible en proue, pièces à tribord) → n’ouvre rien', () => {
    seedBattleRng(7);
    useGame.setState({ battle: { combatants: [firingShip(), gunnerPJ(), enemyHull({ x: 5, y: 1 })], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never, party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, scene: null as never });
    useGame.getState().battleShipBattery('ship', 'target');
    expect(useGame.getState().pendingShipBattery).toBeNull();
  });

  it('Recharge : une pièce qui a tiré est muette N Rounds (pas de 2e bordée avant rechargement, MDG ch.12)', () => {
    seedBattleRng(7);
    useGame.setState({ battle: { combatants: [firingShip(), gunnerPJ(), enemyHull()], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never, party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, scene: null as never });
    useGame.getState().battleShipBattery('ship', 'target');
    useGame.getState().shipBatteryRoll('gunner');
    useGame.getState().shipBatteryConfirm();
    const poste = useGame.getState().battle!.combatants.find((c) => c.id === 'ship')!.postes![0];
    expect(poste.reloadUntilRound).toBe(7); // Round 1 + Recharge 6 → re-disponible au Round 7
    useGame.getState().battleShipBattery('ship', 'target'); // 2e bordée même Round → pièce en recharge → aucune ne porte
    expect(useGame.getState().pendingShipBattery).toBeNull();
  });

  it('équipage-ressource : après une bordée, les contributeurs sont marqués « engagés ce Round » (crewActed)', () => {
    seedBattleRng(7);
    useGame.setState({ battle: { combatants: [firingShip(), gunnerPJ(), enemyHull()], order: ['ship'], turn: 0, round: 1, acted: false, log: [] } as never, party: [gunnerPJ()], facing: { ship: 'N' }, pendingShipBattery: null, scene: null as never });
    useGame.getState().battleShipBattery('ship', 'target');
    useGame.getState().shipBatteryRoll('gunner');
    useGame.getState().shipBatteryConfirm();
    expect(useGame.getState().battle!.crewActed?.['ship']).toContain('gunner'); // l'Artilleur a agi ce Round
  });
});

describe('rollCrewRole — cumul de rôles (Manque de bras, MDG ch.14 l.53)', () => {
  const cap = (): Combatant =>
    ({ id: 'cap', name: 'Cap', characteristics: { CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 },
      skills: [{ skillId: 'commandement', characteristic: 'Soc', advances: 30 }], conditions: [], talents: [] }) as unknown as Combatant;

  it('cumul → +2 crans de Difficulté : cible PLUS DURE (−20) qu\'un jet normal, même dé', () => {
    const normal = rollCrewRole(cap(), 'capitaine', makeRNG(5))!;
    const cumul = rollCrewRole(cap(), 'capitaine', makeRNG(5), true)!;
    expect(cumul.target).toBe(normal.target - 20); // Intermédiaire (+0) → +2 crans = Difficile (−20)
  });
});
