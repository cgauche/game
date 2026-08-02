/**
 * SOURCE UNIQUE du câblage des flux de jet différé — table de DONNÉES PURE (aucun import runtime).
 *
 * Elle vit à part de `rollFlowSpecs.ts` parce que ses consommateurs ne veulent PAS le graphe du store :
 * `net/intents.ts` en DÉRIVE la surface d'intents invité, et `rollFlowSpecs` (donc `FLOWS`, donc le store)
 * n'est pas importable depuis là sans cycle d'initialisation. `rollFlowSpecs` la ré-exporte pour ses
 * propres consommateurs.
 *
 * `FLOW_VERBS` porte, par flux (clé = PRÉFIXE des délégués `<prefix><Verbe>` du store), son type
 * (mono/multi), le SOUS-ENSEMBLE de verbes exposés, et `coop` — MAIS PAS le handler. C'est délibéré :
 * le handler `FLOWS.x` référence `Get`/`Set` → `GameState` → `RollFlowActionsMap`, donc l'inclure dans la
 * source du TYPE créerait un CYCLE (`FLOWS` deviendrait `any`). `FLOW_VERBS` (sans handler) est donc la
 * source du TYPE (`RollFlowActionsMap`, dans `rollFlowSpecs`) ET des verbes runtime/intents ;
 * `FLOW_HANDLERS` associe le handler pour le seul RUNTIME (`buildRollFlowActions`), avec exhaustivité
 * garantie. Le préfixe est DÉCORRÉLÉ de la clé `FLOWS` (2 cas : shipBattery→FLOWS.battery,
 * opposition→FLOWS.castOpposition).
 * `coop:true` = verbes exposés comme intents invité (dérivés par `coopFlowIntents`, `resist` exclu).
 */

/** Les verbes du cycle de jet différé (cf. `RollFlowHandlers`). `resist` = Résistance (Menace),
 *  LDB 10 — exposé par les seuls flux à `caps.resist` (Tests qui « résistent à une menace »).
 *  `cancel` = « Annuler » unifié (cascade-aware + `onCancel` métier) — exposé par les flux annulables ;
 *  sans `pid` (annuler ferme la modale/cascade entière, pas un slot). */
export type RollVerb = 'roll' | 'reroll' | 'bonusSL' | 'darkPact' | 'forceSuccess' | 'setForcedRoll' | 'resist' | 'determine' | 'cancel' | 'reverse';

interface FlowVerbsBase {
  verbs: readonly RollVerb[];
  /** Verbes exposés comme intents coop invité (dérivés ; `resist` toujours exclu). Défaut : false. */
  coop?: boolean;
}
/** Où vit, DANS l'état, l'id du combattant qui TIENT le jet d'un flux mono (`s[pending][field]`) —
 *  donnée pure, résolue par `netOwnership.intentAllowedFor`. `pending` reste `string` ICI : importer
 *  `PendingKey` (type de `GameState`) rendrait `FLOWS` `any` — le cycle que l'en-tête de ce module
 *  décrit (585 erreurs `TS2339` mesurées). Le VERROU de compilation qui exige un `pending*` réel vit
 *  donc chez le consommateur (`netOwnership._jetOwnerPendingCheck`), où `PendingKey` est importable. */
export interface JetOwnerRef { pending: string; field: string }

export type FlowVerbs =
  /** MONO : `jetOwner` déclare le PORTEUR du jet — l'acteur dont ces verbes DÉPENSENT les ressources
   *  (Chance, Résilience, Corruption du Pacte, jeton d'inversion). La possession se route sur LUI, et
   *  non sur le owner de la FENÊTRE ACTIVE, qui n'est pas le porteur dans deux situations mesurées :
   *  fenêtre PARTAGÉE (owner '*' — Sort ennemi hébergeant opposition/Contre-sort, #1005) et fenêtre
   *  d'un AUTRE acteur ouverte par-dessus (Défense interposée, #1013 : le siège du DÉFENSEUR tenait
   *  les verbes `attack*`, celui de l'attaquant les `defense*`).
   *  OBLIGATOIRE (#1015) : tout flux mono tranche sa possession, aucun repli silencieux sur le owner
   *  de la modale. Le porteur se lit au SITE QUI DÉPENSE — `rollFlowSpecs.<flux>.actor`, l'acteur que
   *  `opReroll`/`opBonusSL`/`opForceSuccess`/`opDarkPact` débitent — jamais au registre des modales
   *  (`MODAL_DEFS` porte des covers de cascade et des owners partagés `'*'`). La confrontation
   *  table⇄spec est GARDÉE (`jet-owner-vs-spec.test.ts`), la clé `pending` et le `field` sont verrouillés
   *  à la compilation (`netOwnership._jetOwnerPendingCheck` / `_jetOwnerFieldCheck`). */
  | (FlowVerbsBase & { kind: 'mono'; jetOwner: JetOwnerRef })
  /** MULTI : `pidIsActor` déclare à QUI appartient le 1ᵉʳ argument des délégués (`pid`) — `true` = l'id
   *  du COMBATTANT du slot (la possession du jet suit son propriétaire, `netOwnership`), `false` = un id
   *  de slot SANS acteur propre (Round, étape) → la possession retombe sur le owner de la modale.
   *  OBLIGATOIRE : tout flux multi tranche, aucun défaut silencieux. */
  | (FlowVerbsBase & { kind: 'multi'; pidIsActor: boolean });

export const FLOW_VERBS = {
  attack:       { kind: 'mono',  verbs: ['reroll', 'bonusSL', 'darkPact', 'cancel', 'forceSuccess', 'setForcedRoll', 'reverse'], coop: true, jetOwner: { pending: 'pendingAttack', field: 'attackerId' } },
  defense:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse'], coop: true, jetOwner: { pending: 'pendingDefense', field: 'defenderId' } },
  cast:         { kind: 'mono',  verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, jetOwner: { pending: 'pendingCast', field: 'casterId' } },
  disengage:    { kind: 'mono', verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, jetOwner: { pending: 'pendingDisengage', field: 'moverId' } },
  // « Fuir » : MULTI hétérogène (coup dans le dos du frappeur + Calme du fuyard) — `setForcedRoll`
  // sert le dé CHOISI du coup dans le dos (double 11 → Coup Critique, LDB 13 l.183).
  flee:         { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true },
  auContact:    { kind: 'mono', verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, jetOwner: { pending: 'pendingAuContact', field: 'moverId' } },
  grapple:      { kind: 'mono', verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, jetOwner: { pending: 'pendingGrapple', field: 'actorId' } },
  trample:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, jetOwner: { pending: 'pendingTrample', field: 'attackerId' } },
  battement:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingBattement', field: 'attackerId' } },
  distraire:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingDistraire', field: 'moverId' } },
  // Manœuvre de créature : la modale n'influence QUE le jet de l'ATTAQUANT (les jets des défenseurs
  // vivent dans `maneuverConfirm`) — le porteur est donc `attackerId`, jamais la cible.
  maneuver:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, jetOwner: { pending: 'pendingManeuver', field: 'attackerId' } },
  run:          { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true, jetOwner: { pending: 'pendingRun', field: 'combatantId' } },
  // Chute VOLONTAIRE (clic `FallOverlays`) : `coop` omis — ses verbes ne sont pas exposés à l'invité
  // (cf. `battement`/`distraire`).
  fall:         { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], jetOwner: { pending: 'pendingFall', field: 'combatantId' } },
  reload:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, jetOwner: { pending: 'pendingReload', field: 'actorId' } },
  handGate:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, jetOwner: { pending: 'pendingHandGate', field: 'attackerId' } },
  recover:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, jetOwner: { pending: 'pendingStateRecovery', field: 'actorId' } },
  focus:        { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, jetOwner: { pending: 'pendingFocus', field: 'casterId' } },
  // Contre-magie : `casterId` = le DISSIPEUR qui roule (le sort visé porte son propre `spellCasterId`,
  // qui ne dépense rien ici).
  dispel:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingDispel', field: 'casterId' } },
  frenzy:       { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true, jetOwner: { pending: 'pendingFrenzy', field: 'combatantId' } },
  approach:     { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact'], jetOwner: { pending: 'pendingApproach', field: 'combatantId' } },
  ward:         { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true, jetOwner: { pending: 'pendingWard', field: 'attackerId' } },
  // Soin / Chirurgie : le SOIGNEUR roule et dépense (le patient ne lance rien) — `targetId` ne porte
  // aucun jet.
  heal:         { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, jetOwner: { pending: 'pendingHeal', field: 'healerId' } },
  surgery:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true, jetOwner: { pending: 'pendingSurgery', field: 'healerId' } },
  corruption:   { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist'], coop: true, jetOwner: { pending: 'pendingCorruption', field: 'heroId' } },
  // Test générique : `actorId` est MUTABLE (`testSetActor` — le Test change de testeur en place) ; la
  // possession se résout À LA LECTURE de l'état, donc sur le testeur COURANT.
  test:         { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'reverse'], jetOwner: { pending: 'pendingTest', field: 'actorId' } },
  steamSave:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingSteamSave', field: 'actorId' } },
  activity:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingActivity', field: 'heroId' } },
  bargain:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingBargain', field: 'playerId' } },
  appraise:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], jetOwner: { pending: 'pendingAppraise', field: 'actorId' } },
  shanty:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], jetOwner: { pending: 'pendingShanty', field: 'singerId' } },
  counterspell: { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  // `pid` = id d'ÉTAPE (`CascadeStep.id`), pas un combattant : la possession d'un geste de cascade
  // vient du owner de la modale (`modalArbiter` : acteur de l'étape courante / '*' / siège MONDE).
  cascade:      { kind: 'multi', pidIsActor: false, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist', 'determine'], coop: true },
  opposition:   { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist'], coop: true },
  // `pid` = id de ROUND (`ExtendedTestRound.id`), pas un combattant : même politique que `cascade`.
  extendedTest: { kind: 'multi', pidIsActor: false, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  forceDoor:    { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  shipManeuver: { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true },
  shipBattery:  { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true },
  crewTest:     { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true },
  cascadeBatch: { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true },
} as const satisfies Record<string, FlowVerbs>;

export type FlowKey = keyof typeof FLOW_VERBS;

/** Nom du délégué de store (= nom d'intent) d'un verbe de flux : `<prefix><Verbe>`. */
export const flowActionName = (prefix: string, verb: string): string =>
  `${prefix}${verb.charAt(0).toUpperCase()}${verb.slice(1)}`;

/**
 * Surface d'intents invité DÉRIVÉE de la table : tout verbe d'un flux `coop:true`, sauf `resist`
 * (auto-succès de Résistance jamais délégué à l'invité). Un flux coop ajouté à `FLOW_VERBS` obtient
 * ses intents SANS aucune ligne dans `net/intents.ts`.
 */
export function coopFlowIntents(): string[] {
  const out: string[] = [];
  for (const [prefix, w] of Object.entries(FLOW_VERBS) as [string, FlowVerbs][]) {
    if (!w.coop) continue;
    for (const v of w.verbs) if (v !== 'resist') out.push(flowActionName(prefix, v));
  }
  return out;
}

/**
 * Intents (`<prefix><Verbe>`) dont le 1ᵉʳ argument EST l'id du combattant qui tient le jet — DÉRIVÉS
 * des flux `kind:'multi'` à `pidIsActor:true`. `netOwnership.intentAllowedFor` y route la possession
 * sur `seatOwns(args[0])` au lieu du owner de la modale. `cancel` en est exclu : il ferme la situation
 * entière, sans `pid` (cf. `MultiRollActions`).
 */
export function participantOwnedIntents(): string[] {
  const out: string[] = [];
  for (const [prefix, w] of Object.entries(FLOW_VERBS) as [string, FlowVerbs][]) {
    if (w.kind !== 'multi' || !w.pidIsActor) continue;
    for (const v of w.verbs) if (v !== 'cancel') out.push(flowActionName(prefix, v));
  }
  return out;
}

/**
 * Intents (`<prefix><Verbe>`) dont la possession suit le PORTEUR DU JET désigné en donnée — DÉRIVÉS
 * des flux `kind:'mono'` porteurs d'un `jetOwner`. `netOwnership.intentAllowedFor` y route la
 * possession sur `seatOwns(s[pending][field])` au lieu du owner de la modale (qui vaut `'*'` sur une
 * fenêtre PARTAGÉE et accepterait alors la dépense de N'IMPORTE quel siège). `cancel` en est exclu :
 * il ferme la situation entière, il ne dépense rien.
 */
export function jetOwnedIntents(): Record<string, JetOwnerRef> {
  const out: Record<string, JetOwnerRef> = {};
  for (const [prefix, w] of Object.entries(FLOW_VERBS) as [string, FlowVerbs][]) {
    if (w.kind !== 'mono' || !w.jetOwner) continue;
    for (const v of w.verbs) if (v !== 'cancel') out[flowActionName(prefix, v)] = w.jetOwner;
  }
  return out;
}
