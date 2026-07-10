/**
 * Fabrique générique des « flux de jet différé ».
 *
 * Chaque modale de jet (Piétinement, Course, Focalisation, Psychologie, Frénésie, Rechargement,
 * Se libérer/Étouffer, Test de compétence, Évaluation, Marchandage, Soin…) suit le MÊME cycle de
 * vie, jusqu'ici copié-collé par flux dans le store (~6 actions × ~10 lignes chacune) :
 *
 *   ouvrir (pending posé) → Lancer (`roll`) → Chance : relancer (`reroll`, LDB 12 : jet propre
 *   raté, 1× max) ou +1 DR (`bonusSL`, LDB 17 l.26) → Résilience : réussite garantie
 *   (`forceSuccess`, LDB 17 l.73 : AVANT le jet ou après un échec) → Appliquer / Annuler.
 *
 * La fabrique centralise la plomberie commune (gardes, dépense de Chance/Résilience, drapeau
 * `rerolled`, patch de re-rendu) ; chaque flux ne déclare QUE sa partie métier via `RollFlowSpec`
 * (cf. `rollFlows.ts`). L'action « Appliquer » (`xConfirm`) reste écrite à la main dans le store :
 * ses effets sont tous différents — c'est la règle, pas la plomberie.
 *
 * Garde-fou : les primitives de résolution (RNG, moteur) ne sont appelées QUE par `resolve`/
 * `reresolve`/`bonus.derive`/`force.derive`, eux-mêmes invoqués uniquement par les résolveurs
 * générés ici — câblés dans le store sous des noms `*Roll`/`*Reroll`/… que le test statique
 * `roll-modal-invariant.test.ts` continue de vérifier.
 */
import type { GameState } from './store';
import type { Combatant } from '../engine/types';
import { canReroll } from '../engine/fortune';
import { availableResistance, markResistanceUsed, resistanceForcedSL } from '../engine/menace';
import { hasActiveFlag, consumeActiveFlag } from '../engine/activeFlags';
import { touchActors } from './combatOrParty';
import { gainCorruption } from './corruptionFlow';

import type { Get, Set } from './flowTypes';
import { bumpSL, evaluateTest, maxForcedRoll, forcedTR, bestForcedRoll, type TestResult } from '../engine/tests';
import { TestOutcome } from '../engine/testOutcome';

/** Champs communs à tous les objets `pending*` gérés par la fabrique. */
export interface PendingBase {
  rerolled?: boolean;
  /** Réussite forcée par Résilience (LDB 17 l.73) — posé par `forceSuccess`, ouvre `setForcedRoll`. */
  forced?: boolean;
  /** MENACE à laquelle ce Test RÉSISTE (« Résistance (Menace) », LDB 10 l.1015-1021 : 'Maladie' /
   *  'Corruption' / 'Mutation' / 'Magie' / 'Poison'…) — posé par le SITE qui ouvre le pending/l'étape.
   *  Présent + talent disponible ⇒ le verbe `resist` offre l'auto-succès (1× par spec et par séance). */
  menace?: string;
}

/**
 * Résolution FORCÉE — auto-succès du MÊME mécanisme pour DEUX sources RAW.
 * Passé en 5ᵉ argument de `resolve` :
 *  - `{}`               → `forceSuccess` (Résilience, LDB 17 l.73) : le flux applique son dé PAR
 *                          DÉFAUT (01 → DR max, ou, en Test opposé, le jet courant forcé à l'emporter) ;
 *  - `{ roll: n }`      → `setForcedRoll` (Résilience) : le joueur a CHOISI le dé `n` (doit rester une réussite) ;
 *  - `{ sl: n }`        → `resist` (Résistance (Menace), LDB 10 l.1015-1021) : auto-succès à DR IMPOSÉ
 *                          (« utilisez votre Bonus d'Endurance comme DR pour le Test ») — pas de choix du dé.
 * Absent (`resolve` appelé sans ce paramètre) → jet NORMAL (RNG). Un seul résolveur porte donc tous
 * les cas, au lieu des dérives séparées `force`/`forceRoll` (le « code dérivé » d'avant).
 */
export interface ForcedResolve {
  roll?: number;
  /** DR imposé de l'auto-succès du talent Résistance (Menace) — seulement via le verbe `resist`
   *  (`caps.resist`) ; les flux qui ne le déclarent pas ne le reçoivent jamais. */
  sl?: number;
}

/**
 * Props du sélecteur de dé PARTAGÉ (« Je ne faillirai pas ! », LDB 17 l.73). Renvoyé par
 * `caps.picker` quand le Test forcé offre un CHOIX du dé (attaque/défense/incantation/piétinement/
 * Peur) — `null` = pas de picker (flux binaire, ou avant `forceSuccess`). Le dé choisi pilote le DR,
 * le Critique (11) ET la localisation inversée. Co-localisé avec `resolve` : un seul endroit connaît
 * la forme du résultat du flux.
 */
export interface ForcedPick {
  roll: number;
  target: number;
  /** Le double (11) a un effet (Coup/Incantation Critique) → bouton « 11 · Critique ». */
  critable?: boolean;
}

/**
 * Lentille de DÉRIVATION des verbes d'influence (Chance +1 DR / Résilience « Je ne faillirai pas ! » /
 * Résistance Menace). Ces règles sont GLOBALES (LDB 17 l.68/83-84) : quand un flux fournit sa lentille,
 * la fabrique compose `bonusSL`/`forceSuccess`/`setForcedRoll`/`resist` DEPUIS elle — la mécanique ne vit
 * plus qu'ICI, le flux ne déclare que SA FORME. Un flux sans lentille retombe sur le chemin `resolve(forced)`
 * / `bonus.derive` (repli). Le `+1 DR` passe TOUJOURS par `bumpSL` (ne touche pas `success` — LDB 17 l.84 :
 * un Degré de plus ne transforme pas un échec en réussite).
 */
export interface RollFlowLens<P extends PendingBase, Slot extends PendingBase = P> {
  /** TestResult ACTEUR courant du slot (post-jet), ou `null` (pas encore lancé / rien à re-dériver). */
  actorTR: (slot: Slot) => TestResult | null;
  /** Re-dérive le patch du slot depuis un TestResult acteur canonique — FINISHER PUR (aucun RNG) : re-oppose
   *  contre le figé si opposé, projette vers la forme concrète. `null` = cas interdit (pas de dépense). */
  applyRoll: (s: GameState, slot: Slot, actor: Combatant, get: Get, tr: TestResult, p: P) => Partial<Slot> | null;
  /** Cible du dé de l'acteur (valeur ≤ = réussite) → source de `maxForcedRoll`/`evaluateTest`. ABSENT ⇒ le
   *  flux ne construit jamais de dé forcé (opposé binaire → `forceWin` ; pas de picker → pas de setForcedRoll). */
  dieTarget?: (slot: Slot, actor: Combatant) => number | null;
  /** Plancher de DR d'une réussite forcée (défaut 1 ; opposé attaque/défense : DR de l'opposant + 1). */
  floorSL?: (slot: Slot, actor: Combatant) => number;
  /** forceSuccess « sans re-dériver le dé » : opposé BINAIRE (→ issue « success ») ou flip-success simple.
   *  PRÉSENT ⇒ forceSuccess l'utilise au lieu de `applyRoll(forcedTR(…))`. `null` = interdit / déjà réussi. */
  forceWin?: (slot: Slot, actor: Combatant, tr: TestResult | null) => Partial<Slot> | null;
}

/**
 * ISSUE CANONIQUE d'un jet — source UNIQUE de « a-t-il réussi + de combien ». `won` = la réussite
 * RÉELLE du flux (la MÊME que lit la narration et l'« Appliquer ») ; `sl` = le Degré de Réussite
 * courant. La fabrique en DÉRIVE le gating des verbes d'influence (`failed = !outcome(slot).won`) :
 * un flux ne déclare plus un prédicat `failed` SÉPARÉ, qui pouvait DIVERGER de l'issue (bug `activity` :
 * la narration lisait `combinedLevel`, l'ancien `failed` lisait skill-1 → Chance/Résilience mal gatées).
 *
 * SCELLÉE (#275 Décision 2, `TestOutcome`, `engine/testOutcome.ts`) — un flux ne peut plus renvoyer un
 * littéral `{won, sl}` forgé : seul `TestOutcome.seal(...)` construit cette issue.
 */
export type RollOutcome = TestOutcome;

export interface RollFlowSpec<P extends PendingBase, Slot extends PendingBase = P> {
  /** Clé du pending dans le store (ex. `'pendingTrample'`). */
  key: keyof GameState & string;
  /**
   * MULTI (N jets dans une modale) : énumère les SLOTS de jet du pending, leur id, et les ré-injecte.
   * ABSENT ⇒ MONO : le pending EST le slot unique (`pid` ignoré par les handlers). Une SEULE fabrique
   * pour les deux — le mono est le cas dégénéré N=1 (plus de `makeMultiRollFlow` recopié).
   */
  multi?: { slots: (p: P) => Slot[]; idOf: (slot: Slot) => string; replace: (p: P, slots: Slot[]) => P };
  /** Le jet a-t-il déjà été lancé ? (`slot.result != null` / `slot.roll != null`). */
  rolled: (slot: Slot) => boolean;
  /** L'acteur qui dépense Chance/Résilience. `undefined` → l'action de dépense est ignorée. */
  actor: (s: GameState, slot: Slot, p: P) => Combatant | undefined;
  /**
   * Patch du SLOT qui pose le jet (appelle le moteur + RNG). `null` → abandon silencieux
   * (précondition manquante : cible disparue, sort introuvable…) — AVANT toute dépense de point.
   * `actor` peut être `undefined` au premier jet (certains flux n'en ont pas besoin pour lancer).
   * `get` : accès au store pour les résolveurs qui lisent l'environnement (resolveAttack). `forced`
   * (seulement si `caps.forced`) : Résilience — cf. `ForcedResolve`. Absent → jet normal. `p` (dernier
   * arg) : le pending parent, pour un flux multi qui lit un contexte partagé (MONO : `slot === p`).
   */
  resolve: (s: GameState, slot: Slot, actor: Combatant | undefined, get: Get, forced?: ForcedResolve, p?: P) => Partial<Slot> | null;
  /** Patch de RELANCE (défaut : `resolve`) — utile en Test opposé où l'adversaire garde son jet figé. */
  reresolve?: (s: GameState, slot: Slot, actor: Combatant, get: Get, p?: P) => Partial<Slot> | null;
  /**
   * ISSUE CANONIQUE du slot (cf. `RollOutcome`) : SOURCE UNIQUE de « réussi + de combien ». La fabrique
   * DÉRIVE d'elle le gating de la Chance/Pacte/Résistance (`failed = !outcome(slot).won`) — plus de
   * prédicat `failed` séparé qui pourrait DIVERGER de l'issue réelle du flux. `won` lit un jet EXISTANT ;
   * le « a-t-il été lancé ? » reste porté par `rolled(slot)` (Chance : LDB 12, jet propre raté, 1× max).
   */
  outcome: (slot: Slot) => RollOutcome;
  /** Chance « +1 DR » (absent → le flux ne l'offre pas). `guard` → cas interdits (ex. Test binaire). */
  bonus?: { guard?: (slot: Slot) => boolean; derive: (s: GameState, slot: Slot, actor: Combatant, p?: P) => Partial<Slot> | null };
  /** Lentille de dérivation des verbes d'influence (cf. `RollFlowLens`). PRÉSENTE ⇒ la fabrique compose
   *  bonusSL/forceSuccess/setForcedRoll/resist depuis elle (le `bonus` et la branche `if(forced)` de
   *  `resolve` deviennent inutiles pour ce flux). ABSENTE ⇒ repli byte-identique sur le chemin actuel. */
  lens?: RollFlowLens<P, Slot>;
  /**
   * Traits déclaratifs du flux. `forced` : ce flux offre la Résilience (LDB 17 l.73, GLOBALE),
   * résolue DANS `resolve(…, forced)` — un seul résolveur porte les trois cas (jet normal,
   * `forceSuccess` = dé par défaut, `setForcedRoll` = dé choisi). Un flux qui NE pose PAS `forced`
   * n'offre simplement pas la Résilience (`forceSuccess`/`setForcedRoll` y sont des no-op : reload,
   * marchandage, évaluation…). Plus aucune dérive `force`/`forceRoll` séparée — cf. `ForcedResolve`.
   *
   * `picker` : sélecteur PARTAGÉ du dé choisi (UI `ForcedDie` → `ForcedRollPicker`). Pure, il lit la
   * forme du résultat du flux (que `resolve` connaît déjà) et rend les props du picker ou `null`.
   */
  caps?: {
    forced?: boolean;
    picker?: (slot: Slot, actor: Combatant | undefined) => ForcedPick | null;
    /** Ce flux accepte l'auto-succès du talent Résistance (Menace) (LDB 10) : son `resolve` porte la
     *  branche `forced.sl` (DR = Bonus d'Endurance). Offert seulement sur un slot tagué `menace`. */
    resist?: boolean;
    /** Détermination (immunité PSY temporaire, LDB 17 l.62) : MÊME catégorie que `resist` (dépenser une
     *  ressource pour infléchir un Test psy), PAS une réussite forcée. Le flux DÉCLARE l'effet SPÉCIFIQUE
     *  (dépense de Détermination + marqueur `immune` sur l'étape psy), la fabrique fournit le CÂBLAGE
     *  (interface store/intent/modale via le verbe `determine` → action `<prefix>Determine`, le handler
     *  ci-dessous GATE `actor` puis dispatche). Exposé par les seuls flux à `caps.determine`. */
    determine?: (slot: Slot, actor: Combatant, get: Get, set: Set, commit: Commit<Slot>) => void;
  };
  /**
   * Undo MÉTIER optionnel de l'annulation (ex. défaire-charge de l'attaque…).
   * PRÉSENT ⇒ il OWN la fermeture (il fait lui-même tous les `set`, y compris nuller le pending et
   * avancer/nuller la cascade-hôte selon les cas) : `cancel` lui délègue tout et ne touche à rien
   * d'autre — byte-identique aux anciennes actions bespoke. ABSENT ⇒ `cancel` applique le teardown
   * par défaut (nulle le pending ET la cascade-hôte, cf. `cancel`). */
  onCancel?: (get: Get, set: Set, p: P) => void;
  /** Patch de re-rendu après mutation en place de l'acteur. Défaut : `touchActors` (combat ⇄ groupe). */
  touch?: (s: GameState) => Partial<GameState>;
}

export interface RollFlowHandlers {
  /** `pid` : id du slot ciblé (MULTI). Absent ⇒ MONO (le pending est le slot unique). */
  roll: (get: Get, set: Set, pid?: string) => void;
  reroll: (get: Get, set: Set, pid?: string) => void;
  bonusSL: (get: Get, set: Set, pid?: string) => void;
  forceSuccess: (get: Get, set: Set, pid?: string) => void;
  /** Choix du dé d'un Test forcé (no-op sans `caps.forced` ou avant `forceSuccess`). */
  setForcedRoll: (get: Get, set: Set, roll: number, pid?: string) => void;
  /** Résistance (Menace), LDB 10 l.1015-1021 : auto-succès du premier Test qui résiste à la menace
   *  taguée sur le slot (`menace`), DR = Bonus d'Endurance, 1× par spec et par séance. No-op sans
   *  `caps.resist`, sans tag, sans talent disponible, ou si le Test est déjà réussi. */
  resist: (get: Get, set: Set, pid?: string) => void;
  /** Détermination (immunité PSY temporaire, LDB 17 l.62) : dépense 1 Détermination pour rendre l'acteur
   *  IMMUNISÉ ce Round sur l'étape psy ciblée (marqueur `immune`) — PAS une réussite forcée (≠ `resist`).
   *  No-op sans `caps.determine`, sans acteur. La fabrique GATE `actor` + dispatche ; la garde d'éligibilité
   *  fine (étape psy, non résolue) + la dépense vivent dans le handler du spec (`caps.determine`). */
  determine: (get: Get, set: Set, pid?: string) => void;
  /** Sélecteur du dé choisi pour le picker partagé (cf. `caps.picker`) — absent si le flux n'en a pas.
   *  `slot` est le pending/participant CONCRET ; `any` ici (les handlers ne portent pas `Slot`). */
  picker?: (slot: any, actor: Combatant | undefined) => ForcedPick | null;
  cancel: (get: Get, set: Set) => void;
  /** Sombre Pacte (LDB 19 l.16/41) : +1 Point de Corruption pour RELANCER un Test raté —
   *  autorisé même après la relance de Chance, répétable (chaque usage corrompt). Héros only. */
  darkPact: (get: Get, set: Set, pid?: string) => void;
}

/**
 * Plomberie d'influence PARTAGÉE (mono ET multi). Chaque opération agit sur un « slot » de jet
 * (`PendingBase` : le pending entier en mono, un participant en multi) et écrit son patch via un
 * `commit` qui sait OÙ ranger le résultat. Les résolveurs métier sont passés PRÉ-LIÉS (closures sur
 * s/p/actor/get) → le même corps sert les deux fabriques sans rien recopier. Comportement IDENTIQUE
 * à l'ancien `makeRollFlow` (garde-fou : suite + `roll-modal-invariant.test.ts`).
 */
type Commit<P> = (patch: Partial<P>, opts?: { rerolled?: boolean; forced?: boolean; touch?: boolean }) => void;

/** Lance un slot non encore lancé (pas de dépense de point, pas de re-rendu). */
function opRoll<P extends PendingBase>(
  rolled: boolean, resolveNormal: () => Partial<P> | null, commit: Commit<P>,
): void {
  if (rolled) return;
  const patch = resolveNormal();
  if (patch) commit(patch);
}

/** Chance : relance d'un jet propre RATÉ (1× max), ou Bénédiction de Chance gratuite (LDB 12/41). */
function opReroll<P extends PendingBase>(
  slot: P, actor: Combatant | undefined, rolled: boolean, failed: boolean,
  reresolve: () => Partial<P> | null, get: Get, commit: Commit<P>,
): void {
  if (!rolled || !canReroll(failed, !!slot.rerolled) || !actor) return;
  const free = hasActiveFlag(actor, 'freeReroll');
  if (!free && (actor.fortune ?? 0) <= 0) return;
  const patch = reresolve();
  if (!patch) return;
  if (free) {
    const label = consumeActiveFlag(actor, 'freeReroll');
    get().log(`${actor.name} relance sans dépenser de Chance (${label ?? 'Bénédiction de Chance'}).`);
  } else {
    actor.fortune = (actor.fortune ?? 0) - 1;
  }
  commit(patch, { rerolled: true, touch: true });
}

/** Chance « +1 DR » (LDB 17 l.26). */
function opBonusSL<P extends PendingBase>(
  actor: Combatant | undefined, rolled: boolean, allowed: boolean,
  derive: () => Partial<P> | null, commit: Commit<P>,
): void {
  if (!rolled || !allowed || !actor || (actor.fortune ?? 0) <= 0) return;
  const patch = derive();
  if (!patch) return;
  actor.fortune = (actor.fortune ?? 0) - 1;
  commit(patch, { touch: true });
}

/** Résilience « Je ne faillirai pas ! » — dé PAR DÉFAUT (LDB 17 l.73), AVANT ou après le jet. */
function opForceSuccess<P extends PendingBase>(
  actor: Combatant | undefined, resolveForced: () => Partial<P> | null, commit: Commit<P>,
): void {
  if (!actor || (actor.resilience ?? 0) <= 0) return;
  const patch = resolveForced();
  if (!patch) return; // `null` = cas interdit/déjà réussi → pas de dépense
  actor.resilience = (actor.resilience ?? 0) - 1;
  commit(patch, { forced: true, touch: true });
}

/** Résistance (Menace), LDB 10 l.1015-1021 : auto-succès du premier Test qui résiste à la menace du
 *  slot — MÊME mécanisme que `forceSuccess` (le résolveur reçoit `{ sl: BE }`), autre RESSOURCE : la
 *  spec du talent, consommée 1× par séance (compteur `resistanceUsed`, remis par `restoreFortune`).
 *  Comme la Résilience, utilisable AVANT le jet ou APRÈS un échec — jamais sur un Test déjà réussi. */
function opResist<P extends PendingBase>(
  slot: P, actor: Combatant | undefined, rolled: boolean, failed: boolean,
  resolveResist: (sl: number) => Partial<P> | null, commit: Commit<P>,
): void {
  if (!actor || !slot.menace || (rolled && !failed)) return;
  const spec = availableResistance(actor, slot.menace);
  if (spec == null) return;
  const patch = resolveResist(resistanceForcedSL(actor));
  if (!patch) return; // précondition manquante → pas de dépense
  markResistanceUsed(actor, spec);
  commit(patch, { touch: true });
}

/** Résilience — dé CHOISI (LDB 17 l.73), seulement après `forceSuccess` (slot `forced`). */
function opSetForcedRoll<P extends PendingBase>(
  slot: P, actor: Combatant | undefined, roll: number,
  resolveChosen: (roll: number) => Partial<P> | null, commit: Commit<P>,
): void {
  if (!slot.forced || !actor) return;
  const chosen = Math.floor(roll);
  if (chosen < 1) return;
  const patch = resolveChosen(chosen);
  if (patch) commit(patch);
}

/** Sombre Pacte : +1 Corruption pour relancer un Test RATÉ, répétable (LDB 19 l.16/41). Héros only. */
function opDarkPact<P extends PendingBase>(
  actor: Combatant | undefined, rolled: boolean, failed: boolean,
  reresolve: () => Partial<P> | null, get: Get, set: Set, commit: Commit<P>,
): void {
  if (!rolled || !failed || !actor || actor.kind !== 'hero') return;
  const patch = reresolve();
  if (!patch) return;
  const lines = gainCorruption(get, set, actor, 1);
  for (const l of lines) get().log(l);
  commit(patch, { touch: true });
}

/**
 * Fabrique UNIQUE des flux de jet (mono ET multi). `locate(p, pid)` trouve le SLOT ciblé + un
 * `commit` qui ré-injecte le patch au bon endroit : MONO → le slot EST le pending (`pid` ignoré) ;
 * MULTI → `participants[pid]` (ou le 1er), ré-inséré via la lentille `spec.multi`. Le câblage des
 * 7 verbes est écrit UNE fois — plus de `makeMultiRollFlow` qui recopiait la structure.
 */
export function makeRollFlow<P extends PendingBase, Slot extends PendingBase = P>(spec: RollFlowSpec<P, Slot>): RollFlowHandlers {
  const pendingOf = (s: GameState) => s[spec.key] as P | null | undefined;
  const touch = spec.touch ?? touchActors;
  const locate = (set: Set, get: Get, p: P, pid?: string): { slot: Slot; commit: Commit<Slot> } | null => {
    if (!spec.multi) {
      const slot = p as unknown as Slot;
      return { slot, commit: (patch, opts) => set({
        [spec.key]: { ...slot, ...patch, ...(opts?.rerolled ? { rerolled: true } : {}), ...(opts?.forced ? { forced: true } : {}) },
        ...(opts?.touch ? touch(get()) : {}),
      } as Partial<GameState>) };
    }
    const slots = spec.multi.slots(p);
    const slot = pid != null ? slots.find((x) => spec.multi!.idOf(x) === pid) : slots[0];
    if (!slot) return null;
    return { slot, commit: (patch, opts) => set({
      [spec.key]: spec.multi!.replace(p, slots.map((x) => x === slot
        ? { ...x, ...patch, ...(opts?.rerolled ? { rerolled: true } : {}), ...(opts?.forced ? { forced: true } : {}) }
        : x)),
      ...(opts?.touch ? touch(get()) : {}),
    } as Partial<GameState>) };
  };
  // Rangée TÉMOIN d'un multi (façon MultiRollList) : pas d'INFLUENCE joueur (Résilience). Son jet
  // INITIAL est tout de même résolu (auto-roulé à l'ouverture par l'`openX` — ex. cible IA d'une
  // incantation opposée) ; c'est l'UI (boutons masqués) + les gardes de point qui la rendent passive.
  const passive = (slot: Slot) => !!spec.multi && (slot as Partial<RollParticipant>).interactive === false;
  const reresolveOf = (s: GameState, slot: Slot, actor: Combatant, get: Get, p: P) =>
    spec.reresolve ? spec.reresolve(s, slot, actor, get, p) : spec.resolve(s, slot, actor, get, undefined, p);
  const L = spec.lens; // lentille de dérivation des verbes d'influence (Chance/Résilience/Résistance)
  // « Échec » (gating de la Chance/Pacte/Résistance) DÉRIVÉ de l'issue canonique : plus de prédicat
  // `failed` séparé qui pourrait diverger de l'issue réelle du flux (`won`). `won` est lu sur un jet
  // EXISTANT — les consommateurs (opReroll/opDarkPact/opResist) court-circuitent tous sur `rolled` d'abord.
  const isFailed = (slot: Slot) => !spec.outcome(slot).won;
  return {
    picker: spec.caps?.picker as RollFlowHandlers['picker'],
    roll(get, set, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      // PAS de garde `passive` : le jet INITIAL d'un témoin doit être résolu (auto-roll IA à l'ouverture).
      const loc = locate(set, get, p, pid); if (!loc) return;
      opRoll(spec.rolled(loc.slot), () => spec.resolve(s, loc.slot, spec.actor(s, loc.slot, p), get, undefined, p), loc.commit);
    },
    reroll(get, set, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      const actor = spec.actor(s, loc.slot, p);
      opReroll(loc.slot, actor, spec.rolled(loc.slot), isFailed(loc.slot), () => reresolveOf(s, loc.slot, actor!, get, p), get, loc.commit);
    },
    bonusSL(get, set, pid) {
      if (!spec.bonus && !L) return;
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      const actor = spec.actor(s, loc.slot, p);
      const allowed = L ? true : (!spec.bonus!.guard || spec.bonus!.guard(loc.slot));
      // +1 DR de Chance (LDB 17 l.84) : lentille = `applyRoll(bumpSL)` — `bumpSL` ne touche PAS `success`
      // (un Degré de plus ne transforme pas un échec en réussite). Repli = le `bonus.derive` du flux.
      const derive = L
        ? () => { const cur = L.actorTR(loc.slot); return cur ? L.applyRoll(s, loc.slot, actor!, get, bumpSL(cur), p) : null; }
        : () => spec.bonus!.derive(s, loc.slot, actor!, p);
      opBonusSL(actor, spec.rolled(loc.slot), allowed, derive, loc.commit);
    },
    forceSuccess(get, set, pid) {
      if (!spec.caps?.forced) return;
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc || passive(loc.slot)) return;
      const actor = spec.actor(s, loc.slot, p);
      // Résilience « Je ne faillirai pas ! » (LDB 17 l.68) : réussite MINIMALE forcée (DR planché). Lentille :
      // opposé binaire/flip → `forceWin` ; sinon `applyRoll(forcedTR au plancher)`. Repli = `resolve(…,{})`.
      const resolveForced = L
        ? () => {
            const cur = L.actorTR(loc.slot);
            if (L.forceWin) return L.forceWin(loc.slot, actor!, cur);
            const tgt = L.dieTarget?.(loc.slot, actor!); if (tgt == null) return null;
            const floor = L.floorSL?.(loc.slot, actor!) ?? 1;
            // « Vous choisissez le résultat » = LE MEILLEUR (LDB 17 l.68) : `bestForcedRoll` donne le dé DR-max
            // SELON la policy (01 en standard, le plus haut en Fast DR). Opposé : `floorSL` garantit d'emporter
            // (oppSL+1). Réussite forcée ≥ 1 (LDB 12 l.147). Le dé porte l'`isDouble` (Critique) correct.
            const die = bestForcedRoll(tgt);
            const sl = Math.max(evaluateTest(die, tgt).sl, floor, 1);
            return L.applyRoll(s, loc.slot, actor!, get, forcedTR(die, tgt, sl), p);
          }
        : () => spec.resolve(s, loc.slot, actor, get, {}, p);
      opForceSuccess(actor, resolveForced, loc.commit);
    },
    setForcedRoll(get, set, roll, pid) {
      if (!spec.caps?.forced) return;
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      const actor = spec.actor(s, loc.slot, p);
      // Dé CHOISI (LDB 17 l.68) — lentille SEULEMENT si `dieTarget` (⇔ picker). Repli = `resolve(…,{roll})`.
      const resolveChosen = (L && L.dieTarget)
        ? (r: number) => {
            const tgt = L.dieTarget!(loc.slot, actor!); if (tgt == null || r > maxForcedRoll(tgt)) return null;
            const floor = L.floorSL?.(loc.slot, actor!) ?? 1;
            return L.applyRoll(s, loc.slot, actor!, get, forcedTR(r, tgt, Math.max(evaluateTest(r, tgt).sl, floor, 1)), p);
          }
        : (r: number) => spec.resolve(s, loc.slot, actor, get, { roll: r }, p);
      opSetForcedRoll(loc.slot, actor, roll, resolveChosen, loc.commit);
    },
    resist(get, set, pid) {
      if (!spec.caps?.resist) return;
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc || passive(loc.slot)) return;
      // Le tag `menace` vit sur le SLOT (étape de cascade) ou sur le PENDING entier (opposition de sort).
      const slot = loc.slot.menace != null ? loc.slot : { ...loc.slot, menace: (p as PendingBase).menace } as Slot;
      const actor = spec.actor(s, loc.slot, p);
      // Résistance (Menace) : réussite forcée à DR = Bonus d'Endurance (LDB 10). Repli = `resolve(…,{sl})`.
      const resolveResist = L
        ? (sl: number) => { const tgt = L.dieTarget?.(loc.slot, actor!) ?? 0; return L.applyRoll(s, loc.slot, actor!, get, forcedTR(1, tgt, sl), p); }
        : (sl: number) => spec.resolve(s, loc.slot, actor, get, { sl }, p);
      opResist(slot, actor, spec.rolled(loc.slot), isFailed(loc.slot), resolveResist, loc.commit);
    },
    determine(get, set, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      const actor = spec.actor(s, loc.slot, p);
      // La fabrique GATE `actor` + dispatche ; l'éligibilité fine (étape psy/non résolue) + la dépense
      // (Détermination) vivent dans le handler du spec (`caps.determine`).
      if (actor) spec.caps?.determine?.(loc.slot, actor, get, set, loc.commit);
    },
    cancel(get, set) {
      const p = pendingOf(get());
      if (!p) return; // rien d'ouvert : no-op (pas d'undo à jouer, pas de cascade à toucher)
      // Undo métier présent ⇒ il OWN toute la fermeture (nulle le pending, avance/nulle la cascade
      // selon les cas). SINON teardown par défaut, CASCADE-AWARE : nuller `pendingCascade` est un
      // no-op quand le flux est autonome (pending seul) et correct quand il est l'étape d'une cascade
      // (l'arbitre garantit une seule modale active → toute `pendingCascade` présente est SON hôte).
      if (spec.onCancel) { spec.onCancel(get, set, p); return; }
      set({ [spec.key]: null, pendingCascade: null } as Partial<GameState>);
    },
    darkPact(get, set, pid) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      const loc = locate(set, get, p, pid); if (!loc) return;
      const actor = spec.actor(s, loc.slot, p);
      opDarkPact(actor, spec.rolled(loc.slot), isFailed(loc.slot), () => reresolveOf(s, loc.slot, actor!, get, p), get, set, loc.commit);
    },
  };
}

// ── Multi-participants : types des SLOTS d'un flux multi (le câblage vit dans `makeRollFlow` via
//    `spec.multi`). Cf. docs/superpowers/specs/2026-06-14-multi-roll-modal-design.md. ──

/** État d'UN jet dans un groupe (mêmes drapeaux d'influence que le mono). Les flux concrets
 *  l'ÉTENDENT pour porter leur résultat (ex. `CounterParticipant` ajoute `counter`). */
export interface RollParticipant extends PendingBase {
  /** Combattant qui lance ce jet. */
  id: string;
  /** Libellé de rangée (sinon le nom du combattant). */
  label?: string;
  /** Rangée TÉMOIN (lecture seule, façon `MultiRollList`) si faux/absent → pas d'influence. */
  interactive?: boolean;
}

/** Le pending d'un flux multi (parallèle ou séquentiel) porte SES slots. Le câblage vit dans
 *  `makeRollFlow` via `spec.multi = { slots: (p) => p.participants, idOf, replace }`. Étend
 *  `PendingBase` pour satisfaire la contrainte de la fabrique (ses drapeaux d'influence restent
 *  inutilisés au niveau conteneur — l'influence vit sur chaque participant). */
export interface MultiPending<Part extends RollParticipant = RollParticipant> extends PendingBase {
  participants: Part[];
}
