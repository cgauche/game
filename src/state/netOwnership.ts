/**
 * Possession réseau (Jalon 7) — l'HÔTE valide les INTENTS reçus : un invité ne pilote que SES
 * combattants. Le « qui est concerné » vient du REGISTRE des modales (`modalArbiter.MODAL_DEFS`,
 * source unique partagée avec le gating d'affichage UI) — ajouter une modale n'exige RIEN ici.
 */
import type { GameState } from './store';
import type { Combatant } from '../engine/types';
import { modalOwnerOf, horsModalOwnedIntents, horsModalByPending, type HorsModalDef } from './modalArbiter';
import { inBattleId, actorIn } from './combatOrParty';
import { targetingHolder } from './targetingHolder';
import { cadenceAuto, cadenceAutoCombat } from '../engine/cadence';
import { desFixes } from '../engine/fixedDie';
import { FLOW_VERBS, jetOwnedIntents, participantOwnedIntents, type JetOwnerRef } from './flowVerbs';
import type { PendingKey } from './stateFields';

export { modalOwnerOf } from './modalArbiter';
import { WORLD_STEP_OWNER } from './pendings';
export { WORLD_STEP_OWNER } from './pendings';

/** Intents de JET dont le 1ᵉʳ argument est l'id du combattant qui tient le slot — DÉRIVÉS de
 *  `FLOW_VERBS` (`kind:'multi'` + `pidIsActor`), jamais énumérés à la main. */
const PARTICIPANT_OWNED_INTENTS: ReadonlySet<string> = new Set(participantOwnedIntents());

/** Intents de JET dont la possession suit le PORTEUR du jet (`s[pending][field]`) — DÉRIVÉS de
 *  `FLOW_VERBS` (`kind:'mono'` + `jetOwner`), jamais énumérés à la main. */
const JET_OWNED_INTENTS: Readonly<Record<string, JetOwnerRef>> = jetOwnedIntents();

/** Intents adossés à une fenêtre HORS registre de modales (`HORS_MODAL`, #1016) — DÉRIVÉS de ce
 *  registre, jamais énumérés à la main. */
const HORS_MODAL_OWNED_INTENTS: Readonly<Record<string, HorsModalDef>> = horsModalOwnedIntents();

/** Fenêtres HORS-modale indexées par leur `pending*` (#1016) — la possession du CLIC DE CARTE s'y
 *  prend quand `targetingHolder` désigne l'une d'elles. */
const HORS_MODAL_BY_PENDING: Readonly<Record<string, HorsModalDef>> = horsModalByPending();

/**
 * VERROU DE COMPILATION (#1005) : toute clé `pending` déclarée par un `jetOwner` de `FLOW_VERBS` doit
 * être un `pending*` RÉEL de l'état (`PendingKey`, dérivé — cf. `stateFields.ts`). Le verrou vit ICI et
 * pas dans la table : `flowVerbs.ts` ne peut pas importer un type de `GameState` sans rendre `FLOWS`
 * `any` (cf. son en-tête). Une coquille (`pendingCastX`) ne lèverait AUCUNE erreur au site de la table
 * et fermerait en silence TOUS les verbes du flux — elle s'affiche ici en litige (patron
 * `modalArbiter._pendingOwnerCoverage`).
 */
type _JetOwnerPending = {
  [K in keyof typeof FLOW_VERBS]: (typeof FLOW_VERBS)[K] extends { jetOwner: { pending: infer P } } ? P : never;
}[keyof typeof FLOW_VERBS];
type _JetOwnerPendingReal = [Exclude<_JetOwnerPending, PendingKey>] extends [never]
  ? true
  : ['jetOwner.pending inconnu de PendingKey', Exclude<_JetOwnerPending, PendingKey>];
const _jetOwnerPendingCheck: _JetOwnerPendingReal = true;
void _jetOwnerPendingCheck;

/**
 * 2ᵉ VERROU DE COMPILATION (#1015) : le `field` d'un `jetOwner` doit être un champ RÉEL du pending
 * déclaré, et de type `string` (l'id d'un combattant). Le verrou de `pending` seul laissait passer une
 * coquille de `field` (`attackerId2`) ou un champ non-id (`result`) : `intentAllowedFor` n'y lirait
 * jamais d'`ownerId` et FERMERAIT en silence tous les verbes du flux. Le litige est NOMINATIF —
 * l'erreur affiche le tuple `[clé de flux, field fautif]`. ANGLE MORT ASSUMÉ : un champ ÉCHANGÉ de
 * même type (`moverId`→`foeId`) compile ; c'est la confrontation table⇄spec runtime qui le rattrape
 * (`jet-owner-vs-spec.test.ts`).
 */
type _NonNull<T> = Exclude<T, null | undefined>;
type _StringFieldsOf<K extends PendingKey> = Extract<
  { [F in keyof _NonNull<GameState[K]>]-?: _NonNull<GameState[K]>[F] extends string | undefined ? F : never }[keyof _NonNull<GameState[K]>],
  string
>;
type _JetOwnerFieldBad = {
  [K in keyof typeof FLOW_VERBS]: (typeof FLOW_VERBS)[K] extends { jetOwner: { pending: infer P; field: infer F } }
    ? P extends PendingKey
      ? F extends _StringFieldsOf<P>
        ? never
        : [K, F]
      : never // clé de pending fautive : déjà en litige au verrou ci-dessus
    : never;
}[keyof typeof FLOW_VERBS];
type _JetOwnerFieldReal = [_JetOwnerFieldBad] extends [never]
  ? true
  : ['jetOwner.field inconnu du pending (ou non-string)', _JetOwnerFieldBad];
const _jetOwnerFieldCheck: _JetOwnerFieldReal = true;
void _jetOwnerFieldCheck;

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

/**
 * SIÈGE AGISSANT (#1017) — quel siège joue le geste EN COURS. Normalement `net.mySeat` (le joueur
 * devant l'écran) ; mais l'HÔTE exécute aussi les gestes des AUTRES sièges quand il applique un
 * intent reçu (`netFlow.applyIntent`), et il les exécute DANS SON PROPRE store. Sans ce contexte,
 * toute garde d'action bâtie sur « le siège local possède-t-il ce combattant ? » (les ~30
 * `controlsCombatant` de `combatSlice`, dont `battleBattement`/`battleDisengage`) répondait NON
 * chez l'hôte pour le héros d'un invité : l'intent était accepté par `intentAllowedFor` puis
 * l'action refusait EN SILENCE, sans journal ni erreur (mesuré : `pendingBattement` jamais posé).
 * Le contexte est posé UNIQUEMENT autour de l'appel synchrone de l'action, jamais pendant un rendu.
 */
let actingSeat: number | null = null;

/** Le siège qui joue le geste en cours (`null` hors application d'intent = le siège local). */
export function actingSeatOf(): number | null {
  return actingSeat;
}

/**
 * Exécute `fn` AU NOM de `seat` (application d'un intent reçu). CONTRAT : le contexte couvre l'appel
 * SYNCHRONE — un travail différé par l'action (timer de cadence, animation) le relira retombé, donc
 * il retrouve le siège local, comme avant. Réentrant (restaure la valeur précédente, pas `null`).
 */
export function withActingSeat<T>(seat: number, fn: () => T): T {
  const prev = actingSeat;
  actingSeat = seat;
  try {
    return fn();
  } finally {
    actingSeat = prev;
  }
}

/** Le siège au nom duquel on décide MAINTENANT : celui qui agit s'il y en a un, sinon le siège local. */
function decidingSeat(s: GameState): number {
  return actingSeat ?? s.net.mySeat;
}

/**
 * Le siège LOCAL possède-t-il ce combattant ? Prédicat d'AFFICHAGE (qui rend la fenêtre, qui voit le
 * bandeau spectateur) — il DÉLÈGUE à `seatOwns`, source unique du routage siège→combattant employée par
 * la validation d'intent : afficher et agir ne peuvent pas répondre différemment. Un ennemi / une étape
 * MONDE appartient donc au siège MJ (`gmSeat`) quand il existe, pas « à l'hôte par défaut ».
 * Solo (`mode:'local'`) : toujours vrai. Sans combattant concerné : l'hôte.
 * Pendant l'application d'un intent, « local » = le siège AGISSANT (cf. `withActingSeat`) — c'est ce
 * qui permet aux gardes d'action de `combatSlice` de servir l'invité sans une ligne de code par flux.
 */
export function ownsLocally(state: GameState, combatantId: string | undefined): boolean {
  const { mode, mySeat } = state.net;
  if (mode === 'local') return true;
  if (actingSeat != null) return seatOwns(state, actingSeat, combatantId); // `seatOwns` traite l'absence d'acteur
  if (!combatantId) return mode === 'host';
  return seatOwns(state, mySeat, combatantId);
}

/**
 * Le JET de ce combattant doit-il être SURFACÉ (fenêtre influençable) plutôt que roulé en silence ?
 * INVARIANT : un jet se surface dès qu'un siège humain QUELCONQUE possède son porteur — le pilote de
 * l'ADVERSAIRE n'entre pas dans la condition ; un porteur surfacé n'est JAMAIS roulé en silence.
 * SEAT-AGNOSTIQUE (≠ `pilotedByHuman`, qui décide de l'AFFORDANCE LOCALE) : le héros d'un AUTRE siège
 * surface aussi — c'est SON joueur qui roulera. Les gardes RAW restent au site appelant (Défense :
 * portée de mêlée, `rangedDefenseModes` — un tir sans mode de défense RAW reste NON OPPOSÉ, LDB 13
 * l.125 ; Contre-sort : éligibilité `counterspellCandidates`, LDB 46 l.156).
 * SOURCE UNIQUE du surfaçage RÉACTIF : Défense (#989) et Contre-sort (#1028).
 */
export function jetSurfaced(s: GameState, c: Combatant): boolean {
  if (c.kind === 'hero') return !c.aiControlled;
  if (c.kind === 'enemy') return s.net.gmSeat != null;
  return false;
}

/** Surfaçage de la DÉFENSE (#989) — nom de domaine des sites d'attaque (`maybeOpenDefense`,
 *  `resolveAttack`, `surfacedDefensePending`), qui DÉLÈGUE au prédicat général ci-dessus : une seule
 *  implémentation du surfaçage réactif, jamais deux tables de vérité. */
export function defenseSurfaced(s: GameState, defender: Combatant): boolean {
  return jetSurfaced(s, defender);
}

/**
 * Le combattant `c` est-il piloté À LA MAIN par un humain ? — CADENCE-AGNOSTIQUE (vrai même en Rapide/
 * Auto : décrit QUI possède le contrôle, pas s'il est déféré à un automate). Un HÉROS non-`aiControlled`
 * contrôlé localement → vrai ; un ENNEMI → vrai ssi un siège porte le rôle MJ (`gmSeat` — bac-à-sable ;
 * les jets du monde remontent au siège MJ) ; un PNJ neutre → faux. Prédicat de l'AFFORDANCE LOCALE
 * (qui a la main ICI) ; le SURFAÇAGE d'une défense, lui, passe par `defenseSurfaced` ci-dessus.
 */
export function pilotedByHuman(s: GameState, c: Combatant): boolean {
  if (c.kind === 'hero') return !c.aiControlled && ownsLocally(s, c.id);
  if (c.kind === 'enemy') return s.net.gmSeat != null; // conduit par le MJ (bac-à-sable) sinon IA
  return false;
}

/**
 * Ce siège a-t-il produit CE jet lui-même ? — prédicat de PRÉSENTATION (#990) : un siège ne se masque
 * jamais son propre dé. COMPOSE l'existant : contrôle humain LOCAL (`pilotedByHuman`, qui encode déjà
 * l'affordance de siège) ET possession locale (`ownsLocally`). Distinct de `ownsLocally` seul (vrai
 * pour TOUS en solo — un masque bâti dessus serait mort en solo) et de `controlsCombatant` (faux pour
 * mon propre héros en Auto-combat — son jet reste le mien). `ownerId` absent = adversaire ABSTRAIT
 * (table de taverne, aucun Combatant) : jamais produit par ce siège.
 */
export function rolledLocally(s: GameState, ownerId: string | undefined): boolean {
  if (!ownerId) return false;
  const c = actorIn(s, ownerId);
  return !!c && pilotedByHuman(s, c) && ownsLocally(s, c.id);
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
  // Ennemi/monde conduit par le MJ : seul le siège MJ le pilote — comparé au siège qui DÉCIDE
  // maintenant (le siège local, ou le siège AGISSANT pendant l'application de son intent).
  return s.net.mode === 'local' || s.net.gmSeat === decidingSeat(s);
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
 * CE siège peut-il INFLUENCER ce jet — y dépenser des ressources (Chance, relance, +1 DR, Sombre Pacte,
 * Résilience) ou en fixer le dé ? Prédicat UNIQUE de l'affordance d'influence (#1005), routé par le
 * PORTEUR du jet, employé PAR L'AFFICHAGE (`influencesLocally`, siège local) ET par la VALIDATION
 * D'INTENT (`intentAllowedFor`, siège émetteur) : afficher et agir ne peuvent pas répondre différemment.
 *  - héros → il n'est pas conduit par l'IA (`aiControlled`) et le siège le possède (`seatOwns`) ;
 *  - ennemi → le siège porte le rôle MJ (bac-à-sable) ; sans siège MJ, l'ennemi est à l'IA (qui roule
 *    sans ces verbes) et personne — hôte compris — ne dépense ses ressources ;
 *  - PNJ neutre → jamais ;
 *  - étape MONDE (`WORLD_STEP_OWNER`) ou jet sans acteur → `seatOwns` (le siège MJ s'il existe, l'hôte
 *    sinon).
 * Un `ownerId` qui ne désigne aucun combattant connu → faux (jamais d'affordance sur un jet inconnu).
 * Solo (`mode:'local'`) : un seul siège, il tient tout ce qu'un humain pilote.
 */
export function seatInfluences(s: GameState, seat: number, ownerId: string | undefined): boolean {
  if (ownerId == null || ownerId === WORLD_STEP_OWNER) return seatOwns(s, seat, WORLD_STEP_OWNER);
  const c = actorIn(s, ownerId);
  if (!c) return false;
  const solo = s.net.mode === 'local';
  if (c.kind === 'hero') return !c.aiControlled && (solo || seatOwns(s, seat, c.id));
  if (c.kind === 'enemy') return s.net.gmSeat != null && (solo || s.net.gmSeat === seat);
  return false;
}

/**
 * Le siège LOCAL peut-il influencer ce jet ? Vue au siège local de `seatInfluences` ci-dessus (source
 * unique). Distinct de `ownsLocally` (vrai pour TOUS en solo : un gate bâti dessus laisse le joueur
 * dépenser la Résilience d'un ENNEMI) et de `rolledLocally` (calendrier de MASQUAGE, #990).
 */
export function influencesLocally(s: GameState, ownerId: string | undefined): boolean {
  return seatInfluences(s, s.net.mySeat, ownerId);
}

/**
 * Le joueur LOCAL peut-il FIXER lui-même la valeur du d100 de ce jet ? Prédicat UNIQUE de l'option de
 * confort « Dés fixés » (`engine/fixedDie.ts`) : l'option est active ET le siège local peut influencer
 * ce jet (`influencesLocally` ci-dessus — même routage porteur→siège, source unique).
 */
export function canFixDie(s: GameState, ownerId: string | undefined): boolean {
  return desFixes() && influencesLocally(s, ownerId);
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
    // Actif non-héros : conduit par le siège MJ (bac-à-sable) → affordances si le siège qui DÉCIDE porte
    // le rôle MJ (le siège local, ou le siège AGISSANT pendant son intent). Sans MJ (`gmSeat` null) →
    // tour IA : vrai (l'UI est déjà inerte par ses propres verrous — inchangé). NB : le surfaçage FIN
    // des affordances passe par `controlsCombatant`.
    if (!pilotedByHuman(state, active)) return true;
    return state.net.mode === 'local' || state.net.gmSeat === decidingSeat(state);
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
  // Flux MULTI dont le slot porte SON acteur (`FLOW_VERBS.pidIsActor`) : le JET d'un participant est
  // piloté par le propriétaire de CE combattant (1ᵉʳ arg = son id). Les décisions de GROUPE (Confirm/
  // Cancel) restent ouvertes ('*' via le owner de la modale), et les flux à `pidIsActor:false`
  // (`cascade`, `extendedTest` : args[0] = id d'étape/de Round) tombent sur le owner de LEUR modale.
  if (PARTICIPANT_OWNED_INTENTS.has(action)) {
    return seatOwns(s, seat, typeof args[0] === 'string' ? args[0] : undefined);
  }
  // Flux MONO à fenêtre PARTAGÉE (`FLOW_VERBS.jetOwner`, #1005) : ces verbes DÉPENSENT les ressources du
  // porteur du jet (Chance, Résilience, Corruption du Pacte) — la possession suit ce porteur, désigné en
  // donnée, et par le MÊME prédicat que l'affordance affichée (`seatInfluences`). Sans cette route, un
  // Sort ENNEMI (étape `groupOwner` → owner de modale '*', pour que cible et contre-lanceurs voient la
  // fenêtre) accepterait la dépense de n'importe quel siège.
  // Portée : comme la route participant voisine, elle court-circuite `modalOwnerOf` — un `pendingCast`
  // résiduel reste dépensable par son porteur pendant qu'une modale prioritaire d'un autre siège est
  // ouverte (même contrat que `PARTICIPANT_OWNED_INTENTS`).
  const jet = JET_OWNED_INTENTS[action];
  if (jet) {
    const pending = (s as unknown as Record<string, Record<string, unknown> | null | undefined>)[jet.pending];
    const ownerId = pending && typeof pending[jet.field] === 'string' ? (pending[jet.field] as string) : undefined;
    return !!ownerId && seatInfluences(s, seat, ownerId); // jet fermé/inconnu → personne ne dépense
  }
  // CLIC DE CARTE pendant un ciblage détenu par une fenêtre HORS registre de modales (#1016) — c'est
  // LE chemin vivant : l'invité ne demande jamais `cleaveAttack`/`dualStrikeAttack` (appelés en
  // INTERNE par `targetingModes`), il clique, et le clic voyage par `battleClickEntity`/
  // `battleClickTile`. Ces deux verbes retombaient sur `modalOwnerOf`, qui ne consulte que
  // `MODAL_DEFS` : sous un `fateSave` (1ʳᵉ entrée, priorité maximale) l'attaquant qui balaie était
  // REFUSÉ et la victime acceptée — son clic mourait ensuite dans les gardes de `battleClickEntity`,
  // donc PERSONNE ne poursuivait le balayage. Tant qu'un pending hors-modale tient le ciblage
  // (`targetingHolder`, source unique partagée avec l'aiguilleur), le clic appartient au PORTEUR de
  // ce pending : l'attaquant du balayage / de la 2ᵉ frappe, l'artilleur du pilonnage indirect. Aucun
  // pending détenteur → le clic universel garde ses règles (repli inchangé, plus bas).
  if (action === 'battleClickEntity' || action === 'battleClickTile') {
    const held = targetingHolder(s);
    const def = held ? HORS_MODAL_BY_PENDING[held] : undefined;
    if (def) {
      const owner = def.owner(s);
      return owner === '*' || seatOwns(s, seat, owner); // `undefined` → l'hôte (contrat de `seatOwns`)
    }
  }
  // Gestes TERMINAUX d'une fenêtre HORS registre de modales (`HORS_MODAL.intents`) : même route, prise
  // au pending qui héberge le geste. `cleaveEnd`/`dualStrikeSkip` sont émis par la barre d'action
  // (`ActionBar`, sortie d'interlude) ; `cleaveAttack`/`dualStrikeAttack` n'ont AUCUN émetteur d'UI
  // aujourd'hui (défense en profondeur pour un futur émetteur direct — table `EMISSION` de
  // `hors-modal-intent-path.test.ts`).
  const horsModal = HORS_MODAL_OWNED_INTENTS[action];
  if (horsModal) {
    if (!s[horsModal.pendingKey]) return false; // fenêtre fermée → personne (le geste y est inerte)
    const owner = horsModal.owner(s);
    return owner === '*' || seatOwns(s, seat, owner); // `undefined` → l'hôte (contrat de `seatOwns`)
  }
  // Pause de début de Round (`pendingRoundStart`) : la FENÊTRE est à tous ('*' — ready-check par siège),
  // ses deux gestes ne le sont pas.
  //  - `roundStartPromote` dépense la Chance du héros promu (LDB 17 l.27) → routé par le prédicat des
  //    dépenses sur CE héros. Sans cette route, aucun `pending*` du registre des modales n'étant ouvert,
  //    le repli tombait sur le combattant ACTIF — inexistant pendant la pause (`turn: -1`, cf.
  //    `combatFlow.enterRoundStartPause`) : la promotion était refusée à TOUT siège invité, et la Chance
  //    du héros devenait indépensable en coop.
  //  - `confirmRoundStart` lance le Round pour TOUS : l'invité marque son siège (`roundStartReady`,
  //    accepté plus haut) et l'hôte clôt à l'unanimité (`combatSlice.roundStartReady`).
  if (action === 'roundStartPromote') {
    return !!s.pendingRoundStart && seatInfluences(s, seat, typeof args[0] === 'string' ? args[0] : undefined);
  }
  if (action === 'confirmRoundStart') return seatOwns(s, seat, undefined);
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
