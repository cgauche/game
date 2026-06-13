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

export function makeRollFlow<P extends PendingBase>(spec: RollFlowSpec<P>): RollFlowHandlers {
  const pendingOf = (s: GameState) => s[spec.key] as P | null | undefined;
  const touch = spec.touch ?? touchActors;
  return {
    picker: spec.caps?.picker,
    roll(get, set) {
      const s = get();
      const p = pendingOf(s);
      if (!p || spec.rolled(p)) return; // déjà lancé
      const patch = spec.resolve(s, p, spec.actor(s, p), get);
      if (!patch) return;
      set({ [spec.key]: { ...p, ...patch } } as Partial<GameState>);
    },
    reroll(get, set) {
      const s = get();
      const p = pendingOf(s);
      if (!p || !spec.rolled(p)) return;
      if (!canReroll(spec.failed(p), !!p.rerolled)) return; // jet propre raté, 1× max
      const actor = spec.actor(s, p);
      // Bénédiction de Chance (LDB 41) : relance GRATUITE du prochain Test raté — le drapeau
      // est consommé à la place d'un Point de Chance (et permet la relance même à 0 Chance).
      const free = !!actor && hasActiveFlag(actor, 'freeReroll');
      if (!actor || (!free && (actor.fortune ?? 0) <= 0)) return;
      const patch = (spec.reresolve ?? spec.resolve)(s, p, actor, get);
      if (!patch) return;
      if (free) {
        const label = consumeActiveFlag(actor, 'freeReroll');
        get().log(`${actor.name} relance sans dépenser de Chance (${label ?? 'Bénédiction de Chance'}).`);
      } else {
        actor.fortune = (actor.fortune ?? 0) - 1;
      }
      set({ [spec.key]: { ...p, ...patch, rerolled: true }, ...touch(s) } as Partial<GameState>);
    },
    bonusSL(get, set) {
      if (!spec.bonus) return;
      const s = get();
      const p = pendingOf(s);
      if (!p || !spec.rolled(p)) return;
      if (spec.bonus.guard && !spec.bonus.guard(p)) return;
      const actor = spec.actor(s, p);
      if (!actor || (actor.fortune ?? 0) <= 0) return;
      const patch = spec.bonus.derive(s, p, actor);
      if (!patch) return;
      actor.fortune = (actor.fortune ?? 0) - 1;
      set({ [spec.key]: { ...p, ...patch }, ...touch(s) } as Partial<GameState>);
    },
    forceSuccess(get, set) {
      if (!spec.caps?.forced) return; // le flux n'offre pas la Résilience
      const s = get();
      const p = pendingOf(s);
      if (!p) return; // (pas d'exigence de jet : la Résilience vaut AVANT le jet, LDB 17 l.73)
      const actor = spec.actor(s, p);
      if (!actor || (actor.resilience ?? 0) <= 0) return;
      // `resolve(…, {})` = dé PAR DÉFAUT du flux. Son `null` joue le rôle de l'ancien `guard`
      // (cas interdit / déjà réussi → refus, donc PAS de dépense de Résilience).
      const patch = spec.resolve(s, p, actor, get, {});
      if (!patch) return;
      actor.resilience = (actor.resilience ?? 0) - 1;
      set({ [spec.key]: { ...p, ...patch, forced: true }, ...touch(s) } as Partial<GameState>);
    },
    setForcedRoll(get, set, roll) {
      if (!spec.caps?.forced) return; // le flux n'offre pas le choix du dé
      const s = get();
      const p = pendingOf(s);
      if (!p || !p.forced) return; // seulement après « Je ne faillirai pas ! » (même Test)
      const actor = spec.actor(s, p);
      if (!actor) return;
      const chosen = Math.floor(roll);
      if (chosen < 1) return;
      // `resolve(…, { roll })` = dé CHOISI ; `null` si le dé n'est pas une réussite (pas d'effet).
      const patch = spec.resolve(s, p, actor, get, { roll: chosen });
      if (!patch) return;
      set({ [spec.key]: { ...p, ...patch } } as Partial<GameState>);
    },
    cancel(_get, set) {
      set({ [spec.key]: null } as Partial<GameState>);
    },
    darkPact(get, set) {
      const s = get();
      const p = pendingOf(s);
      if (!p || !spec.rolled(p)) return;
      if (!spec.failed(p)) return; // on ne pactise que pour relancer un Test RATÉ (LDB 19 l.16)
      const actor = spec.actor(s, p);
      if (!actor || actor.kind !== 'hero') return; // la Corruption ne suit que les héros
      const patch = (spec.reresolve ?? spec.resolve)(s, p, actor, get);
      if (!patch) return;
      // « recevoir volontairement un Point de Corruption pour pouvoir relancer un Test,
      // même si un deuxième jet a déjà été effectué » (l.41) — pas de drapeau `rerolled`,
      // le Pacte reste disponible (chaque usage corrompt un peu plus : c'est sa limite).
      const lines = gainCorruption(get, set, actor, 1);
      for (const l of lines) get().log(l);
      set({ [spec.key]: { ...p, ...patch }, ...touch(get()) } as Partial<GameState>);
    },
  };
}
