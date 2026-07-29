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
export type FlowVerbs =
  | (FlowVerbsBase & { kind: 'mono' })
  /** MULTI : `pidIsActor` déclare à QUI appartient le 1ᵉʳ argument des délégués (`pid`) — `true` = l'id
   *  du COMBATTANT du slot (la possession du jet suit son propriétaire, `netOwnership`), `false` = un id
   *  de slot SANS acteur propre (Round, étape) → la possession retombe sur le owner de la modale.
   *  OBLIGATOIRE : tout flux multi tranche, aucun défaut silencieux. */
  | (FlowVerbsBase & { kind: 'multi'; pidIsActor: boolean });

export const FLOW_VERBS = {
  attack:       { kind: 'mono',  verbs: ['reroll', 'bonusSL', 'darkPact', 'cancel', 'forceSuccess', 'setForcedRoll', 'reverse'], coop: true },
  defense:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'reverse'], coop: true },
  cast:         { kind: 'mono',  verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  disengage:    { kind: 'mono', verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  // « Fuir » : MULTI hétérogène (coup dans le dos du frappeur + Calme du fuyard) — `setForcedRoll`
  // sert le dé CHOISI du coup dans le dos (double 11 → Coup Critique, LDB 13 l.183).
  flee:         { kind: 'multi', pidIsActor: true, verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true },
  auContact:    { kind: 'mono', verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  grapple:      { kind: 'mono', verbs: ['reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  trample:      { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  battement:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'] },
  distraire:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'] },
  maneuver:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  run:          { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true },
  // Chute VOLONTAIRE (clic `FallOverlays`) : `coop` omis — ses verbes ne sont pas exposés à l'invité
  // (cf. `battement`/`distraire`).
  fall:         { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'] },
  reload:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  handGate:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  recover:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  focus:        { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  dispel:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'] },
  frenzy:       { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true },
  approach:     { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact'] },
  ward:         { kind: 'mono', verbs: ['roll', 'reroll', 'forceSuccess', 'setForcedRoll', 'darkPact'], coop: true },
  heal:         { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  surgery:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'], coop: true },
  corruption:   { kind: 'mono',  verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'resist'], coop: true },
  test:         { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll', 'cancel', 'reverse'] },
  steamSave:    { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'] },
  activity:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'] },
  bargain:      { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'] },
  appraise:     { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'darkPact', 'forceSuccess', 'setForcedRoll'] },
  shanty:       { kind: 'mono', verbs: ['roll', 'reroll', 'bonusSL', 'forceSuccess', 'setForcedRoll', 'darkPact'] },
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
