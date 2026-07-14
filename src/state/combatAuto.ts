/**
 * Pilote d'AUTO-CADENCE (« Cadence de combat » Rapide / Auto-combat) — brique FEUILLE.
 *
 * `tickCombatAuto` regarde la modale ACTIVE (`pickActiveModalKey`) et, si le mode l'autorise et qu'elle
 * est pilotée LOCALEMENT, la résout en enchaînant ses résolveurs de store — SANS jamais toucher aux
 * actions d'influence (`reroll`/`forceSuccess`/`darkPact`/`bonusSL`) → « zéro dépense » par construction.
 *
 * Deux couches de politique (cf. critique : la granularité réelle des jets de combat est l'étape de
 * cascade, pas une clé modale) :
 *  - `MODAL_DEFS.auto` (modalArbiter) pour les modales STANDALONE (frénésie, course, focalisation, Destin…) ;
 *  - `JET_AUTO` (ici) pour les étapes-JET de la `cascade` de COMBAT (attaque/défense/… bespoke) — leur
 *    résolution passe par leur propre flux (`xRoll`→`xConfirm`, qui fait avancer la cascade), PAS par le
 *    résolveur générique `cascadeResolveAll` (réservé aux jets de NUIT/VOYAGE, qui ont un `target`).
 *
 * Module FEUILLE : n'importe RIEN de `combatFlow` ; tout passe par `get().xxx`. INERT tant que la chaîne
 * de reprise (C3/C4) ne l'appelle pas — `cadenceAuto()` est faux par défaut (mode « manuel »).
 */
import type { Get, Set } from './flowTypes';
import { useGame, type GameState } from './store';
import type { CascadeStep } from './pendings';
import { pickActiveModalKey, modalOwnerOf, autoPolicyOf, type AutoPolicy } from './modalArbiter';
import { stepInteraction } from './cascade';
import { ownsLocally } from './netOwnership';
import { cadenceAuto, cadenceAutoCombat } from '../engine/cadence';
import { beatHold } from './combatDirector';
import { scheduleCombatTimer } from './combatTimers';

/**
 * Politique d'auto-résolution par TYPE de jet de cascade de COMBAT. `self` = jet propre piloté par son
 * flux bespoke (`drive` = roll → confirm, qui avance la cascade) ; `choice` = vrai choix laissé au joueur
 * en Rapide (Surincantation, menu de Désengagement) ou multi-participant rare (Test étendu, Enfoncer la
 * porte) — tranché par l'IA en Auto-combat (C4). Record exhaustif : ajouter un `jet` force une politique.
 */
export const JET_AUTO: Record<NonNullable<CascadeStep['jet']>, AutoPolicy> = {
  attack: { mode: 'self', drive: ['attackRoll', 'attackConfirm'] },
  trample: { mode: 'self', drive: ['trampleRoll', 'trampleConfirm'] }, // Piétinement : jet propre → Lancer puis Appliquer (comme l'attaque)
  defense: { mode: 'self', drive: ['defenseRoll', 'defenseConfirm'] },
  fumble: { mode: 'self', drive: ['fumbleRoll', 'fumbleConfirm'] },
  test: { mode: 'self', drive: ['testRoll', 'resolveTest'] },
  cast: { mode: 'choice', autoDrive: ['castRoll', 'castConfirm'] }, // Rapide : le joueur décide (surincantation) ; Auto-combat : l'IA incante (sans surincanter)
  disengage: { mode: 'choice' },  // menu d'options (Fuir / Esquiver) — initié par le joueur, n'arrive pas en Auto
  extended: { mode: 'choice' },   // multi-participant (rare en combat)
  forceDoor: { mode: 'choice' },  // multi groupOwner (rare en combat)
};

/** Jeton anti-ré-entrance / double-advance : chaque séquence lancée invalide les précédentes. */
let gen = 0;

/** Le combattant concerné par la modale active est-il piloté LOCALEMENT ? (coop : pas un héros distant.) */
function ownerLocal(s: GameState): boolean {
  const owner = modalOwnerOf(s);
  if (owner == null || owner === '*') return true; // hôte / moment partagé (résolu par l'hôte)
  return ownsLocally(s, owner);
}

/** Enchaîne les actions `drive` (roll → confirm…) sur des ticks espacés, puis re-tick pour la suite. */
function driveSelf(get: Get, set: Set, drive: readonly (keyof GameState)[]): void {
  const myGen = ++gen;
  let i = 0;
  const step = () => {
    if (myGen !== gen) return;                 // supersédé par un tick plus récent
    if (!ownerLocal(get())) return;
    if (i >= drive.length) { tickCombatAuto(get, set); return; } // séquence finie → continuer (étape/modale suivante)
    const fn = get()[drive[i++]] as undefined | (() => void);
    if (typeof fn === 'function') fn();        // roll() idempotent, puis confirm() (ferme/avance)
    scheduleCombatTimer(step, beatHold(get, 'autoResolve'));
  };
  step();
}

/** Auto-résout la cascade active : jet de COMBAT bespoke (JET_AUTO) ou jet générique nuit/voyage. */
function autoResolveCascade(get: Get, set: Set): void {
  const pc = get().pendingCascade;
  if (!pc) return;
  if (pc.cursor >= pc.participants.length) {
    // BILAN : combat → fermer ; voyage/nuit/test → laisser le RÉSUMÉ au joueur (« Terminer »).
    if (pc.purpose === 'combat') get().cascadeFinish();
    return;
  }
  const cur = pc.participants[pc.cursor];
  if (cur.jet) {
    const pol = JET_AUTO[cur.jet];
    if (pol.mode === 'self') { driveSelf(get, set, pol.drive); return; }
    // 'choice' (cast/disengage/…) : en Auto-combat, l'IA résout via `autoDrive` (incantation) ; en Rapide,
    // on LAISSE la modale au joueur (surincantation = vrai choix).
    if (pol.mode === 'choice' && cadenceAutoCombat() && pol.autoDrive) driveSelf(get, set, pol.autoDrive);
    return;
  }
  // Étape GÉNÉRIQUE non-jet. Un CHOIX : laissé au joueur en Rapide. En Auto-combat, tranché via le DÉFAUT
  // authoré (`defaultChoice`, ex. déviation Critique → 'devier') ; SANS défaut authoré → laissé au joueur
  // (jamais de hang : `stepAutoResolved` ne masque pas une telle modale).
  if (stepInteraction(cur) === 'choix') {
    if (!cadenceAutoCombat()) return;
    if (cur.chosen == null) {
      if (cur.defaultChoice == null) return; // pas de défaut → décision au joueur (la modale reste visible)
      get().cascadeChoose(cur.id, cur.defaultChoice);
    }
    // Combat : avancer d'UNE étape (comme le joueur) → les étapes-jet en aval (Maladresse…) gardent leur
    // driver bespoke au tick suivant, au lieu d'être écrasées par un `cascadeResolveAll` global.
    if (pc.purpose === 'combat') { get().cascadeNext(); scheduleCombatTimer(() => tickCombatAuto(get, set), beatHold(get, 'autoResolve')); return; }
  }
  get().cascadeResolveAll();
  scheduleCombatTimer(() => tickCombatAuto(get, set), beatHold(get, 'autoResolve')); // gérer le bilan / l'étape suivante
}

/** Une étape de cascade sera-t-elle auto-résolue ? (sert à MASQUER la modale, cf. `willAutoResolve`). */
function stepAutoResolved(step: CascadeStep): boolean {
  if (step.jet) {
    const pol = JET_AUTO[step.jet];
    if (pol.mode === 'self') return true;
    return pol.mode === 'choice' && cadenceAutoCombat() && !!pol.autoDrive; // incantation en Auto
  }
  if (stepInteraction(step) === 'choix') return cadenceAutoCombat() && step.defaultChoice != null; // choix : auto SEULEMENT si un défaut est authoré (sinon décision au joueur, pas de hang)
  return true; // jet/affichage générique (nuit/voyage) → cascadeResolveAll
}

/**
 * La modale ACTIVE va-t-elle être auto-résolue par le driver ? PURE (zéro effet) — lue par `ActiveModal`
 * pour NE PAS la rendre du tout (fini le flash de quelques ms en Rapide/Auto). On NE masque PAS : le BILAN
 * d'une cascade voyage/nuit (le joueur veut voir le résumé), ni un vrai choix laissé au joueur (surincantation
 * ou Destin en Rapide), ni la modale d'un combattant non piloté localement (coop).
 */
export function willAutoResolve(s: GameState): boolean {
  if (!cadenceAuto() || !ownerLocal(s)) return false;
  const pol = autoPolicyOf(s);
  if (!pol) return false;
  switch (pol.mode) {
    case 'hostOnly': return false;
    case 'self': return true;
    case 'choice': return cadenceAutoCombat() && (pickActiveModalKey(s) === 'fateSave' || !!pol.autoDrive);
    case 'partial': {
      if (pickActiveModalKey(s) === 'reveal') return true;
      const pc = s.pendingCascade;
      if (!pc) return false;
      if (pc.cursor >= pc.participants.length) return pc.purpose === 'combat'; // bilan : combat masqué ; voyage/nuit MONTRÉ
      return stepAutoResolved(pc.participants[pc.cursor]);
    }
  }
}

/**
 * TICK du pilote d'auto-cadence. Appelé depuis la chaîne de reprise GARDÉE (C3/C4) — JAMAIS un pilote
 * async parallèle. No-op hors Rapide/Auto, sur une modale non pilotée localement, ou `hostOnly`/`choice`
 * (le `choice` en Auto-combat est tranché par `runActorAI` / la politique Destin — C4).
 */
export function tickCombatAuto(get: Get, set: Set): void {
  if (!cadenceAuto()) return;
  const s = get();
  if (!ownerLocal(s)) return;
  const pol = autoPolicyOf(s);
  if (!pol) return;
  switch (pol.mode) {
    case 'hostOnly':
      return;
    case 'choice':
      // Auto-combat seul : le Sauvetage par Destin est dépensé automatiquement pour éviter la mort
      // (RAW : `fateNegate` « Comment ça a pu rater ? » sur un coup, sinon `fateSurvive` « Meurs un
      // autre jour »). En Rapide, on NE touche PAS (la modale reste — vrai choix du joueur).
      if (cadenceAutoCombat() && pickActiveModalKey(s) === 'fateSave') {
        const hit = s.pendingFateSave?.source === 'hit';
        scheduleCombatTimer(() => (hit ? get().fateNegate() : get().fateSurvive()), beatHold(get, 'autoResolve'));
      }
      return;
    case 'partial':
      if (pickActiveModalKey(s) === 'reveal') { scheduleCombatTimer(() => get().dismissReveal(), beatHold(get, 'autoResolve')); return; }
      autoResolveCascade(get, set);
      return;
    case 'self':
      driveSelf(get, set, pol.drive);
      return;
  }
}

/**
 * Branche le pilote sur le store (appelé UNE fois au démarrage — cf. `initAudioWiring`). À chaque
 * changement d'état, si la Cadence n'est pas « manuel », un tick est planifié (hors du cycle de `set`,
 * coalescé par `scheduled`). En mode manuel (défaut) : zéro overhead (la souscription sort aussitôt).
 */
let scheduled = false;
export function initCombatAuto(): void {
  useGame.subscribe(() => {
    if (!cadenceAuto() || scheduled) return;
    scheduled = true;
    scheduleCombatTimer(() => { scheduled = false; tickCombatAuto(useGame.getState, useGame.setState); }, 0);
  });
}
