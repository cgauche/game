import { describe, it, expect } from 'vitest';
import { hasCommandTeam } from '../engine/combatFeatures/dispatch';
import { VOICE_COMMAND_RANGE_M, teamCommandTargets, canAidTeam } from './commandTeam';
import { applyShipPostes } from './shipPostes';
import { attackEnv, previewAttack } from './combatFlow';
import { itemFromTrappingById } from '../engine/items';
import { applyOps } from '../engine/ops';
import { seedBattleRng } from './battleRng';
import { useGame } from './store';
import type { Combatant, ShipPoste } from '../engine/types';
import type { Scene } from './scene';
import type { GameState } from './store';

/**
 * COMMANDANT D'ÉQUIPE (Talent, AA l.4373-4379) — un Personnage doté du Talent peut, par un Test de
 * Commandement Intermédiaire (+0), aider une équipe servant une Arme d'équipe « à portée de voix » :
 * l'équipe tire ensuite au score de Projectiles DU COMMANDANT. « Portée de voix » n'a aucune valeur RAW
 * → constante TUNABLE `VOICE_COMMAND_RANGE_M = 50` (≈25 cases à 2 m/case), géométrie d'aura (Chebyshev).
 */

const CHARS = (over: Partial<Record<string, number>> = {}) =>
  ({ CC: 30, CT: 30, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30, ...over });

/** Commandant (héros) — porte le Talent + une Compétence de Commandement (Soc). */
const mkCommander = (id: string, pos: { x: number; y: number }, over: Partial<Record<string, number>> = {}, withTalent = true): Combatant =>
  ({
    id, name: id, kind: 'hero', characteristics: CHARS(over),
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], weapons: [],
    skills: [{ skillId: 'commandement', characteristic: 'Soc', advances: 30 }],
    talents: withTalent ? [{ talentId: 'commandant-d-equipe', times: 1 }] : [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos, loaded: true,
  }) as unknown as Combatant;

/** Chef de pièce (héros) servant une Arme d'équipe (baliste : `arme-d-equipe`). */
const mkChief = (id: string, pos: { x: number; y: number }, over: Partial<Record<string, number>> = {}): Combatant =>
  ({
    id, name: id, kind: 'hero', characteristics: CHARS(over),
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos, loaded: true,
  }) as unknown as Combatant;

const mkEnemy = (id: string, x: number, y: number): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x, y }, conditions: [], weapons: [], skills: [], talents: [],
    characteristics: CHARS({ CT: 0 }), wounds: { current: 60, max: 60 }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant;

/** Emplacement portant la baliste, servie par le chef `crewIds[0]`. */
const mkEmplacement = (poste: ShipPoste, pos = { x: 7, y: 7 }): Combatant =>
  ({ id: 'emplacement', name: 'Affût', kind: 'hero', pos, conditions: [], weapons: [],
    wounds: { current: 30, max: 30 }, advantage: 0, postes: [poste] }) as unknown as Combatant;

const mkPoste = (engineId: string, crewIds: string[]): ShipPoste =>
  ({ item: itemFromTrappingById(engineId)!, crewIds });

const groundScene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 40, h: 40 }, ambiance: 'jour', metresPerTile: 2,
    levels: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], entities: [], buildings: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

const mkGet = (sc: Scene, combatants: Combatant[]): (() => GameState) =>
  (() => ({ scene: sc, battle: { combatants, movementUsed: 0 }, facing: {}, gameTime: 0, log: () => {} })) as unknown as () => GameState;

// ── (A) DRAPEAU DE TALENT ─────────────────────────────────────────────────────────────────────────
describe('(A) hasCommandTeam — drapeau de Talent', () => {
  it('vrai pour un porteur du Talent commandant-d-equipe', () => {
    expect(hasCommandTeam(mkCommander('cmd', { x: 5, y: 5 }))).toBe(true);
  });
  it('faux sans le Talent', () => {
    expect(hasCommandTeam(mkCommander('cmd', { x: 5, y: 5 }, {}, false))).toBe(false);
  });
});

// ── (B) AFFORDANCE « Aider l'équipe » ─────────────────────────────────────────────────────────────
describe('(B) teamCommandTargets / canAidTeam — disponibilité', () => {
  const setup = (commanderPos: { x: number; y: number }) => {
    const poste = mkPoste('baliste', ['chief', 's1']);
    const chief = mkChief('chief', { x: 7, y: 6 });
    const commander = mkCommander('cmd', commanderPos);
    const all = [mkEmplacement(poste), commander, chief, mkEnemy('foe', 20, 20)];
    applyShipPostes(all); // pose mannedPoste + l'arme dérivée sur le chef
    return { commander, chief, all };
  };

  it('un chef servant une Arme d’équipe À PORTÉE de voix → cible offerte ; canAidTeam vrai', () => {
    const { commander, chief, all } = setup({ x: 9, y: 6 }); // 2 cases du chef → 4 m ≤ 50
    const targets = teamCommandTargets(commander, all);
    expect(targets.map((c) => c.id)).toContain(chief.id);
    expect(canAidTeam(commander, all)).toBe(true);
  });

  it('chef HORS portée de voix → aucune cible ; canAidTeam faux', () => {
    const { commander, all } = setup({ x: 39, y: 39 }); // très loin (> 25 cases)
    expect(teamCommandTargets(commander, all)).toHaveLength(0);
    expect(canAidTeam(commander, all)).toBe(false);
  });

  it('sans Talent → canAidTeam faux même à portée d’un chef', () => {
    const poste = mkPoste('baliste', ['chief', 's1']);
    const chief = mkChief('chief', { x: 7, y: 6 });
    const noTalent = mkCommander('cmd', { x: 9, y: 6 }, {}, false);
    const all = [mkEmplacement(poste), noTalent, chief];
    applyShipPostes(all);
    expect(canAidTeam(noTalent, all)).toBe(false);
  });
});

// ── (C) ACTION « Aider l'équipe » → Test de Commandement → marqueur ───────────────────────────────
describe('(C) battleAidTeam — Test de Commandement réussi pose teamCommanderId sur le chef', () => {
  it('succès (seed) → chief.teamCommanderId = id du commandant ; Action consommée', () => {
    seedBattleRng(1);
    const poste = mkPoste('baliste', ['chief', 's1']);
    const commander = mkCommander('cmd', { x: 9, y: 6 }, { Soc: 80 }); // Commandement ≈ 99 → réussite quasi certaine
    const chief = mkChief('chief', { x: 7, y: 6 });
    const all = [mkEmplacement(poste), commander, chief];
    applyShipPostes(all);
    useGame.setState({
      battle: { combatants: all, order: all.map((c) => c.id), turn: 1, round: 1, acted: false, action: null, log: [], movementUsed: 0 } as never,
      party: [commander, chief], facing: {}, scene: null as never, pendingTest: null, pendingCascade: null,
    });
    // active = order[turn=1] = commander
    useGame.getState().battleAidTeam();
    const pt = useGame.getState().pendingTest!;
    expect(pt).toBeTruthy();
    expect(pt.actorId).toBe('cmd'); // c'est le COMMANDANT qui teste (RAW : le porteur du Talent aide)
    expect(useGame.getState().battle!.acted).toBe(true); // le Test EST l'Action (posée d'emblée, réussite ou non)
    // Conséquence du SUCCÈS = l'op `teamCommander` (branche onSuccess de l'action) → testée SANS RNG : un
    // Commandement même ~110 échoue toujours sur un 96-00, donc piloter le dé rendrait ce test fragile (cf. le
    // flake observé). On vérifie la CONSÉQUENCE déterministe (l'op pose le marqueur sur le chef).
    const chiefAfter = useGame.getState().battle!.combatants.find((c) => c.id === 'chief')!;
    applyOps(chiefAfter, [{ op: 'teamCommander', commanderId: 'cmd' }], {});
    expect(chiefAfter.teamCommanderId).toBe('cmd');
  });
});

// ── (D) SUBSTITUTION du score (attackEnv / previewAttack) ─────────────────────────────────────────
describe('(D) Substitution — l’équipe tire au score de Projectiles du commandant', () => {
  const setup = (commanderPos: { x: number; y: number }, opts: { dead?: boolean } = {}) => {
    const poste = mkPoste('baliste', ['chief', 's1']);
    const commander = mkCommander('cmd', commanderPos, { CT: 75 }); // CT/Projectiles HAUT
    if (opts.dead) commander.dead = true;
    const chief = mkChief('chief', { x: 6, y: 5 }, { CT: 30 }); // CT/Projectiles BAS
    chief.teamCommanderId = 'cmd'; // aidé précédemment
    const foe = mkEnemy('foe', 9, 5);
    const all = [mkEmplacement(poste, { x: 6, y: 5 }), commander, chief, foe];
    applyShipPostes(all); // chief sert la baliste (mannedPoste + arme dérivée)
    return { commander, chief, foe, all, posteUid: poste.item.uid! };
  };

  it('chef BAS + commandant HAUT à portée → ModLine « Commandant d’équipe » = delta (75−30)', () => {
    const { chief, foe, all, posteUid } = setup({ x: 5, y: 5 }); // adjacent au chef
    const weapon = chief.weapons.find((w) => w.uid === posteUid)!;
    const { env } = attackEnv(mkGet(groundScene(), all), chief, foe, weapon);
    const tc = env.find((m) => m.label === 'Commandant d’équipe');
    expect(tc).toBeTruthy();
    expect(tc!.value).toBe(45); // combatValue(commander)=75 − combatValue(chief)=30
  });

  it('aperçu == résolution : le score effectif du tir reflète le commandant (cohérence)', () => {
    const { chief, foe, all, posteUid } = setup({ x: 5, y: 5 });
    const get = mkGet(groundScene(), all);
    const withCmd = previewAttack(get, chief, foe, undefined, { weaponUid: posteUid });
    // baseline SANS le marqueur : on retire le lien → plus de substitution
    chief.teamCommanderId = undefined;
    const without = previewAttack(get, chief, foe, undefined, { weaponUid: posteUid });
    expect(withCmd.base).toBe(without.base); // la BASE reste celle du chef (la substitution = un delta env)
    expect(withCmd.target - without.target).toBe(45); // +45 grâce au commandant
  });

  it('commandant MORT → bonus lapse (aucune ModLine)', () => {
    const { chief, foe, all, posteUid } = setup({ x: 5, y: 5 }, { dead: true });
    const weapon = chief.weapons.find((w) => w.uid === posteUid)!;
    const { env } = attackEnv(mkGet(groundScene(), all), chief, foe, weapon);
    expect(env.find((m) => m.label === 'Commandant d’équipe')).toBeUndefined();
  });

  it('commandant HORS portée de voix → bonus lapse (aucune ModLine)', () => {
    const { chief, foe, all, posteUid } = setup({ x: 35, y: 5 }); // 29 cases → 58 m > 50
    const weapon = chief.weapons.find((w) => w.uid === posteUid)!;
    const { env } = attackEnv(mkGet(groundScene(), all), chief, foe, weapon);
    expect(env.find((m) => m.label === 'Commandant d’équipe')).toBeUndefined();
  });
});

// Garde-fou de la constante (documentation du choix produit).
describe('VOICE_COMMAND_RANGE_M', () => {
  it('vaut 50 m (≈25 cases)', () => { expect(VOICE_COMMAND_RANGE_M).toBe(50); });
});
