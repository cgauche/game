import { describe, it, expect } from 'vitest';
import { servablePostes, serveAtPoste, leaveChef, isPosteManned, applyShipPostes } from './shipPostes';
import { firedWeapon, resolveAttack, buildAiInput } from './combatFlow';
import { chooseEnemyAction, type EnemyTurnInput } from './ai';
import { itemFromTrappingById } from '../engine/items';
import { seedBattleRng } from './battleRng';
import { useGame } from './store';
import { emptyScene } from './scene';
import type { Combatant, ShipPoste, Weapon } from '../engine/types';
import type { FireArc } from './fireArc';
import type { Scene } from './scene';
import type { GameState } from './store';

/**
 * « SERVIR CETTE PIÈCE » (manning runtime, MDG ch.12-13) — l'action de combat KIND-AGNOSTIQUE par laquelle
 * tout combattant (héros / PNJ / ennemi) ADJACENT à un emplacement portant un poste NON servi en devient le
 * chef : il prend la tête de l'équipage (`crewIds[0]`), pose le lien `mannedPoste`, et l'arme de siège dérivée
 * apparaît dans ses `weapons` (taguée `mountSide`). RÉUTILISE la logique de service d'`applyShipPostes`
 * (factorisée en `serveChef`). « Quitter la pièce » (`leaveChef`) libère le poste pour un autre.
 *
 * « Tout le monde peut servir une arme de siège » (user) → la disponibilité (`servablePostes`) et la mutation
 * (`serveAtPoste`/`leaveChef`) ne regardent JAMAIS le `kind` ; l'affordance JOUEUR (`battleManPoste`/
 * `battleLeavePoste`) et l'énumération IA (`buildAiInput.servablePostes` → `chooseEnemyAction` candidat
 * `manPoste`) consomment la MÊME source.
 */

const CHARS = (CT = 75) =>
  ({ CC: 30, CT, F: 30, E: 30, I: 30, Ag: 30, Dex: 30, Int: 30, FM: 30, Soc: 30 });

const mkActor = (id: string, kind: 'hero' | 'npc' | 'enemy', pos: { x: number; y: number }, CT = 75): Combatant =>
  ({
    id, name: id, kind, characteristics: CHARS(CT),
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [], weapons: [],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 }, movement: 4, pos, loaded: true,
  }) as unknown as Combatant;

const mkCrewman = (id: string, alive = true): Combatant =>
  ({ id, name: id, kind: 'npc', conditions: [], weapons: [], skills: [], talents: [], characteristics: CHARS(30) as never,
    dead: !alive, wounds: { current: alive ? 5 : 0, max: 5 } }) as unknown as Combatant;

const mkEnemyTarget = (id: string, x: number, y: number, E = 30, wounds = 60): Combatant =>
  ({ id, name: id, kind: 'enemy', pos: { x, y }, conditions: [], weapons: [], skills: [], talents: [],
    characteristics: { ...CHARS(0), E }, wounds: { current: wounds, max: wounds }, advantage: 0,
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 } }) as unknown as Combatant;

/** Emplacement AU SOL : une SceneEntity NON-navire qui PORTE la pièce (`postes`). */
const mkEmplacement = (poste: ShipPoste, pos = { x: 5, y: 5 }): Combatant =>
  ({ id: 'emplacement', name: 'Affût de baliste', kind: 'enemy', pos, conditions: [], weapons: [],
    wounds: { current: 30, max: 30 }, advantage: 0, postes: [poste] }) as unknown as Combatant;

const mkPoste = (engineId: string, crewIds: string[] = [], side?: FireArc): ShipPoste =>
  ({ item: itemFromTrappingById(engineId)!, crewIds, ...(side ? { side } : {}) });

const groundScene = (): Scene =>
  ({ id: 's', name: 's', dimensions: { w: 40, h: 40 }, ambiance: 'jour', metresPerTile: 2,
    levels: [{ z: 0, tiles: new Array(40 * 40).fill('herbe') }], entities: [], buildings: [], dialogues: [], triggers: [], encounters: [] }) as unknown as Scene;

const mkGet = (sc: Scene, combatants: Combatant[], facing: Record<string, string> = {}): (() => GameState) =>
  (() => ({ scene: sc, battle: { combatants, movementUsed: 0 }, facing, gameTime: 0, log: () => {} })) as unknown as () => GameState;

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (A) DISPONIBILITÉ kind-agnostique — `servablePostes` voit un poste NON servi pour un combattant adjacent.
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(A) Disponibilité — « Servir cette pièce » est offerte à TOUT combattant adjacent (kind-agnostique)', () => {
  it.each(['hero', 'npc', 'enemy'] as const)('un %s adjacent à un emplacement non servi → action disponible', (kind) => {
    const poste = mkPoste('baliste');
    const actor = mkActor('actor', kind, { x: 5, y: 6 });
    const list = servablePostes(actor, [mkEmplacement(poste), actor]);
    expect(list).toHaveLength(1);
    expect(list[0].poste.item.uid).toBe(poste.item.uid);
  });

  it('ADJACENCE — un combattant NON adjacent à l’emplacement → action indisponible', () => {
    const poste = mkPoste('baliste');
    const far = mkActor('far', 'hero', { x: 5, y: 10 }); // 5 cases au sud de l'emplacement (5,5)
    expect(servablePostes(far, [mkEmplacement(poste), far])).toHaveLength(0);
  });

  it('POSTE OCCUPÉ — un poste déjà servi (chef vivant) n’est PAS re-servable par un autre', () => {
    const poste = mkPoste('baliste', ['chef']);
    const emplacement = mkEmplacement(poste);
    const chef = mkActor('chef', 'npc', { x: 5, y: 6 });
    const other = mkActor('other', 'hero', { x: 6, y: 5 });
    const all = [emplacement, chef, other];
    applyShipPostes(all); // chef devient le servant (mannedPoste posé)
    expect(isPosteManned(poste, all)).toBe(true);
    expect(servablePostes(other, all)).toHaveLength(0); // pris → indisponible
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (B) SERVICE — `serveAtPoste` : devient chef (crewIds[0]) + `mannedPoste` + arme de siège octroyée. PUR.
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(B) Service — `serveAtPoste` rend chef tout combattant (mannedPoste, crewIds[0], arme dérivée)', () => {
  it.each(['hero', 'npc', 'enemy'] as const)('un %s sert : mannedPoste + tête d’équipage + baliste dans weapons', (kind) => {
    const poste = mkPoste('baliste', ['s1']); // s1 présent mais ne sert pas → poste non servi
    const actor = mkActor('gunner', kind, { x: 5, y: 6 });
    serveAtPoste(actor, poste);
    expect(actor.mannedPoste!.item.uid).toBe(poste.item.uid);
    expect(poste.crewIds![0]).toBe('gunner'); // inséré EN TÊTE
    const w = actor.weapons.find((x) => x.uid === poste.item.uid);
    expect(w?.type).toBe('ranged');
    expect(w?.subType).toBe('armes-de-siege');
  });

  it('le chef servant peut TIRER la pièce (firedWeapon → resolveAttack, seed fixe)', () => {
    seedBattleRng(1);
    const poste = mkPoste('baliste', ['s1']);
    const gunner = mkActor('gunner', 'hero', { x: 5, y: 5 }, 80);
    gunner.skills = [{ skillId: 'projectiles', spec: 'Arbalète', characteristic: 'CT', advances: 0 }] as never;
    const s1 = mkCrewman('s1');
    s1.skills = [{ skillId: 'projectiles', spec: 'Arbalète', characteristic: 'CT', advances: 0 }] as never; // équipe COMPLÈTE et qualifiée
    const cible = mkEnemyTarget('cible', 8, 5, 30, 60);
    const all = [mkEmplacement(poste), gunner, s1, cible];
    serveAtPoste(gunner, poste);
    const w = firedWeapon(gunner, cible, poste.item.uid, all);
    expect(w.uid).toBe(poste.item.uid); // c'est bien la baliste servie qui tire
    const get = mkGet(groundScene(), all, { gunner: 'N' });
    const r = resolveAttack(get, gunner, cible, undefined, false, false, false, poste.item.uid);
    expect(r).not.toBeNull();
    expect(r!.res.hit).toBe(true);
    expect(r!.res.woundsLost ?? 0).toBeGreaterThan(0);
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (C) RELEASE — `leaveChef` : retire le lien, sort de l'équipage, retire l'arme ; la pièce redevient servable.
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(C) Release — « Quitter la pièce » libère le poste pour un autre', () => {
  it('Quitter → mannedPoste retiré, id hors crewIds, arme retirée, re-servable par un autre', () => {
    const poste = mkPoste('baliste');
    const emplacement = mkEmplacement(poste);
    const chef = mkActor('chef', 'hero', { x: 5, y: 6 });
    const other = mkActor('other', 'enemy', { x: 6, y: 5 });
    const all = [emplacement, chef, other];

    serveAtPoste(chef, poste);
    expect(isPosteManned(poste, all)).toBe(true);
    expect(servablePostes(other, all)).toHaveLength(0);

    leaveChef(chef, poste);
    expect(chef.mannedPoste).toBeUndefined();
    expect(poste.crewIds).not.toContain('chef');
    expect(chef.weapons.some((w) => w.uid === poste.item.uid)).toBe(false);
    expect(isPosteManned(poste, all)).toBe(false);
    expect(servablePostes(other, all)).toHaveLength(1); // libérée → un autre peut servir
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (D) AFFORDANCE JOUEUR — `battleManPoste` / `battleLeavePoste` (store) sur le héros actif.
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(D) Affordance joueur — store `battleManPoste` / `battleLeavePoste`', () => {
  const setup = (mannedByActive = false) => {
    const poste = mkPoste('baliste', mannedByActive ? [] : ['s1']);
    const hero = mkActor('hero', 'hero', { x: 5, y: 6 }, 80);
    const s1 = mkCrewman('s1');
    const emplacement = mkEmplacement(poste);
    if (mannedByActive) serveAtPoste(hero, poste);
    useGame.setState({
      battle: { combatants: [emplacement, hero, s1], order: ['hero', 'emplacement', 's1'], turn: 0, round: 1, acted: false, log: [], crewActed: {} } as never,
      party: [hero], facing: {}, scene: groundScene() as never,
      pendingCleave: null, pendingDualStrike: null, pendingCast: null,
    });
    return { poste, hero };
  };

  it('le héros ACTIF prend la pièce adjacente : mannedPoste, crewIds[0], baliste, Action dépensée', () => {
    const { poste } = setup();
    useGame.getState().battleManPoste();
    const st = useGame.getState();
    const hero = st.battle!.combatants.find((c) => c.id === 'hero')!;
    expect(hero.mannedPoste!.item.uid).toBe(poste.item.uid);
    expect(poste.crewIds![0]).toBe('hero');
    expect(hero.weapons.some((w) => w.uid === poste.item.uid)).toBe(true);
    expect(st.battle!.acted).toBe(true); // servir coûte l'Action
  });

  it('Quitter libère la pièce : mannedPoste retiré, arme retirée, Action dépensée', () => {
    const { poste } = setup(true);
    useGame.getState().battleLeavePoste();
    const st = useGame.getState();
    const hero = st.battle!.combatants.find((c) => c.id === 'hero')!;
    expect(hero.mannedPoste).toBeUndefined();
    expect(hero.weapons.some((w) => w.uid === poste.item.uid)).toBe(false);
    expect(st.battle!.acted).toBe(true); // quitter coûte l'Action
  });
});

// ───────────────────────────────────────────────────────────────────────────────────────────────
// (E) AFFORDANCE IA — l'énumération d'actions d'un combattant IA adjacent inclut « Servir cette pièce ».
// ───────────────────────────────────────────────────────────────────────────────────────────────
describe('(E) Affordance IA — un combattant IA adjacent PEUT servir', () => {
  const input = (enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput => ({
    enemy, heroes, scene: emptyScene(12, 12),
    blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)),
    movement: enemy.movement, spells: [], ...extra,
  });

  it('`servablePostes` voit le poste pour un ENNEMI adjacent (énumération kind-agnostique)', () => {
    const poste = mkPoste('baliste');
    const enemy = mkActor('e', 'enemy', { x: 5, y: 6 });
    expect(servablePostes(enemy, [mkEmplacement(poste), enemy])).toHaveLength(1);
  });

  it('`buildAiInput` surface les postes servables dans l’entrée de décision IA', () => {
    const poste = mkPoste('baliste');
    const enemy = mkActor('e', 'enemy', { x: 5, y: 6 });
    const all = [mkEmplacement(poste), enemy, mkEnemyTarget('hero', 1, 1)];
    // (le « hero » ici est juste un combattant adverse pour peupler la scène — kind enemy ne gêne pas buildAiInput)
    useGame.setState({
      battle: { combatants: all, order: all.map((c) => c.id), turn: 1, round: 1, acted: false, log: [] } as never,
      party: [], partyPos: { x: 0, y: 0 }, facing: {}, scene: groundScene() as never, gameTime: 0, lightLevel: 1,
    });
    const aiInput = buildAiInput(enemy, useGame.getState);
    expect(aiInput.servablePostes).toEqual([{ hullId: 'emplacement', posteUid: poste.item.uid }]);
  });

  it('`chooseEnemyAction` PEUT retourner `manPoste` (faute d’attaque/approche jouable)', () => {
    const enemy = mkActor('e', 'enemy', { x: 5, y: 6 });
    enemy.movement = 0; // immobile → aucune approche ; sans arme → aucune attaque
    const far = mkEnemyTarget('hero', 1, 1);
    far.kind = 'hero' as never;
    const action = chooseEnemyAction(input(enemy, [far], { servablePostes: [{ hullId: 'emplacement', posteUid: 'baliste-x' }] }));
    expect(action.kind).toBe('manPoste');
    expect(action).toMatchObject({ hullId: 'emplacement', posteUid: 'baliste-x' });
  });

  it('sans poste servable, le même ennemi immobile/désarmé passe la main (pas de candidat fantôme)', () => {
    const enemy = mkActor('e', 'enemy', { x: 5, y: 6 });
    enemy.movement = 0;
    const far = mkEnemyTarget('hero', 1, 1);
    far.kind = 'hero' as never;
    expect(chooseEnemyAction(input(enemy, [far])).kind).toBe('end');
  });
});
