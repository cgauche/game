/**
 * Fabrique générique des « flux de jet différé » (invariante « un jet = une modale »).
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
import { hasActiveFlag, consumeActiveFlag } from '../engine/activeFlags';
import { touchActors } from './combatOrParty';
import { gainCorruption } from './corruptionFlow';

import type { Get, Set } from './flowTypes';

/** Champs communs à tous les objets `pending*` gérés par la fabrique. */
export interface PendingBase {
  rerolled?: boolean;
  /** Réussite forcée par Résilience (LDB 17 l.73) — posé par `forceSuccess`, ouvre `setForcedRoll`. */
  forced?: boolean;
}

/**
 * Résolution FORCÉE par la Résilience (LDB 17 l.73 « vous choisissez le résultat des dés »).
 * Passé en 5ᵉ argument de `resolve` quand `caps.forced` est posé :
 *  - `{}`               → `forceSuccess` : le flux applique son dé PAR DÉFAUT (01 → DR max, ou,
 *                          en Test opposé, le jet courant forcé à l'emporter) ;
 *  - `{ roll: n }`      → `setForcedRoll` : le joueur a CHOISI le dé `n` (doit rester une réussite).
 * Absent (`resolve` appelé sans ce paramètre) → jet NORMAL (RNG). Un seul résolveur porte donc les
 * trois cas, au lieu des dérives séparées `force`/`forceRoll` (le « code dérivé » d'avant).
 */
export interface ForcedResolve {
  roll?: number;
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

export interface RollFlowSpec<P extends PendingBase> {
  /** Clé du pending dans le store (ex. `'pendingTrample'`). */
  key: keyof GameState & string;
  /** Le jet a-t-il déjà été lancé ? (`p.result != null` / `p.roll != null`). */
  rolled: (p: P) => boolean;
  /** L'acteur qui dépense Chance/Résilience. `undefined` → l'action de dépense est ignorée. */
  actor: (s: GameState, p: P) => Combatant | undefined;
  /**
   * Patch du pending qui pose le jet (appelle le moteur + RNG). `null` → abandon silencieux
   * (précondition manquante : cible disparue, sort introuvable…) — AVANT toute dépense de point.
   * `actor` peut être `undefined` au premier jet (certains flux n'en ont pas besoin pour lancer).
   * `get` : accès au store pour les résolveurs qui lisent l'environnement (resolveAttack).
   * `forced` (5ᵉ arg, seulement si `caps.forced`) : Résilience — cf. `ForcedResolve`. Absent → jet normal.
   */
  resolve: (s: GameState, p: P, actor: Combatant | undefined, get: Get, forced?: ForcedResolve) => Partial<P> | null;
  /** Patch de RELANCE (défaut : `resolve`) — utile en Test opposé où l'adversaire garde son jet figé. */
  reresolve?: (s: GameState, p: P, actor: Combatant, get: Get) => Partial<P> | null;
  /** Jet « propre raté » → relançable par la Chance (LDB 12 : d100 raté, 1× max). */
  failed: (p: P) => boolean;
  /** Chance « +1 DR » (absent → le flux ne l'offre pas). `guard` → cas interdits (ex. Test binaire). */
  bonus?: { guard?: (p: P) => boolean; derive: (s: GameState, p: P, actor: Combatant) => Partial<P> | null };
  /**
   * Traits déclaratifs du flux. `forced` : ce flux offre la Résilience (LDB 17 l.73, GLOBALE),
   * résolue DANS `resolve(…, forced)` — un seul résolveur porte les trois cas (jet normal,
   * `forceSuccess` = dé par défaut, `setForcedRoll` = dé choisi). Un flux qui NE pose PAS `forced`
   * n'offre simplement pas la Résilience (`forceSuccess`/`setForcedRoll` y sont des no-op : reload,
   * marchandage, évaluation…). Plus aucune dérive `force`/`forceRoll` séparée — cf. `ForcedResolve`.
   *
   * `picker` : sélecteur PARTAGÉ du dé choisi (UI `ForcedDie` → `ForcedRollPicker`). Pure, il lit la
   * forme du résultat du flux (que `resolve` connaît déjà) et rend les props du picker ou `null`
   * (masqué). Centralise la visibilité (`p.forced` + résultat « pickable ») et les props {roll,
   * target, critable} — fini le câblage recopié dans chaque modale.
   */
  caps?: {
    forced?: boolean;
    picker?: (p: P, actor: Combatant | undefined) => ForcedPick | null;
  };
  /** Patch de re-rendu après mutation en place de l'acteur. Défaut : `touchActors` (combat ⇄ groupe). */
  touch?: (s: GameState) => Partial<GameState>;
}

export interface RollFlowHandlers {
  roll: (get: Get, set: Set) => void;
  reroll: (get: Get, set: Set) => void;
  bonusSL: (get: Get, set: Set) => void;
  forceSuccess: (get: Get, set: Set) => void;
  /** Choix du dé d'un Test forcé (no-op sans `caps.forced` ou avant `forceSuccess`). */
  setForcedRoll: (get: Get, set: Set, roll: number) => void;
  /** Sélecteur du dé choisi pour le picker partagé (cf. `caps.picker`) — absent si le flux n'en a pas.
   *  `p` est le pending CONCRET du flux (typé côté `caps.picker`) ; `any` ici car les handlers ne
   *  portent pas le paramètre générique `P` — l'appelant (`ForcedDie`) le re-type. */
  picker?: (p: any, actor: Combatant | undefined) => ForcedPick | null;
  cancel: (get: Get, set: Set) => void;
  /** Sombre Pacte (LDB 19 l.16/41) : +1 Point de Corruption pour RELANCER un Test raté —
   *  autorisé même après la relance de Chance, répétable (chaque usage corrompt). Héros only. */
  darkPact: (get: Get, set: Set) => void;
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

export function makeRollFlow<P extends PendingBase>(spec: RollFlowSpec<P>): RollFlowHandlers {
  const pendingOf = (s: GameState) => s[spec.key] as P | null | undefined;
  const touch = spec.touch ?? touchActors;
  // commit MONO : le slot EST le pending → on écrit `s[key]`.
  const commitOf = (set: Set, get: Get, p: P): Commit<P> => (patch, opts) =>
    set({
      [spec.key]: { ...p, ...patch, ...(opts?.rerolled ? { rerolled: true } : {}), ...(opts?.forced ? { forced: true } : {}) },
      ...(opts?.touch ? touch(get()) : {}),
    } as Partial<GameState>);
  return {
    picker: spec.caps?.picker,
    roll(get, set) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      opRoll(spec.rolled(p), () => spec.resolve(s, p, spec.actor(s, p), get), commitOf(set, get, p));
    },
    reroll(get, set) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      const actor = spec.actor(s, p);
      opReroll(p, actor, spec.rolled(p), spec.failed(p), () => (spec.reresolve ?? spec.resolve)(s, p, actor!, get), get, commitOf(set, get, p));
    },
    bonusSL(get, set) {
      if (!spec.bonus) return;
      const s = get(); const p = pendingOf(s); if (!p) return;
      const actor = spec.actor(s, p);
      const allowed = !spec.bonus.guard || spec.bonus.guard(p);
      opBonusSL(actor, spec.rolled(p), allowed, () => spec.bonus!.derive(s, p, actor!), commitOf(set, get, p));
    },
    forceSuccess(get, set) {
      if (!spec.caps?.forced) return;
      const s = get(); const p = pendingOf(s); if (!p) return;
      opForceSuccess(spec.actor(s, p), () => spec.resolve(s, p, spec.actor(s, p), get, {}), commitOf(set, get, p));
    },
    setForcedRoll(get, set, roll) {
      if (!spec.caps?.forced) return;
      const s = get(); const p = pendingOf(s); if (!p) return;
      opSetForcedRoll(p, spec.actor(s, p), roll, (r) => spec.resolve(s, p, spec.actor(s, p), get, { roll: r }), commitOf(set, get, p));
    },
    cancel(_get, set) {
      set({ [spec.key]: null } as Partial<GameState>);
    },
    darkPact(get, set) {
      const s = get(); const p = pendingOf(s); if (!p) return;
      const actor = spec.actor(s, p);
      opDarkPact(actor, spec.rolled(p), spec.failed(p), () => (spec.reresolve ?? spec.resolve)(s, p, actor!, get), get, set, commitOf(set, get, p));
    },
  };
}

// ── Multi-participants : N jets dans une modale, chacun son cycle d'influence (cf. spec
//    docs/superpowers/specs/2026-06-14-multi-roll-modal-design.md). Réutilise les opérations ci-dessus. ──

/** État d'UN jet dans un groupe (mêmes drapeaux d'influence que le mono). */
export interface RollParticipant extends PendingBase {
  /** Combattant qui lance ce jet. */
  id: string;
  /** Libellé de rangée (sinon le nom du combattant). */
  label?: string;
  /** Rangée TÉMOIN (lecture seule, façon `MultiRollList`) si faux/absent → pas d'influence. */
  interactive?: boolean;
}

/** Le pending d'un flux multi porte le tableau de participants (+ son contexte figé propre). */
export interface MultiPending {
  participants: RollParticipant[];
}

/**
 * Spec d'un flux MULTI : même contrat que `RollFlowSpec` mais résolu PAR participant. `resolve`
 * reçoit le participant ET son acteur ; tout le reste (Chance/Pacte/Résilience/relance) vient des
 * opérations partagées. `aggregate` (métier de groupe) vit dans le store comme les `xConfirm`.
 */
export interface MultiRollFlowSpec<P extends MultiPending> {
  key: keyof GameState & string;
  /** Le participant a-t-il lancé ? */
  rolled: (part: RollParticipant) => boolean;
  /** Acteur d'un participant (qui dépense Chance/Résilience). */
  actor: (s: GameState, p: P, part: RollParticipant) => Combatant | undefined;
  resolve: (s: GameState, p: P, part: RollParticipant, actor: Combatant | undefined, get: Get, forced?: ForcedResolve) => Partial<RollParticipant> | null;
  reresolve?: (s: GameState, p: P, part: RollParticipant, actor: Combatant, get: Get) => Partial<RollParticipant> | null;
  failed: (part: RollParticipant) => boolean;
  bonus?: { guard?: (part: RollParticipant) => boolean; derive: (s: GameState, p: P, part: RollParticipant, actor: Combatant) => Partial<RollParticipant> | null };
  caps?: { forced?: boolean; picker?: (part: RollParticipant, actor: Combatant | undefined) => ForcedPick | null };
  touch?: (s: GameState) => Partial<GameState>;
}

/** Handlers d'un flux multi : mêmes verbes que le mono, mais ciblant un PARTICIPANT par `id`. */
export interface MultiRollFlowHandlers {
  roll: (get: Get, set: Set, pid: string) => void;
  reroll: (get: Get, set: Set, pid: string) => void;
  bonusSL: (get: Get, set: Set, pid: string) => void;
  forceSuccess: (get: Get, set: Set, pid: string) => void;
  setForcedRoll: (get: Get, set: Set, pid: string, roll: number) => void;
  picker?: (part: RollParticipant, actor: Combatant | undefined) => ForcedPick | null;
  cancel: (get: Get, set: Set) => void;
  darkPact: (get: Get, set: Set, pid: string) => void;
}

export function makeMultiRollFlow<P extends MultiPending>(spec: MultiRollFlowSpec<P>): MultiRollFlowHandlers {
  const pendingOf = (s: GameState) => s[spec.key] as P | null | undefined;
  const touch = spec.touch ?? touchActors;
  const partOf = (p: P, pid: string) => p.participants.find((x) => x.id === pid);
  // commit MULTI : le slot est `participants[pid]` → on remplace ce participant dans le tableau.
  const commitOf = (set: Set, get: Get, p: P, pid: string): Commit<RollParticipant> => (patch, opts) =>
    set({
      [spec.key]: {
        ...p,
        participants: p.participants.map((x) =>
          x.id === pid ? { ...x, ...patch, ...(opts?.rerolled ? { rerolled: true } : {}), ...(opts?.forced ? { forced: true } : {}) } : x,
        ),
      },
      ...(opts?.touch ? touch(get()) : {}),
    } as Partial<GameState>);
  return {
    picker: spec.caps?.picker,
    roll(get, set, pid) {
      const s = get(); const p = pendingOf(s); const part = p && partOf(p, pid); if (!p || !part || !part.interactive) return;
      opRoll(spec.rolled(part), () => spec.resolve(s, p, part, spec.actor(s, p, part), get), commitOf(set, get, p, pid));
    },
    reroll(get, set, pid) {
      const s = get(); const p = pendingOf(s); const part = p && partOf(p, pid); if (!p || !part) return;
      const actor = spec.actor(s, p, part);
      opReroll(part, actor, spec.rolled(part), spec.failed(part), () => (spec.reresolve ?? spec.resolve)(s, p, part, actor!, get), get, commitOf(set, get, p, pid));
    },
    bonusSL(get, set, pid) {
      if (!spec.bonus) return;
      const s = get(); const p = pendingOf(s); const part = p && partOf(p, pid); if (!p || !part) return;
      const actor = spec.actor(s, p, part);
      const allowed = !spec.bonus.guard || spec.bonus.guard(part);
      opBonusSL(actor, spec.rolled(part), allowed, () => spec.bonus!.derive(s, p, part, actor!), commitOf(set, get, p, pid));
    },
    forceSuccess(get, set, pid) {
      if (!spec.caps?.forced) return;
      const s = get(); const p = pendingOf(s); const part = p && partOf(p, pid); if (!p || !part) return;
      opForceSuccess(spec.actor(s, p, part), () => spec.resolve(s, p, part, spec.actor(s, p, part), get, {}), commitOf(set, get, p, pid));
    },
    setForcedRoll(get, set, pid, roll) {
      if (!spec.caps?.forced) return;
      const s = get(); const p = pendingOf(s); const part = p && partOf(p, pid); if (!p || !part) return;
      opSetForcedRoll(part, spec.actor(s, p, part), roll, (r) => spec.resolve(s, p, part, spec.actor(s, p, part), get, { roll: r }), commitOf(set, get, p, pid));
    },
    cancel(_get, set) {
      set({ [spec.key]: null } as Partial<GameState>);
    },
    darkPact(get, set, pid) {
      const s = get(); const p = pendingOf(s); const part = p && partOf(p, pid); if (!p || !part) return;
      const actor = spec.actor(s, p, part);
      opDarkPact(actor, spec.rolled(part), spec.failed(part), () => (spec.reresolve ?? spec.resolve)(s, p, part, actor!, get), get, set, commitOf(set, get, p, pid));
    },
  };
}
