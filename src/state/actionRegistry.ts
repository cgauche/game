/**
 * REGISTRE DES ACTIONS — le CODE derrière `src/data/actions.json` (spec HUD « Zone 12 »).
 *
 * Trois tables, trois responsabilités, aucune logique en JSON :
 *  - `ACTION_GATES`    — les PRÉDICATS d'offre, par id. Source UNIQUE : `CombatConsole` et `turnEconomy`
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
import { canMove, trampleTarget, entityPickables, activeCombatant } from './store';
import { currentTargetingMode } from './targetingModes';
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
import { availableAttacks, placingZoneOf, STANCE_BLOCK } from './combatFlow';
import { mountableNear } from './mount';
import { servablePostes } from './shipPostes';
import { ACTIONS, type ActionDef } from '../data/index';
import { t } from '../i18n';

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
  /** PARAMÈTRES DE LA CASE (`ActionRunCtx` — la Compétence visée, l'arme, l'objet) : une entrée du
   *  registre peut être rendue N fois, une par candidat, et le verdict d'offre porte alors sur CE
   *  candidat (« au plafond de CETTE méthode d'Avantage »). Les gates de règle pure les ignorent ; le
   *  dispatcher reçoit exactement les mêmes (`runAction`), d'où une seule et même mesure. */
  args?: ActionRunCtx;
}

const ok: ActionGate = { ok: true };
const no = (reason: string): ActionGate => ({ ok: false, reason });

/** L'Action du Tour est-elle encore disponible ET utilisable ? (Sonné/Inconscient → `canTakeAction`).
 *  Périmètre STRICT de l'économie du tour : les restrictions d'ÉTAT propres à une famille d'actes
 *  (Brisé interdit l'offensive, Frénésie ferme tout sauf CC/Athlétisme) sont des gates à part. */
function actionLibre({ active, battle }: ActionCtx): ActionGate {
  if (battle.acted) return no(t('agate.actionSpent'));
  if (!canTakeAction(active)) return no(t('agate.unableToAct'));
  return ok;
}

/** Désengagement (LDB 15 l.45-49) : l'option d'Esquive coûte l'Action, l'option d'Avantage non —
 *  d'où un gate qui reste ouvert Action dépensée quand l'Avantage est strictement supérieur. */
function desengagementGate(ctx: ActionCtx): ActionGate {
  const { active, battle } = ctx;
  if (!isEngaged(active)) return no(t('agate.notEngaged'));
  if (!battle.acted) return ok;
  return freeDisengage(ctx) ? ok : no(t('agate.actionSpentNoFreeDisengage'));
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
  return battle.movementUsed > 0 ? no(t('agate.movementStarted')) : ok;
}

/** L'acteur a-t-il un CORPS de fantassin ? Une coque n'en a pas (`engine/vehicle.ts` : « ni arme
 *  tenue, ni sort, ni marche de fantassin ») : les gestes du corps — marcher, courir, se mettre sur
 *  la défensive — ne lui sont pas offerts, et le refus le DIT au lieu de dépenser son Action. Un
 *  navire agit par ses Tests d'équipage et sa barre. */
function fantassin({ active }: ActionCtx): ActionGate {
  return isVehicle(active) ? no(t('agate.hullHasNoBody')) : ok;
}

/** ET séquentiel de gates : le PREMIER refus l'emporte, avec SA raison (aucune raison fabriquée). */
const et =
  (...gates: ((ctx: ActionCtx) => ActionGate)[]) =>
  (ctx: ActionCtx): ActionGate => {
    for (const g of gates) {
      const v = g(ctx);
      if (!v.ok) return v;
    }
    return ok;
  };

/** Les PRÉDICATS d'offre du registre, par id (`gate` de `actions.json`). */
export const ACTION_GATES: Record<string, (ctx: ActionCtx) => ActionGate> = {
  toujours: () => ok,
  'action-libre': actionLibre,
  'action-libre-hors-frenesie': (ctx) =>
    isFrenzied(ctx.active) ? no(t('agate.frenzyOnly')) : actionLibre(ctx),
  'action-libre-hors-frenesie-fantassin': (ctx) =>
    et(fantassin, ACTION_GATES['action-libre-hors-frenesie'])(ctx),
  'mouvement-intact': mouvementIntact,
  'mouvement-restant-fantassin': (ctx) => et(fantassin, ACTION_GATES['mouvement-restant'])(ctx),
  /** MIROIR de la garde de `cancelMove` (`combatSlice.ts:975-979`) : le segment restaurable est le
   *  SNAPSHOT, pas le compteur — `battleStandUp` écrit `movementUsed` sans en poser un, et le
   *  dispatcher n'aurait rien à défaire. Le contrôle du siège n'entre pas ici (il est au dispatcher
   *  et aux contextes de surface : `live` pour la console, `cur` pour la touche). */
  'deplacement-annulable': ({ battle }) => {
    if (!battle.moveSnapshot || (battle.movementUsed ?? 0) === 0) return no(t('agate.noMoveToUndo'));
    return battle.acted ? no(t('agate.actionSpent')) : ok;
  },
  /** Charge — fiche `regles/charger` (`LDB 15 l.35-37`), foyer du verbatim au Codex. */
  'charge-possible': (ctx) => (isEngaged(ctx.active) ? no(t('agate.alreadyEngaged')) : mouvementIntact(ctx)),
  'mouvement-restant': ({ active, battle }) => (canMove(battle, active) ? ok : no(t('agate.noMovementLeft'))),
  desengagement: desengagementGate,
  'determination-en-reserve': ({ active }) =>
    (active.resolve ?? 0) > 0 ? ok : no(t('agate.noResolve')),
  'attaque-libre-frenesie': ({ active }) =>
    hasFreeWeaponAttack(active) ? ok : no(t('agate.noFreeWeaponAttack')),
  'pietinement-gratuit': ({ active, battle }) =>
    active.advantage >= 1 && !!trampleTarget(battle, active) ? ok : no(t('agate.noTrampleTarget')),
  'set-commutable': ({ active, battle }) =>
    (active.loadouts?.length ?? 0) < 2
      ? no(t('agate.singleLoadout'))
      : battle.loadoutSwapped
        ? no(t('agate.loadoutSwapped'))
        : ok,
  /** Cumuler l'Avantage (LDB 09 l.305-308) : chaque méthode a SON plafond (`skillAdvantageCap`), et
   *  au plafond le Test ne peut plus rien rendre. Le refus est DIT (« Avantage au plafond (N) ») et la
   *  case reste dessinée : la faire disparaître privait le joueur de la raison. La méthode visée vient
   *  des ARGS de la case — les mêmes que le dispatcher `battleGainAdvantage` reçoit. */
  'avantage-sous-plafond': (ctx) =>
    et(ACTION_GATES['action-libre-hors-frenesie'], ({ active, args }) => {
      const methode = combatAdvantageSkills(active).find((s) => s.skillId === args?.skillId);
      return methode && active.advantage >= methode.cap
        ? no(t('agate.advantageCapped', { n: methode.cap }))
        : ok;
    })(ctx),
  /** Postures de tir (spec §1a G5) — PRÉDICATS UNIQUES de `combatFlow`, partagés avec le store
   *  (`battleToggleStance`), le versement dans le pending et la fenêtre de jet. Le refus est celui
   *  du prédicat : la raison appartient à `STANCE_BLOCK`, jamais au gate. */
  'tir-immobile-armable': ({ active, battle }) => {
    const refus = STANCE_BLOCK.heldGround(battle, active);
    return refus ? no(refus) : ok;
  },
  'tir-dans-le-tas-armable': ({ active, battle }) => {
    const refus = STANCE_BLOCK.intoCrowd(battle, active);
    return refus ? no(refus) : ok;
  },
  coop: ({ netMode }) => (netMode && netMode !== 'local' ? ok : no(t('agate.localGame'))),
  'navire-action': ({ active, battle }) =>
    !isVehicle(active) ? no(t('agate.notAVessel')) : battle.acted ? no(t('agate.vesselActionSpent')) : ok,
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
  /** Méthodes d'Avantage POSSÉDÉES (dédupliquées par Compétence : un Savoir groupé = une case). Le
   *  PLAFOND ne filtre plus ici : il est le verdict d'offre `avantage-sous-plafond`, qui laisse la case
   *  dessinée fermée avec sa raison — une seule source, jamais un filtre muet doublé d'un gate. */
  'competences-avantage': ({ active }) =>
    [...new Map(combatAdvantageSkills(active).map((s) => [s.skillId, s])).values()],
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
  battleToggleStance: (get, _ctx, def) => { if (def.stance) get().battleToggleStance(def.stance); },
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
  // ── SORTIES D'INTERLUDE (`surface: 'interlude'`) : une enveloppe NOMMÉE par entrée, jamais un
  //    dispatcher mutualisé — deux interludes ne partagent ni leur verbe ni ses gardes (`cleaveEnd`
  //    clôt l'étape-jet de la cascade, `battleSelectAction` est avalé sous `combatBusy`).
  cleaveEnd: (get) => get().cleaveEnd(),
  dualStrikeSkip: (get) => get().dualStrikeSkip(),
  castPickTargetsOff: (get) => get().castPickTargets(false),
  /** Sortie du placeur de zone, ROUTÉE PAR LA SOURCE que mesure `placingZoneOf` — symétrique de
   *  `commitPlacedZone` (même aiguilleur pour poser et pour renoncer) : un sort revient à sa modale,
   *  un pilonnage referme son placeur. Une seule entrée d'interlude pour le mode `placing-zone`. */
  placingZoneOff: (get) => {
    const s = get();
    if (placingZoneOf(s)?.source === 'siege') get().siegeAimCancel();
    else get().castPlaceZone(false);
  },
  batterySelectNone: (get) => get().battleSelectAction(null),
  /** Téléportation (`combatFlow.ts:5384` : `action: 'teleport'` + `reachable` = `flyReachable` depuis
   *  la case du lanceur, qui contient donc SA case au coût 0, `path.ts:318`) : la sortie de l'interlude
   *  est un ARRIVAGE sur place — le même commit que le clic-sol, par la même porte. */
  teleportStay: (get) => {
    const battle = get().battle;
    const active = battle && activeCombatant(battle);
    if (active?.pos) get().battleClickTile({ ...active.pos });
  },
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

/** L'action d'INTERLUDE du ciblage COURANT : l'entrée `surface: 'interlude'` dont le `mode` est celui
 *  que rend l'aiguilleur (`currentTargetingMode`). C'est la SORTIE d'un ciblage par la carte — le
 *  bandeau de phase de la console la rend, la touche d'annulation ne prend que celles qui portent
 *  `exitSafe`. `undefined` = aucun interlude en cours (mode ordinaire : attaque, cast, soin…). */
export function currentInterludeAction(get: () => GameState): ActionDef | undefined {
  const modeId = currentTargetingMode(get).id;
  return ACTIONS.find((a) => a.surface === 'interlude' && a.mode === modeId);
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
  | 'heal'
  | 'dispel'
  | 'battery'
  | 'push'
  | keyof typeof MODES_HORS_REGISTRE;

/** Les MÊMES valeurs, énumérables à l'exécution — la garde `action-atteignabilite` vérifie qu'elles
 *  couvrent EXACTEMENT les `armed` du registre + `MODES_HORS_REGISTRE` (union validée, pas dérivée :
 *  un JSON importé n'a pas de type littéral). */
export const BATTLE_ACTION_MODES: readonly BattleActionMode[] = [
  'cast', 'heal', 'dispel', 'battery', 'push', 'teleport',
];
