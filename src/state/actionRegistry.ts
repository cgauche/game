/**
 * REGISTRE DES ACTIONS — le CODE derrière `src/data/actions.json` (spec HUD « Zone 12 »).
 *
 * Trois tables, trois responsabilités, aucune logique en JSON :
 *  - `ACTION_GATES`    — les PRÉDICATS d'offre, par id. Source UNIQUE : `ActionBar` et `turnEconomy`
 *                        les consomment (ils en tenaient chacun une dérivation manuscrite, et la
 *                        divergence a déjà coûté un bug — Détermination, commit `0e14119b`).
 *  - `ACTION_CANDIDATES` — les SÉLECTEURS impurs (listes de cibles/objets), enveloppes NOMMÉES des
 *                        fonctions existantes : aucune n'est réécrite ici.
 *  - `ACTION_RUN`      — les DISPATCHERS : une entrée par méthode `battle*` du store.
 *
 * `runAction(id, get, ctx)` est la porte unique : le clavier, la console et les pastilles y passent,
 * plus jamais par des closures anonymes publiées positionnellement.
 */
import type { Combatant } from '../engine/types';
import type { BattleState, GameState } from './store';
import { canMove, trampleTarget, entityPickables } from './store';
import { canTakeAction, isOutOfAction } from '../engine/conditions';
import { isEngaged } from '../engine/engagement';
import { isFrenzied } from '../engine/psychology';
import { isVehicle } from '../engine/vehicle';
import { compatibleAmmo } from '../engine/items';
import { isConsumable } from '../engine/consumables';
import { hasFreeWeaponAttack, selfManeuversOf, selfManeuverApplicable } from './combatManeuvers';
import { inBattleId } from './combatants';
import { healableTargets } from '../engine/healing';
import { waterSprayCandidates } from '../engine/suffocation';
import { dispellableSpellsOn } from '../engine/dispel';
import { combatAdvantageSkills } from '../engine/skillCombatApps';
import { availableAttacks } from './combatFlow';
import { mountableNear } from './mount';
import { servablePostes } from './shipPostes';
import { ACTIONS, type ActionDef } from '../data/index';

/** Verdict d'un gate : l'indisponibilité PORTE SA RAISON (patron `GatedAction`, charte UI). */
export interface ActionGate {
  ok: boolean;
  reason?: string;
}

/** Contexte d'évaluation — PUR : l'acteur et son combat suffisent aux prédicats de règle. Les rares
 *  gates de TABLE (coop) lisent `netMode`, jamais le store entier. */
export interface ActionCtx {
  active: Combatant;
  battle: BattleState;
  netMode?: string;
}

const ok: ActionGate = { ok: true };
const no = (reason: string): ActionGate => ({ ok: false, reason });

/** L'Action du Tour est-elle encore disponible ET utilisable ? (Sonné/Inconscient → `canTakeAction`).
 *  Périmètre STRICT de l'économie du tour : les restrictions d'ÉTAT propres à une famille d'actes
 *  (Brisé interdit l'offensive, Frénésie ferme tout sauf CC/Athlétisme) sont des gates à part. */
function actionLibre({ active, battle }: ActionCtx): ActionGate {
  if (battle.acted) return no('Action déjà dépensée ce tour');
  if (!canTakeAction(active)) return no('hors d’état d’agir');
  return ok;
}

/** Désengagement (LDB 15 l.45-49) : l'option d'Esquive coûte l'Action, l'option d'Avantage non —
 *  d'où un gate qui reste ouvert Action dépensée quand l'Avantage est strictement supérieur. */
function desengagementGate(ctx: ActionCtx): ActionGate {
  const { active, battle } = ctx;
  if (!isEngaged(active)) return no('pas Engagé');
  if (!battle.acted) return ok;
  return freeDisengage(ctx) ? ok : no('Action déjà dépensée (désengagement gratuit indisponible)');
}

/** Le désengagement est-il GRATUIT ? Avantage strictement supérieur à TOUS les foes Engagés encore
 *  en jeu (LDB 15 l.45-49, « Utiliser l'Avantage »). Prédicat PARTAGÉ (barre + économie du tour). */
export function freeDisengage({ active, battle }: ActionCtx): boolean {
  if (!isEngaged(active)) return false;
  const foes = (active.engagedWith ?? [])
    .map((id) => inBattleId(battle, id))
    .filter((c): c is Combatant => !!c && !isOutOfAction(c));
  return foes.length > 0 && active.advantage > Math.max(0, ...foes.map((f) => f.advantage));
}

/** Le Mouvement du Tour est-il ENCORE INTACT ? Prédicat PARTAGÉ (gestes qui exigent l'élan complet). */
function mouvementIntact({ battle }: ActionCtx): ActionGate {
  return battle.movementUsed > 0 ? no('Mouvement déjà entamé ce tour') : ok;
}

/** Les PRÉDICATS d'offre du registre, par id (`gate` de `actions.json`). */
export const ACTION_GATES: Record<string, (ctx: ActionCtx) => ActionGate> = {
  toujours: () => ok,
  'action-libre': actionLibre,
  'action-libre-hors-frenesie': (ctx) =>
    isFrenzied(ctx.active) ? no('Frénésie : seuls la Capacité de Combat et l’Athlétisme') : actionLibre(ctx),
  'mouvement-intact': mouvementIntact,
  /** Charge — fiche `regles/charger` (`LDB 15 l.35-37`), foyer du verbatim au Codex. */
  'charge-possible': (ctx) => (isEngaged(ctx.active) ? no('déjà Engagé') : mouvementIntact(ctx)),
  'mouvement-restant': ({ active, battle }) => (canMove(battle, active) ? ok : no('plus de Mouvement ce tour')),
  desengagement: desengagementGate,
  'determination-en-reserve': ({ active }) =>
    (active.resolve ?? 0) > 0 ? ok : no('aucun point de Détermination'),
  'attaque-libre-frenesie': ({ active }) =>
    hasFreeWeaponAttack(active) ? ok : no('aucune attaque d’Arme gratuite disponible'),
  'pietinement-gratuit': ({ active, battle }) =>
    active.advantage >= 1 && !!trampleTarget(battle, active) ? ok : no('aucune cible piétinable'),
  'set-commutable': ({ active, battle }) =>
    (active.loadouts?.length ?? 0) < 2
      ? no('un seul set d’armes')
      : battle.loadoutSwapped
        ? no('set d’armes déjà changé ce tour')
        : ok,
  coop: ({ netMode }) => (netMode && netMode !== 'local' ? ok : no('partie locale')),
  'navire-action': ({ active, battle }) =>
    !isVehicle(active) ? no('pas un navire') : battle.acted ? no('Action du navire déjà dépensée') : ok,
};

/** Verdict d'offre d'une action, par son id — porte de lecture UNIQUE pour les surfaces. */
export function actionGate(actionId: string, ctx: ActionCtx): ActionGate {
  const def = ACTIONS.find((a) => a.id === actionId);
  if (!def) return no(`action inconnue : ${actionId}`);
  const gate = ACTION_GATES[def.gate];
  return gate ? gate(ctx) : no(`gate inconnu : ${def.gate}`);
}

/** Contexte des sélecteurs : impurs par nature (ils lisent le combat, parfois la scène). */
export interface ActionSelectorCtx extends ActionCtx {
  state?: GameState;
  /** Arme visée quand le sélecteur dépend d'une arme précise (munitions compatibles). */
  weaponUid?: string;
}

/** Les SÉLECTEURS de candidats, par id (`candidates` de `actions.json`) — enveloppes nommées des
 *  fonctions déjà écrites (la liste manuscrite de l'IA n'a plus lieu d'être). */
export const ACTION_CANDIDATES: Record<string, (ctx: ActionSelectorCtx) => unknown[]> = {
  'montures-adjacentes': ({ active, battle }) => {
    const m = mountableNear(battle, active);
    return m ? [m] : [];
  },
  'pieces-servables': ({ active, battle }) => servablePostes(active, battle.combatants),
  'cibles-soin': ({ active, battle }) =>
    healableTargets(active, battle.combatants.filter((c) => c.kind === active.kind), { adjacency: true }),
  'cibles-aspersion': ({ active, battle }) =>
    waterSprayCandidates(active, battle.combatants.filter((c) => c.kind === active.kind)),
  'sorts-dissipables': ({ battle }) => dispellableSpellsOn(battle.combatants),
  'competences-avantage': ({ active }) =>
    [...new Map(combatAdvantageSkills(active).filter((s) => s.cap > active.advantage).map((s) => [s.skillId, s])).values()],
  'attaques-disponibles': ({ active, battle }) => availableAttacks(active, battle),
  'sorts-du-heros': ({ active }) => active.spells ?? [],
  'etats-retirables': ({ active }) => ((active.resolve ?? 0) > 0 ? active.conditions : []),
  consommables: ({ active }) => (active.items ?? []).filter(isConsumable),
  'armes-a-distance': ({ active }) => active.weapons.filter((w) => w.type === 'ranged'),
  'munitions-compatibles': ({ active, weaponUid }) => {
    const w = active.weapons.find((x) => x.uid === weaponUid) ?? active.weapons.find((x) => x.type === 'ranged');
    return w ? compatibleAmmo(active, w) : [];
  },
  'manoeuvres-sur-soi': ({ active }) => selfManeuversOf(active).filter((m) => selfManeuverApplicable(active, m)),
  'sets-d-armes': ({ active }) => active.loadouts ?? [],
  'objets-au-sol': ({ active, state }) => {
    if (!state || !active.pos) return [];
    const flags = state.flags ?? {};
    return (state.scene?.entities ?? [])
      .filter(
        (e) =>
          e.kind === 'prop' && !!e.interact &&
          Math.max(Math.abs(e.pos.x - active.pos!.x), Math.abs(e.pos.y - active.pos!.y)) <= 1 &&
          (e.z ?? 0) === (active.pos!.z ?? 0) &&
          !flags[`__fouille_${e.id}`],
      )
      .flatMap((e) => entityPickables(e).map((p) => ({ entityId: e.id, ...p })));
  },
};

/** Paramètres d'exécution — l'action nomme SA cible ; jamais une closure qui la capture. */
export interface ActionRunCtx {
  targetId?: string;
  weaponUid?: string;
  ammoUid?: string;
  spellId?: string;
  casterId?: string;
  skillId?: string;
  itemUid?: string;
  loadoutId?: string;
  conditionId?: string;
  maneuverId?: string;
  attackId?: string;
  attackKind?: string;
  entityId?: string;
  pickKey?: string;
  /** COQUE visée (`hullId`) — bordée, chant, rechargement de pièce, service d'un poste. */
  shipId?: string;
  /** MEMBRE D'ÉQUIPAGE qui agit sur la coque (`battleShipManeuver(crewId)`, `store.ts`) : c'est le
   *  barreur, pas le navire. Deux champs parce que ce sont deux entités — un seul mentait. */
  crewId?: string;
  posteUid?: string;
  crewTestId?: string;
  stateId?: 'empetre' | 'en-flammes';
  /** Bascule d'un mode ARMÉ : `true` = désarmer (re-clic sur la même case). */
  toggleOff?: boolean;
}

type Dispatcher = (get: () => GameState, ctx: ActionRunCtx, def: ActionDef) => void;

/** Les DISPATCHERS, par id (`run` de `actions.json`) : une entrée = une méthode du store. */
export const ACTION_RUN: Record<string, Dispatcher> = {
  battleSelectAction: (get, ctx, def) =>
    get().battleSelectAction(
      (ctx.toggleOff ? null : (def.armed ?? null)) as Parameters<GameState['battleSelectAction']>[0],
    ),
  battleSelectAttack: (get, ctx) => get().battleSelectAttack(ctx.attackId ?? 'arme'),
  battleManeuverArea: (get, ctx) =>
    get().battleManeuverArea(ctx.attackKind as Parameters<GameState['battleManeuverArea']>[0]),
  battleAim: (get) => get().battleAim(),
  battleReload: (get, ctx) => get().battleReload(ctx.weaponUid),
  battleSelectAmmo: (get, ctx) => { if (ctx.ammoUid) get().battleSelectAmmo(ctx.ammoUid, ctx.weaponUid); },
  battleTogglePushback: (get) => get().battleTogglePushback(),
  battleWater: (get, ctx) => get().battleWater(ctx.targetId),
  battleUseItem: (get, ctx) => { if (ctx.itemUid) get().battleUseItem(ctx.itemUid); },
  battleDefendTotal: (get) => get().battleDefendTotal(),
  battleDisengage: (get) => get().battleDisengage(),
  battleSelectSpell: (get, ctx) => { if (ctx.spellId) get().battleSelectSpell(ctx.spellId); },
  battleFocusSpell: (get, ctx) => { if (ctx.spellId) get().battleFocusSpell(ctx.spellId); },
  battleDispelSpell: (get, ctx) => { if (ctx.spellId && ctx.casterId) get().battleDispelSpell(ctx.spellId, ctx.casterId); },
  battleGainAdvantage: (get, ctx) => { if (ctx.skillId) get().battleGainAdvantage(ctx.skillId); },
  battleRecoverState: (get, ctx) => { if (ctx.stateId) get().battleRecoverState(ctx.stateId); },
  battleStandUp: (get) => get().battleStandUp(),
  battleBattement: (get, ctx) => get().battleBattement(ctx.targetId),
  battleDistraire: (get, ctx) => get().battleDistraire(ctx.targetId),
  battleFrenzy: (get) => get().battleFrenzy(),
  battleSelfManeuver: (get, ctx) => { if (ctx.maneuverId) get().battleSelfManeuver(ctx.maneuverId); },
  battleResolvePsychImmune: (get) => get().battleResolvePsychImmune(),
  battleResolveIgnoreCrit: (get) => get().battleResolveIgnoreCrit(),
  battleSpendResolve: (get, ctx) => { if (ctx.conditionId) get().battleSpendResolve(ctx.conditionId); },
  battleMount: (get) => get().battleMount(),
  battleDismount: (get) => get().battleDismount(),
  battleManPoste: (get, ctx) =>
    get().battleManPoste(ctx.shipId && ctx.posteUid ? { hullId: ctx.shipId, posteUid: ctx.posteUid } : undefined),
  battleLeavePoste: (get) => get().battleLeavePoste(),
  battlePushEngine: (get) => get().battlePushEngine(),
  battleAidTeam: (get) => get().battleAidTeam(),
  battlePickup: (get, ctx) => { if (ctx.entityId && ctx.pickKey) get().battlePickup(ctx.entityId, ctx.pickKey); },
  battleShipManeuver: (get, ctx) => { if (ctx.crewId) get().battleShipManeuver(ctx.crewId); },
  battleCrewTest: (get, ctx) => { if (ctx.shipId && ctx.crewTestId) get().battleCrewTest(ctx.shipId, ctx.crewTestId); },
  battleSingShanty: (get, ctx) => { if (ctx.shipId) get().battleSingShanty(ctx.shipId); },
  battleShipReload: (get, ctx) => { if (ctx.shipId && ctx.posteUid) get().battleShipReload(ctx.shipId, ctx.posteUid); },
  battleSwitchLoadout: (get, ctx) => { if (ctx.loadoutId) get().battleSwitchLoadout(ctx.loadoutId); },
  battleEndTurn: (get) => get().battleEndTurn(),
  cancelMove: (get) => get().cancelMove(),
  raiseHand: (get) => get().raiseHand(),
};

/** Exécute une action par son ID. Porte UNIQUE — le clavier, les cases et les pastilles y passent.
 *  Une action déclarée `blocked` (aucun dispatcher) ne fait rien : le registre le DIT, il ne feint pas.
 *  Une action qui déclare une INTENTION (`intent`) arme d'abord le mode local qui peint sa portée
 *  (`localIntent.ts`, spec zone 4) : c'est le clic du champ, ensuite, qui commet le geste. Les deux
 *  ne s'excluent pas — l'attaque arme son option ET affiche sa portée. */
export function runAction(actionId: string, get: () => GameState, ctx: ActionRunCtx = {}): void {
  const def = ACTIONS.find((a) => a.id === actionId);
  if (!def) return;
  if (def.intent) get().battleArmIntent(ctx.toggleOff ? null : def.id);
  if (def.run) ACTION_RUN[def.run]?.(get, ctx, def);
}

/** Modes ARMABLES de `battle.action`, DÉRIVÉS du registre (`armed`) + les modes qui n'appartiennent
 *  à aucune action de barre, déclarés ici avec leur porteur (garde de parité :
 *  `src/state/action-atteignabilite.test.ts`). */
export const MODES_HORS_REGISTRE = {
  /** Armé par la RÉSOLUTION d'un sort de Téléportation (case d'arrivée), jamais par une case. */
  teleport: 'sort de Téléportation (combatFlow)',
} as const;

/** Union des valeurs légales de `BattleState.action` — le type raconte le registre. */
export type BattleActionMode =
  | 'cast'
  | 'resolve'
  | 'ammo'
  | 'heal'
  | 'dispel'
  | 'battery'
  | 'advantage'
  | 'push'
  | keyof typeof MODES_HORS_REGISTRE;

/** Les MÊMES valeurs, énumérables à l'exécution — la garde `action-atteignabilite` vérifie qu'elles
 *  couvrent EXACTEMENT les `armed` du registre + `MODES_HORS_REGISTRE` (union validée, pas dérivée :
 *  un JSON importé n'a pas de type littéral). */
export const BATTLE_ACTION_MODES: readonly BattleActionMode[] = [
  'cast', 'resolve', 'ammo', 'heal', 'dispel', 'battery', 'advantage', 'push', 'teleport',
];
