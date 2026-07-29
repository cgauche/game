/**
 * Possession réseau (Jalon 7) — l'HÔTE valide les INTENTS reçus : un invité ne pilote que SES
 * combattants. Le « qui est concerné » vient du REGISTRE des modales (`modalArbiter.MODAL_DEFS`,
 * source unique partagée avec le gating d'affichage UI) — ajouter une modale n'exige RIEN ici.
 */
import type { GameState } from './store';
import type { Combatant } from '../engine/types';
import { modalOwnerOf } from './modalArbiter';
import { inBattleId, actorIn } from './combatOrParty';
import { cadenceAuto, cadenceAutoCombat } from '../engine/cadence';
import { desFixes } from '../engine/fixedDie';

export { modalOwnerOf } from './modalArbiter';
import { WORLD_STEP_OWNER } from './pendings';
export { WORLD_STEP_OWNER } from './pendings';

/** Le siège possède-t-il ce combattant ? (héros non attribué → hôte, siège 0). */
export function seatOwns(s: GameState, seat: number, combatantId: string | undefined): boolean {
  // Étape MONDE sans acteur (désertion, Moral…) : le siège MJ la possède quand il existe, l'hôte sinon
  // (bac-à-sable MJ — même politique que l'ennemi `kind:'enemy'` ci-dessous, étendue au hors-combat).
  if (combatantId === WORLD_STEP_OWNER) return s.net.gmSeat != null ? seat === s.net.gmSeat : seat === 0;
  if (!combatantId) return seat === 0;
  // Bac-à-sable MJ : un combattant NON-héros (ennemi/monde) est conduit par le siège MJ (`gmSeat`), pas
  // par `ownership` (réservé aux héros) — les intents de son tour/ses modales remontent donc au MJ.
  const c = inBattleId(s.battle, combatantId);
  if (c && c.kind === 'enemy' && s.net.gmSeat != null) return seat === s.net.gmSeat;
  return (s.net.ownership[combatantId] ?? 0) === seat;
}

/** Le siège LOCAL possède-t-il ce combattant ? (gating d'affichage P2 — vrai en solo/hôte par défaut.) */
export function ownsLocally(state: GameState, combatantId: string | undefined): boolean {
  const { mode, mySeat, ownership } = state.net;
  if (mode === 'local') return true;
  if (!combatantId) return mode === 'host';
  return (ownership[combatantId] ?? 0) === mySeat;
}

/**
 * Le combattant `c` est-il piloté À LA MAIN par un humain ? — CADENCE-AGNOSTIQUE (vrai même en Rapide/
 * Auto : décrit QUI possède le contrôle, pas s'il est déféré à un automate). Un HÉROS non-`aiControlled`
 * contrôlé localement → vrai ; un ENNEMI → vrai ssi un siège porte le rôle MJ (`gmSeat` — bac-à-sable ;
 * les jets du monde remontent au siège MJ) ; un PNJ neutre → faux. SOURCE des décisions de surfaçage
 * RÉACTIF (défense/manœuvre/corruption…).
 */
export function pilotedByHuman(s: GameState, c: Combatant): boolean {
  if (c.kind === 'hero') return !c.aiControlled && ownsLocally(s, c.id);
  if (c.kind === 'enemy') return s.net.gmSeat != null; // conduit par le MJ (bac-à-sable) sinon IA
  return false;
}

/**
 * Le combattant `c` est-il piloté par l'IA ? — base AGNOSTIQUE AU CAMP de l'orchestrateur de tour.
 * Un ENNEMI l'est SAUF si un siège porte le rôle MJ (`gmSeat`, bac-à-sable). Un HÉROS l'est en mode
 * Auto-combat ET contrôlé LOCALEMENT (coop : on ne joue jamais le héros d'un autre siège), ou s'il porte
 * le drapeau `aiControlled` (PNJ allié IA). Un PNJ neutre ne l'est jamais. NB : `aiDriven` ne change PAS
 * le `kind` du combattant. (Vit ICI, avec les primitives d'« qui pilote quoi » : `controlsActive`/
 * `controlsCombatant` en dépendent ; `combatGate` le ré-exporte pour ses consommateurs historiques.)
 */
export function aiDriven(s: GameState, c: Combatant): boolean {
  if (c.kind === 'enemy') return s.net.gmSeat == null; // ennemi = IA SAUF si un siège MJ le conduit
  // PNJ allié IA (`Combatant.aiControlled`, ex. défenseur de siège) : agit SEUL même en jeu MANUEL — sans
  // attendre l'Auto-combat global. On ne pilote jamais le combattant d'un AUTRE siège (`ownsLocally`).
  if (c.kind === 'hero' && c.aiControlled) return ownsLocally(s, c.id);
  return c.kind === 'hero' && cadenceAutoCombat() && ownsLocally(s, c.id);
}

/**
 * Le siège LOCAL pilote-t-il À LA MAIN ce combattant MAINTENANT ? — prédicat UNIQUE des affordances de TOUR
 * (grille de déplacement, réticule, barre d'action, hotbar). Héros manuel → vrai ; héros Auto-combat →
 * faux ; PNJ `aiControlled` → faux ; ennemi sans MJ → faux ; ENNEMI quand le siège LOCAL porte le rôle MJ
 * → vrai (coop : `gmSeat === mySeat`) ; invocation alliée (`kind:'hero'`) → comme un héros.
 */
export function controlsCombatant(s: GameState, c: Combatant): boolean {
  if (!pilotedByHuman(s, c) || aiDriven(s, c)) return false;
  if (c.kind === 'hero') return true; // `pilotedByHuman` encode déjà `ownsLocally` (siège-aware)
  // Ennemi/monde conduit par le MJ : seul le siège MJ LOCAL le pilote (coop : gmSeat === mySeat).
  return s.net.mode === 'local' || s.net.gmSeat === s.net.mySeat;
}

/**
 * Le Test d'un combattant doit-il REMONTER à un humain (modale/étape de cascade influençable) plutôt
 * qu'être résolu en silence ? SOURCE UNIQUE d'escalade des jets de FIN DE ROUND / entretien : contrôle
 * HUMAIN (`pilotedByHuman`) ET cadence MANUELLE (`!cadenceAuto` : en Rapide/Auto les jets se lancent
 * seuls, sans influence, donc résolus inline comme un monstre).
 */
export function humanControlled(s: GameState, c: Combatant): boolean {
  return !cadenceAuto() && pilotedByHuman(s, c);
}

/**
 * Le joueur LOCAL peut-il FIXER lui-même la valeur du d100 de ce jet ? Prédicat UNIQUE de l'option de
 * confort « Dés fixés » (`engine/fixedDie.ts`) : l'option est active ET le siège local CONTRÔLE le jet.
 * Aucun modèle de contrôle parallèle — les trois cas COMPOSENT l'existant de ce module :
 *  - héros → `pilotedByHuman` (l.44, qui encode déjà `ownsLocally` : le siège d'un autre joueur ne fixe
 *    pas mes dés, et réciproquement) ;
 *  - ennemi → `controlsCombatant` (l.87 : conduit par le siège MJ, et par LUI seul `gmSeat === mySeat`) —
 *    sans siège MJ pris, l'ennemi est à l'IA et rien n'est offert ;
 *  - étape MONDE (`WORLD_STEP_OWNER`) ou jet sans acteur → `seatOwns` (l.20 : le siège MJ s'il existe,
 *    l'hôte sinon).
 * Un `ownerId` qui ne désigne aucun combattant connu → faux (jamais d'affordance sur un jet inconnu).
 */
export function canFixDie(s: GameState, ownerId: string | undefined): boolean {
  if (!desFixes()) return false;
  if (ownerId == null || ownerId === WORLD_STEP_OWNER) return seatOwns(s, s.net.mySeat, WORLD_STEP_OWNER);
  const c = actorIn(s, ownerId);
  if (!c) return false;
  return c.kind === 'hero' ? pilotedByHuman(s, c) : controlsCombatant(s, c);
}

/** Le joueur LOCAL contrôle-t-il (À LA MAIN) le combattant ACTIF du combat ? Faux pendant le tour du héros
 *  d'un AUTRE joueur (hôte inclus), ET faux quand le héros actif est piloté par l'IA (Auto-combat) : l'UI
 *  traite alors ce tour comme un tour ennemi — AUCUNE affordance (grille de déplacement, réticule, barre
 *  d'action, raccourcis). Tour ennemi → vrai : l'IA tourne et l'UI est déjà inerte par ses propres verrous. */
export function controlsActive(state: GameState): boolean {
  const b = state.battle;
  if (!b || b.over) return true;
  const activeId = b.order[b.turn];
  const active = inBattleId(b, activeId);
  if (!active) return true;
  if (active.kind !== 'hero') {
    // Actif non-héros : conduit par le siège MJ (bac-à-sable) → affordances si le siège LOCAL porte le rôle
    // MJ (coop : `gmSeat === mySeat`). Sans MJ (`gmSeat` null) → tour IA : vrai (l'UI est déjà inerte par
    // ses propres verrous — inchangé). NB : le surfaçage FIN des affordances passe par `controlsCombatant`.
    if (!pilotedByHuman(state, active)) return true;
    return state.net.mode === 'local' || state.net.gmSeat === state.net.mySeat;
  }
  if (aiDriven(state, active)) return false; // Auto-combat : l'IA pilote ce héros → pas d'affordance joueur
  if (state.net.mode === 'local') return true;
  return ownsLocally(state, activeId);
}

/** Emplacements de groupe encore à remplir par ce siège : slots attribués − héros possédés.
 *  (En mode local, slots = [0,0,0,0] → l'hôte garde les 4 emplacements, comme avant la coop.) */
export function seatSlotsRemaining(s: GameState, seat: number): number {
  const slots = (s.net.slots ?? [0, 0, 0, 0]).filter((x) => x === seat).length;
  const owned = s.party.filter((h) => (s.net.ownership[h.id] ?? 0) === seat).length;
  return slots - owned;
}

/** L'HÔTE accepte-t-il cet intent de `seat` ? Modale ouverte → seul son concerné agit ('*' = tous) ;
 *  sinon → seul le propriétaire du combattant ACTIF agit. Cas à part : les ready-checks et la levée
 *  de main marquent leur propre siège ; `assignVictoryGear` n'attribue le butin qu'à SES héros. */
export function intentAllowedFor(s: GameState, seat: number, action: string, args: unknown[] = []): boolean {
  if (action === 'roundStartReady' || action === 'victoryReady' || action === 'raiseHand') return true;
  if (action === 'assignVictoryGear') return seatOwns(s, seat, typeof args[1] === 'string' ? args[1] : undefined);
  // Composition du groupe : un siège remplit SES emplacements (quota attribué par l'hôte) et
  // ne retire que SES héros.
  if (action === 'partyAddHero') return seatSlotsRemaining(s, seat) > 0;
  if (action === 'partyRemoveHero') return seatOwns(s, seat, typeof args[0] === 'string' ? args[0] : undefined);
  // Remplacement EN PLACE : le siège doit posséder l'ANCIEN héros (1er arg). L'effectif ne change
  // pas (1 héros pour 1) → aucun check de quota d'emplacements.
  if (action === 'partyReplaceHero') return seatOwns(s, seat, typeof args[0] === 'string' ? args[0] : undefined);
  // Activités d'interlude (audit M7) : le 1er argument est le héros visé — son propriétaire agit
  // (`interludeActivity` = chemin UNIQUE des Activités à jet ; `interludeCraftStart`/`Order`/`Bank`).
  if (/^interlude(Activity|CraftStart|Order|Bank)$/.test(action)) {
    return seatOwns(s, seat, typeof args[0] === 'string' ? args[0] : undefined);
  }
  // Retrait bancaire : le dépôt appartient à un héros — son propriétaire retire.
  if (action === 'interludeWithdraw') {
    const dep = typeof args[0] === 'number' ? s.bank?.[args[0]] : undefined;
    return dep ? seatOwns(s, seat, dep.heroId) : false; // dépôt inconnu → personne
  }
  // Flux MULTI à participants = HÉROS (Contre-sort / Forçage de porte) : le JET d'un participant est
  // piloté par le propriétaire de CE héros (1ᵉʳ arg = son id). Les décisions de GROUPE (Confirm/
  // Cancel) restent ouvertes ('*' via le owner de la modale). NB : le Test Étendu (ROUNDS) et la
  // CASCADE (ÉTAPES, `args[0]` = id d'étape ≠ héros) tombent sur le owner de LEUR modale — l'acteur
  // du Round / l'acteur de l'étape COURANTE — pas sur `args[0]`.
  if (/^(counterspell|forceDoor|shipManeuver|shipBattery|crewTest|flee)(Roll|Reroll|BonusSL|DarkPact|ForceSuccess|SetForcedRoll)$/.test(action)) {
    return seatOwns(s, seat, typeof args[0] === 'string' ? args[0] : undefined);
  }
  // #669 — Dialogue = décision de GROUPE (jeton unique d'exploration, piloté par l'hôte/MJ) : l'hôte choisit
  // la réponse, les autres LISENT. Un Test social DANS un dialogue reste arbitré par le propriétaire du héros
  // testeur (`openSkillTest`→`pendingTest`→modalArbiter).
  if (action === 'chooseDialogue' || action === 'closeDialogue' || action === 'interactEntity') {
    return seat === (s.net.gmSeat ?? 0);
  }
  const owner = modalOwnerOf(s);
  if (owner === '*') return true;
  if (owner !== null) return seatOwns(s, seat, owner);
  const activeId = s.battle ? s.battle.order[s.battle.turn] : undefined;
  return seatOwns(s, seat, activeId);
}
