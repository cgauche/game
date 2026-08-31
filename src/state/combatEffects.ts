import type { GameState, RevealEntry } from './store';
import type { Get, Set as SetFn } from './flowTypes';
import { armChapterRecapIfDue } from './chapitreRecap';
import type { LootGear, CascadeTableDone, PendingCascade } from './pendings';
import { revealToStep } from './revealStep';
import { Combatant, CHAR_LABELS, type ModLine } from '../engine/types';
import { RULE_REF } from '../engine/ruleRefs';
import { battleRng } from './battleRng';
import { d10, d100, defaultRNG, roll as rollDice, type RNG } from '../engine/dice';
import { petitePriereAnswered } from '../engine/prayer';
import { applyOps, resolveFormula, type OpsCtx } from '../engine/ops';
import { rule } from '../engine/policy';
import { gainCorruption, corruptionTarget, poseCorruptionPending, testDeCorruption } from './corruptionFlow';
import { eligibleTalent } from '../engine/grimoire';
import { bonus, effectiveChar } from '../engine/characteristics';
import { sceneNpc } from './sceneNpc';
import { buildActorView } from './combat/flowEval';
import { partyBest, partyAssisted, soutienDetail, isSocialTest, socialPsychMod, socialPsychLabel, socialPsychLines, testValue, actorHasSkill } from '../engine/skills';
import { statusCharmMod, statusCharmLabel, actorStatus, capriciousDR } from '../engine/social';
import { parseStatus } from '../engine/creation';
import { easeDifficulty } from '../engine/tests';
import { restoreFortune } from '../engine/fortune';
import { hasTalent } from '../engine/magic';
import { traumaOnImpossibleAmbition } from '../engine/psychology';
import { recomputeLoadout, itemFromGive, giveTrappingLabel, withGiveQualities, autoStowNewItem } from '../engine/items';
import { trappingById, indiceById } from './campaignData';
import { revealClue, discreditClue } from './clues';
import { findCreatureById, findVehicleById, refLabel, WATER_EXPOSURE, diseaseLabel, nightStakeRef, combatStakeRef, flowStakeRef } from '../data';
import { MORALE_BASE } from '../engine/crewMorale';
import { clampSaboteurDR } from './shipCrew';
import { harvestSizeOf, harvestYield } from '../engine/harvest';
import { applySummon } from './summonFlow';
import { contractDisease, applyContraction, DISEASE_DEFS } from '../engine/disease';
import { hasHealSkill, HEAL_SKILL, type HealMode } from '../engine/healing';
import { openMedic } from './medicFlow';
import { seaWeatherTestMod, openPortAt, vesselManann, setVesselHull } from './seaVoyageFlow';
import { applyManannFactor, addManann, findManannFactor } from '../engine/seaVoyage';
import { placeById } from './worldMap';
import { openScriptedPsych } from './encounterPsychFlow';
import { tavernNpcOffers } from './tavernFlow';
import { openRest, placesOfKind } from './restFlow';
import { permanentAmputations } from '../engine/critical';
import { traumaById, dechirureFractureFicheId } from '../engine/trauma';
import { DAY_PHASES, minutesUntilNext, scheduleAt } from '../engine/clock';
import { TIME_COST } from '../engine/timeCost';
import { feedFromMeal, applyFaimTest, applySoifTest } from '../engine/provisions';
import { isWeatherWarded, exposureTarget, exposureCoatMods, type ExposureKind } from '../engine/exposure';
import { findSpellById } from '../data/index';
import { toBrass, fromBrass } from '../engine/money';
import { distributeCredit, drainGroup, condCtx } from './bourseFlow';
import { Effect, setDoorOpen } from './scene';
import { placeCombatant } from './spawn';
import { type Flow, type FlowTest, type EffectOp, flowFromEffects, flowEffects, testFlow, evalCondition, leafOpsCtx, EMPTY_FLOW, spellOps } from './flow';
import { inRect, combatantsWithinRadius } from './combatGeometry';
import { removeEntity } from './combatGeometry';
import { playSfx } from '../audio/engine';
import { combatDistance } from './footprint';
import { registerCascadeApplier, pushStep } from './cascade';
import { exposureWaveBand } from './nightBands';
import { freeCons, rollStep, hostStep, monoStep, openSequence, pousseSi, type BuiltCascadeStep } from './rollSeam';
import { startGroundPursuit } from './pursuitFlow';
import { sourceExposureMod, autoExposureMods, drawWaterDisease, isWounded } from '../engine/waterExposure';
import { loseWounds, addCondition, hasCondition } from '../engine/conditions';
import { touchActors } from './combatOrParty';
import { actorIn } from './combatants';
import { addPossession, type PossessionInput } from './possessionsFlow';
import { possessionLabel, type Possession, type LivingRef } from '../engine/possession';
import { ev } from './combatLog';
import { t } from '../i18n';
import { stepPrecision, stepDetail } from './rollSeam';
import { dataLabel } from '../data';

/**
 * Effets de scène/campagne (`Effect[]`) appliqués par le store : le grand `applyEffects`
 * (setFlag/journal/dons/transitions/tests/soins…) + la brique de butin ATTRIBUABLE
 * (`gearFromEffects`/`applyEffectsLoot`/`assignGearAt`), les déclencheurs de zone
 * (`checkTriggers`) et l'empilement des révélations en étapes d'affichage (`pushReveal`). Extrait de combatFlow
 * (baril : ré-exporté par `./combatFlow`). Module FEUILLE — n'importe RIEN de combatFlow.
 */
/**
 * SÉQUENCE D'ACCUEIL d'une révélation (#942 L8) — évaluée sur l'état qui reçoit l'étape :
 *  - `own` : la révélation ouvre SA séquence, quoi qu'il y ait en vol. La séquence en vol d'un AUTRE
 *    `purpose` est alors PARQUÉE par la doctrine du slot (`pushStep`/`startCascade`, state/cascade.ts)
 *    et reprend à la clôture — c'est ce que réclame la carte d'ENTRÉE DE ZONE, qui doit passer AVANT
 *    les Tests de Psychologie de rencontre déclenchés au même instant ;
 *  - une séquence EN VOL : la SIENNE — la révélation REJOINT l'hôte au lieu de le suspendre. C'est le
 *    cas dominant (en combat la séquence en vol EST celle de l'arène) et le seul correct quand la
 *    révélation est émise DEPUIS un applier de cette séquence : les trois tirages chaînés d'une
 *    mutation (`corruptionFlow`) sont suivis de « Mutation — X », qui doit s'appender et non parquer
 *    la séquence en cours de commit ; de même, un abordage qui s'ouvre PENDANT une séquence de voyage
 *    ne doit pas la faire parquer une seconde fois par sa propre révélation ;
 *  - slot libre EN COMBAT : `'combat'`, la séquence de l'arène (inchangé) ;
 *  - sinon : le `site` déclaré par l'appelant (l'entretien quotidien a le sien), à défaut `'affichage'`.
 */
const revealPurpose = (site: PendingCascade['purpose'], own: boolean) => (s: GameState): PendingCascade['purpose'] =>
  own ? site : (s.pendingCascade?.purpose ?? (s.battle ? 'combat' : site));

/** Empile une révélation en étape d'AFFICHAGE de cascade (`pushStep` : append à la séquence d'accueil,
 *  sinon elle l'ouvre). `purpose` = la séquence du SITE d'émission quand il en a une naturelle ;
 *  `own` = la révélation ne rejoint AUCUNE séquence en vol, elle ouvre la sienne (celle en vol est
 *  parquée puis reprise). ÉMETTEUR UNIQUE de toute révélation.
 *
 *  `autoClose` : DÉCLARE que cette révélation-là se referme seule, à la cadence de la gravité donnée
 *  (arbitrage #1270 — la fermeture explicite est le défaut ; un timer se justifie site par site). */
export function pushReveal(
  set: SetFn,
  entry: RevealEntry,
  opts?: { table?: CascadeTableDone; purpose?: PendingCascade['purpose']; own?: boolean; autoClose?: NonNullable<RevealEntry['severity']> },
): void {
  pushStep(set, (index) => revealToStep(entry, index, { table: opts?.table, ...(opts?.autoClose ? { autoClose: opts.autoClose } : {}) }), revealPurpose(opts?.purpose ?? 'affichage', !!opts?.own));
}

/** Vide la file de lignes de journal différées (`pendingLogQueue`) → événements de combat. SOURCE
 *  UNIQUE : appelée JUSTE AVANT chaque couture qui réécrit `battle.log` (le `set` y replace `log` →
 *  les lignes poussées par un hook profond — `onGainCondition` ennemi/auto — seraient sinon clobberées).
 *  Clôt la file (set) et RENVOIE les événements pour que l'appelant les FOLDE dans le MÊME `log` réécrit
 *  (bon ordre, zéro double `set` sur `battle`). File vide → no-op (tableau vide, pas de `set`). */
export function drainPendingLog(get: Get, set: SetFn): import('./combatLog').CombatEvent[] {
  const q = get().pendingLogQueue;
  if (!q.length) return [];
  set({ pendingLogQueue: [] });
  return q.map((e) => ev('condition', e.line, e.cid));
}

/** Pousse une ÉTAPE de séquence de combat déjà MINTÉE (`BuiltCascadeStep` — un constructeur de la
 *  porte `rollSeam`, ou `revealToStep`) : le cas `purpose:'combat'` de la primitive générique
 *  `pushStep` (state/cascade.ts). La variante FABRIQUE (`index` = position d'append) est celle de
 *  `pushStep` : un `kind` poussé PLUSIEURS fois dans la même séquence (relance d'Imparfaite, #942 L6)
 *  y prend un id unique. La fabrique peut rendre `undefined` — comme celle de `pushStep` : un
 *  constructeur de la porte qui REFUSE sa déclaration n'a aucune étape à donner, et l'index d'append
 *  n'est connu que dans le `set` atomique.
 *
 *  MURAGE (#1262 B4) : la marque est REQUISE ici — un littéral d'étape monté à la main ne compile
 *  plus. Les étapes de combat se déclarent aux portes (`pushBand`/`pushChoice`/`pushMono`/`pushTable`/
 *  `pushTableDone`/`pushDisplay`/`pushHost`), qui montent, surfacent et possèdent ; ce point d'entrée
 *  sert aux SEULES étapes déjà mintées par une fabrique tierce (bandes de `combat/triggeredTest`,
 *  révélations). */
export function pushCombatStep(set: SetFn, step: BuiltCascadeStep | ((index: number) => BuiltCascadeStep | undefined)): void {
  pushStep(set, step, 'combat');
}

// occupied / pushBackTiles / findFreeTile / displaceSmaller / removeEntity → combatGeometry.ts

/** Items ramassables d'un prop interactif : un par feuille `do` « donneuse » de son `interact.flow`.
 *  `key` = `eff:<index dans flowEffects(interact.flow)>`. Effets non-objet & branches (test) ignorés. */
export function entityPickables(ent: { interact?: { flow: Flow } }): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  (ent.interact ? flowEffects(ent.interact.flow) : []).forEach((e, i) => {
    if (e.type === 'giveTrapping') out.push({ key: `eff:${i}`, label: giveTrappingLabel(e, trappingById) });
    else if (e.type === 'giveMoney') out.push({ key: `eff:${i}`, label: 'Argent' });
  });
  return out;
}

export function checkTriggers(get: Get, set: SetFn) {
  const { scene, partyPos, flags } = get();
  if (!scene) return;
  for (const trig of scene.triggers) {
    if (flags[`__trigger_${trig.id}`]) continue;
    if (!inRect(partyPos, trig.rect)) continue;
    if ((trig.rect.z ?? 0) !== (partyPos.z ?? 0)) continue;
    if (trig.when && !evalCondition(trig.when, condCtx(get))) continue;
    if (trig.once) flags[`__trigger_${trig.id}`] = true;
    set({ flags: { ...flags } });
    runFlow(get, set, trig.flow, t('eff.flowTitleDiscovery'));
  }
}

// inRect → combatGeometry.ts

/** Sépare d'un lot d'Effets les giveTrapping ATTRIBUABLES (sans heroId) → lignes de butin
 *  « qui l'emporte ? ». Brique partagée écran de victoire / fenêtre de loot. Un giveTrapping
 *  AVEC heroId est un don d'auteur ciblé : il reste dans `rest` et s'applique directement. */
export function gearFromEffects(effects: Effect[]): { gear: LootGear[]; rest: Effect[] } {
  const gear: LootGear[] = [];
  const rest: Effect[] = [];
  for (const e of effects) {
    if (e.type === 'giveTrapping' && !e.heroId) gear.push({ label: giveTrappingLabel(e, trappingById), magic: !!e.qualities?.length || e.identified === false, effect: e });
    else rest.push(e);
  }
  return { gear, rest };
}

/** applyEffects + fenêtre de loot : hors combat, l'équipement trouvé (giveTrapping sans heroId)
 *  devient ATTRIBUABLE dans `pendingLoot` au lieu d'aller en silence au 1er héros ; l'argent
 *  s'applique à la bourse ET s'affiche ; les textes `journal` du lot deviennent le texte
 *  d'ambiance de la fenêtre. Sans butin (ou en combat : Ramasser/victoire ont leurs flux),
 *  strictement équivalent à applyEffects. Fenêtre déjà ouverte → le butin s'y AJOUTE. */
export function applyEffectsLoot(get: Get, set: SetFn, effects: Effect[], title: string, sl?: number) {
  if (get().battle) { applyEffects(get, set, effects, sl); return; }
  const { gear, rest } = gearFromEffects(effects);
  applyEffects(get, set, rest, sl);
  const found = effects
    .filter((e): e is Extract<Effect, { type: 'giveMoney' }> => e.type === 'giveMoney')
    .reduce((m, e) => m + toBrass({ gold: e.gold ?? 0, silver: e.silver ?? 0, brass: e.brass ?? 0 }), 0);
  if (!gear.length && found <= 0) return; // dépense (giveMoney négatif) ou simple récit : pas de fenêtre
  const messages = effects.filter((e): e is Extract<Effect, { type: 'journal' }> => e.type === 'journal').map((e) => e.desc);
  set((s: GameState) => {
    const prev = s.pendingLoot;
    if (!prev) return { pendingLoot: { title, messages: messages.length ? messages : undefined, gold: found > 0 ? fromBrass(found) : undefined, gear } };
    return {
      pendingLoot: {
        ...prev,
        gear: [...prev.gear, ...gear],
        gold: found > 0 ? fromBrass(toBrass(prev.gold ?? { gold: 0, silver: 0, brass: 0 }) + found) : prev.gold,
        messages: [...(prev.messages ?? []), ...messages.filter((m) => !(prev.messages ?? []).includes(m))],
      },
    };
  });
}

/** Attribue la ligne `index` du butin (`pendingLoot` ou `pendingVictory`) au héros choisi :
 *  l'Effet d'origine s'applique avec ce heroId (qualités/skin/identification conservés), la
 *  ligne quitte la fenêtre. Source unique de l'attribution (victoire ET fenêtre de loot). */
export function assignGearAt(get: Get, set: SetFn, key: 'pendingLoot' | 'pendingVictory', index: number, heroId: string) {
  const bucket = get()[key];
  if (!bucket?.gear || index < 0 || index >= bucket.gear.length) return;
  applyEffects(get, set, [{ ...bucket.gear[index].effect, heroId }]);
  set({ [key]: { ...bucket, gear: bucket.gear.filter((_, i) => i !== index) } });
}

/** Récolte « Précieuses Entrailles » (ZI) d'une créature vaincue (écran de victoire) : un nœud Flow
 *  `test` de Savoir (Bêtes) → `giveTrapping` — la réussite donne les pièces fraîches à pleine quantité,
 *  l'échec une quantité réduite (un cran de Taille en moins). Les pièces portent leur valeur de marché
 *  (`giveTrapping.price`), revendable au marchand / composant ZI. */
export function harvestVictoryCreature(get: Get, set: SetFn, creatureId: string) {
  const c = findCreatureById(creatureId);
  const p = c?.harvest;
  if (!c || !p) return;
  const name = c.label; // affichage depuis le record (résolu par id)
  const pv = get().pendingVictory;
  if (pv?.harvested?.includes(creatureId)) return; // déjà récolté
  const size = harvestSizeOf(c);
  const full = harvestYield(p, size, 0, 'Frais');
  const lo = harvestYield(p, size, -1, 'Frais');
  const part = (enc: number) => t('eff.harvestPart', { creature: name, enc }); // objet CUSTOM (hors catalogue)
  const titre = stepDetail(t('eff.harvest'), dataLabel(name));
  if (pv) set({ pendingVictory: { ...pv, harvested: [...(pv.harvested ?? []), creatureId] } }); // grise le bouton
  runFlow(get, set, testFlow(
    { skill: { id: 'savoir', spec: 'betes-sauvages' }, difficulty: 'intermediaire', label: titre, stake: combatStakeRef('harvestCreature', { values: { encPlein: full.enc, encEchec: lo.enc } }) },
    flowFromEffects([{ type: 'giveTrapping', custom: part(full.enc), price: full.total }]),
    flowFromEffects([{ type: 'giveTrapping', custom: part(lo.enc), price: lo.total }]),
  ), titre);
}

/** Lot 0 — déclenche les effets PROGRAMMÉS (file `scheduledEffects`) dont l'échéance est atteinte.
 *  Appelé par `advanceTime` à chaque avance d'horloge (le temps progresse par actions discrètes →
 *  un événement programmé entre deux pas se déclenche dès le pas qui le dépasse). Un effet dont le
 *  `cancelFlag` a été posé est CONSOMMÉ sans s'appliquer (désamorçage). Les entrées dues sont
 *  retirées AVANT application (pas de re-déclenchement). */
export function fireScheduledEffects(get: Get, set: SetFn) {
  const now = get().gameTime;
  const all = get().scheduledEffects;
  const due = all.filter((s) => s.executeAt <= now);
  if (!due.length) return;
  set({ scheduledEffects: all.filter((s) => s.executeAt > now) });
  const flags = get().flags;
  for (const s of due) {
    if (s.cancelFlag && flags[s.cancelFlag]) continue;
    // Reconstitution DIFFÉRÉE (Gardien éternel) : ré-invoque la créature programmée à la mort, près de sa
    // position de chute et dans son camp (`applySummon`, MÊME résolveur que les invocations de sort). Le
    // `caster` est un instantané minimal du défunt — applySummon n'en lit que id/name/kind/pos.
    if (s.respawn) { for (const line of applySummon(get, set, s.respawn.caster as unknown as Combatant, s.respawn.summon, { rng: battleRng() })) get().log(line); continue; }
    if (s.flow) runFlow(get, set, s.flow, t('eff.flowTitleEvent'));
  }
}

/** Programme les ops d'une op IMPURE `delayed` (ext. #50-D) dans la file `scheduledEffects` — même
 *  mécanique que l'Effet de scène `delayedEffect` (Lot 0). Échéance : `afterMinutes/Hours/Days` résolus
 *  MAINTENANT contre la cible, OU `afterDuration:true` = l'échéance du contexte (fin de la durée du
 *  consommable — Bonnet de fou « Quand l'effet se dissipe… », LDB 71 l.20). `forMinutes/Hours/Days` :
 *  durée d'horloge PROPRE des ops différées (bakée sur la feuille programmée — Délice de Ranald :
 *  pénalité après les 3 h, LDB 71 l.24). Le Flow programmé cible le porteur par id (`on:'hero'`). */
export function scheduleDelayedOps(
  get: Get, set: SetFn, target: Combatant,
  op: Extract<import('../engine/ops').GameOp, { op: 'delayed' }>,
  base: { now: number; untilTime?: number; label?: string },
): void {
  const rng = battleRng();
  const delayMin = op.afterDuration
    ? Math.max(0, (base.untilTime ?? base.now) - base.now)
    : resolveFormula(op.afterMinutes ?? 0, target, rng)
      + resolveFormula(op.afterHours ?? 0, target, rng) * 60
      + resolveFormula(op.afterDays ?? 0, target, rng) * 24 * 60;
  const executeAt = base.now + Math.max(0, delayMin);
  const forMin = resolveFormula(op.forMinutes ?? 0, target, rng)
    + resolveFormula(op.forHours ?? 0, target, rng) * 60
    + resolveFormula(op.forDays ?? 0, target, rng) * 24 * 60;
  const flow: Flow = {
    kind: 'do',
    effect: {
      type: 'ops', on: 'hero', heroId: target.id, ops: op.ops,
      ...(base.label ? { label: base.label } : {}),
      ...(forMin > 0 ? { untilTime: executeAt + forMin } : {}),
    },
  };
  set({ scheduledEffects: [...get().scheduledEffects, { executeAt, flow }] });
}

/** Applique les ops d'UNE feuille EffectOp à `c` — SOURCE UNIQUE des exécuteurs d'EffectOp (handler de
 *  scène `ops`, `runCombatFlow`, runner de consommable) : les `delayed` sont PROGRAMMÉES
 *  (`scheduleDelayedOps`), le reste passe par `applyOps` avec le contexte de la FEUILLE (`leafOpsCtx` —
 *  untilTime/label bakés priment, sinon le contexte appelant). Renvoie le journal. */
export function applyLeafOps(get: Get, set: SetFn, c: Combatant, e: EffectOp, base: OpsCtx): string[] {
  const now = base.now ?? get().gameTime;
  const ctx = leafOpsCtx({ ...base, now }, e);
  for (const o of e.ops) if (o.op === 'delayed') scheduleDelayedOps(get, set, c, o, { now, untilTime: ctx.defaultUntilTime, label: ctx.label });
  const rest = e.ops.filter((o) => o.op !== 'delayed');
  return rest.length ? applyOps(c, rest, ctx) : [];
}

/** Cibles d'un EffectOp de scène (`ops` on=party/hero) : les héros vivants concernés,
 *  dans le bon ensemble (file de combat si en combat, sinon le groupe). `hero` = celui désigné par
 *  `heroId` (défaut : 1er vivant) ; `party` = tous les héros vivants. SOURCE UNIQUE (pas de dup). */
function effectTargets(get: Get, target: 'party' | 'hero', heroId?: string): Combatant[] {
  const pool = get().battle?.combatants ?? get().party;
  if (target === 'hero') {
    const id = heroId || pool.find((c) => c.kind === 'hero' && !c.dead)?.id;
    return pool.filter((c) => c.id === id);
  }
  return pool.filter((c) => c.kind === 'hero' && !c.dead);
}

/** Ouvre la modale d'un Test de compétence — SOURCE UNIQUE (le nœud Flow `test` ET `Effect.test` y
 *  passent). `onSuccess`/`onFailure` = branches (Flows) ; `after` = continuation reprise APRÈS la
 *  branche (suite d'un `seq`). Choix du meilleur PJ effectif (malus social compris), candidats,
 *  `easierIf`, outil. Retourne false si aucun héros vivant ne peut tenter (le flux continue sans Test). */
export function openSkillTest(
  get: Get, set: SetFn, spec: FlowTest, onSuccess: Flow, onFailure: Flow, after: Flow,
  opts?: {
    actorId?: string;
    noOwnTestFailed?: boolean;
    /** Action de combat « Cumuler l'Avantage » (LDB 09 l.305-308) : l'octroi porté par le pending et
     *  appliqué par `resolveTest` — la couture reste la même, seule la conséquence est déclarée ici. */
    combatAdvantage?: { combatantId: string; cap: number };
    /** Test initié en COMBAT : annulable pré-jet (l'Action n'est pas encore dépensée). */
    cancellable?: boolean;
  },
): boolean {
  // Modulateurs sociaux PAR ACTEUR (un Test social vs un interlocuteur) : malus psy Animosité/Préjugé
  // (LDB 21) + mod de Statut Échelon/Standing (LDB 08). Le Statut compare l'acteur à la cible `vsStatus`.
  const isSocial = isSocialTest(spec.skill?.id, spec.characteristic);
  const tgtStatus = isSocial && spec.vsStatus ? parseStatus(spec.vsStatus) : undefined;
  const psychMod = spec.vsGroups?.length && isSocial ? (c: Combatant) => socialPsychMod(c, spec.vsGroups!) : undefined;
  // 1d10 « réaction au Statut » (option, LDB 08 l.40/59) tiré UNE fois par Test (RNG seedé) — appliqué à
  // tous les candidats de façon cohérente (la réaction de l'interlocuteur ne dépend pas du héros choisi).
  const reactionRoll = tgtStatus && rule('social-status-reaction-roll') ? battleRng().int(1, 10) : undefined;
  const statusMod = tgtStatus ? (c: Combatant) => statusCharmMod(actorStatus(c), tgtStatus, { begging: spec.begging, reactionRoll }) : undefined;
  // Capricieux (MSRC 15 l.149-159) : la créature-interlocuteur tire un d10 (UNE fois, seedé,
  // INDÉPENDANT du héros choisi — c'est SA réaction) ; la table rend un delta de DR appliqué au Test
  // RÉSOLU (`FLOWS.test.resolve`), donc hors de `skillValue`/`target`. Constant pour tous les candidats.
  const capriciousRoll = isSocial && spec.vsCapricieux ? battleRng().int(1, 10) : undefined;
  const capDR = capriciousRoll != null ? capriciousDR(capriciousRoll) : 0;
  const socialMod = psychMod || statusMod
    ? (c: Combatant) => (psychMod ? psychMod(c) : 0) + (statusMod ? statusMod(c) : 0)
    : undefined;
  const socialDetail = (c: Combatant): string | undefined => {
    const parts: string[] = [];
    const pl = psychMod ? socialPsychLabel(c, spec.vsGroups!) : undefined;
    if (pl) parts.push(`${pl} envers ${spec.vsGroups!.join('/')}`);
    const sl = tgtStatus ? statusCharmLabel(actorStatus(c), tgtStatus, { begging: spec.begging }) : undefined;
    if (sl) parts.push(sl);
    return parts.length ? parts.join(' · ') : undefined;
  };
  // Le mod social FONDU dans la valeur, DÉPLIÉ par source pour le monteur (`dansLaValeur`) : une ligne
  // par Trait psy « contenu » (LDB 21), chacune liée à SA fiche par le producteur (`socialPsychLines`),
  // puis la ligne de Statut (LDB 08). Σ de ces lignes === `socialMod(c)` — la garde d'exactitude du
  // monteur le vérifie à chaque passage.
  // Sous la règle optionnelle `social-status-reaction-roll`, la VALEUR de la ligne de Statut porte le
  // d10 de réaction (annulé 1-2, inversé 9-10) alors que son LIBELLÉ décrit la base RAW : les deux
  // divergent alors — le libellé est celui que la modale affiche déjà en sous-titre (`psychDetail`).
  const socialLines = (c: Combatant): ModLine[] => {
    const lines: ModLine[] = psychMod ? socialPsychLines(c, spec.vsGroups!) : [];
    const st = statusMod ? statusMod(c) : 0;
    if (st) {
      lines.push({
        label: statusCharmLabel(actorStatus(c), tgtStatus!, { begging: spec.begging }) ?? 'Statut',
        value: st,
        famille: 'jet',
        ref: RULE_REF.statut,
      });
    }
    return lines;
  };
  // `opts.actorId` RESTREINT le Test à UN acteur précis (ex. le Personnage qui prend l'Action « Diriger
  //  l'équipe » — le porteur du Talent, pas le meilleur du groupe) ; sinon le meilleur PJ (partyBest).
  const restrictId = opts?.actorId;
  const best = restrictId
    ? (() => { const a = get().party.find((c) => c.id === restrictId && !c.dead); return a ? { actor: a } : null; })()
    : partyBest(get().party, spec.skill?.id, spec.characteristic, socialMod, spec.skill?.spec);
  if (!best) return false;
  const baseDifficulty = spec.difficulty ?? 'intermediaire';
  const eased = !!spec.easierIf && get().party.some((c) => !c.dead && (
    (!!spec.easierIf!.hasSkill && actorHasSkill(c, spec.easierIf!.hasSkill.id, spec.easierIf!.hasSkill.spec)) ||
    (!!spec.easierIf!.hasTalent && hasTalent(c, spec.easierIf!.hasTalent))
  ));
  const difficulty = eased ? easeDifficulty(baseDifficulty, spec.easierIf!.steps ?? 1) : baseDifficulty;
  // L'allègement se NOMME : la difficulté affichée porte ce qui l'a permise (compétence ou talent
  // présent dans le groupe), au lieu d'une difficulté plus douce sans origine lisible.
  const easedBy = eased
    ? (spec.easierIf!.hasSkill
      ? refLabel('skills', { id: spec.easierIf!.hasSkill.id, spec: spec.easierIf!.hasSkill.spec })
      : refLabel('talents', { id: spec.easierIf!.hasTalent! }))
    : undefined;
  // Météo maritime ACTIVE (Précipitations, MDG 13 l.187-201) — POINT UNIQUE d'injection des mods
  // d'environnement dans un Test : même malus pour tout le monde (indépendant du candidat), au même
  // titre que le mod social ou le Soutien. `undefined` hors voyage en mer / Test de Caractéristique.
  const env = seaWeatherTestMod(get().travelPlan?.sea, spec.skill?.id, spec.skill?.spec);
  // Canal `surLaCible` du monteur : le malus pèse sur la CIBLE, pas sur la valeur (le pending le porte
  // toujours à part, `envMod`/`envLabel`). Même mod pour tous les candidats — monté une fois. La ligne
  // porte sa fiche : la table de météo maritime (MDG 13) d'où sort la Précipitation.
  const envLines: ModLine[] = env
    ? [{ label: env.label, value: env.mod, famille: 'jet', ref: RULE_REF['meteo-maritime'] }]
    : [];
  // Pool des héros AVEC leur position à jour si un combat est en cours (`battle.combatants` — `party` seule
  // ne porte pas `pos`, LDB 12 l.196 « adjacent »). Même patron que `effectTargets` ci-dessus.
  const battle = get().battle;
  const pool = battle?.combatants ?? get().party;
  // Deux populations DISTINCTES (elles l'étaient sous un seul filtre, ce qui annulait le Soutien dès
  // qu'un acteur était imposé) : `living` = qui peut SOUTENIR (LDB 12 l.187-200 — le meneur imposé ou
  // non, les autres membres capables l'assistent) ; `runners` = qui peut LANCER (restreint par
  // `opts.actorId`). Un Test qu'on ne peut pas soutenir se déclare `noSupport` (l.197), il ne se
  // dérive pas de la restriction du lanceur.
  const living = pool.filter((c) => c.kind === 'hero' && !c.dead);
  const runners = restrictId ? living.filter((c) => c.id === restrictId) : living;
  const candidates = runners.map((actor) => {
    // Soutien (LDB 12 l.187-200) : si CET acteur mène, les AUTRES membres capables l'assistent (+10, plafond
    // Bonus de Carac). Calculé par candidat car le sélecteur laisse le joueur choisir qui lance. `noSupport`
    // (l.197 : maladie/poison/peur/danger) coupe le Soutien à la source ; adjacence (l.196), gate GÉOMÉTRIQUE
    // via `combatDistance`, active quand `actor.pos` est posé (combat en cours).
    const soutD = spec.noSupport ? null : soutienDetail(living, actor, spec.skill?.id, spec.characteristic, spec.skill?.spec,
      battle && actor.pos ? (c) => !!c.pos && combatDistance(actor, c) <= 1 : undefined);
    const sout = soutD?.bonus ?? 0;
    // `spec.sense` (vue/ouïe, LDB 18) restreint le malus de Surdité au seul Test de Perception auditif — le
    // Soutien (`sout`, plafonné au Bonus de Carac du meneur) et le mod social ne dépendent pas du sens.
    const social = socialMod ? socialMod(actor) : 0;
    const value = testValue(actor, spec.skill?.id, spec.characteristic, spec.skill?.spec, spec.sense) + social + sout;
    // Objet catalogué → match par `trappingId` STABLE (id, jamais le libellé).
    const tool = spec.tool ? actor.items?.find((i) => i.trappingId === spec.tool && !i.destroyed) : undefined;
    // Ligne montée par le MONTEUR CANONIQUE (`rollSeam.rollStep`) : la valeur FONDUE se déclare avec ses
    // poches — Soutien (LDB 12), mod social FONDU (`dansLaValeur`, LDB 21 / LDB 08) — et la météo pèse
    // sur la cible. Sa garde d'exactitude juge que cette valeur se reconstruit depuis le Niveau de
    // Compétence nu ; la cible et l'écrêtage en dérivent par la MÊME primitive que `rollTest`.
    const line = rollStep({
      actor,
      test: { skill: spec.skill?.id, char: spec.characteristic, spec: spec.skill?.spec, sense: spec.sense },
      difficulty,
      valeur: value,
      ...(soutD ? { soutien: soutD } : {}),
      ...(social ? { dansLaValeur: socialLines(actor) } : {}),
      ...(envLines.length ? { surLaCible: envLines } : {}),
    });
    return {
      id: actor.id, label: actor.label, value,
      // La LIGNE MONTÉE voyage avec le candidat : base NUE + lignes nommées telles que le monteur les
      // a émises (famille et fiche comprises). L'affichage n'a plus rien à recomposer.
      base: line.base, ...(line.mods ? { mods: line.mods } : {}),
      target: line.target, ...(line.clamped != null ? { clamped: line.clamped } : {}),
      psychMod: social || undefined,
      psychDetail: socialDetail(actor),
      itemUid: tool?.uid,
      // Détail du Soutien de CE candidat (il change avec le meneur : le plafond est celui de SA
      // Caractéristique) — porté pour l'affichage, la valeur reste soutenue.
      support: soutD && soutD.bonus > 0 ? soutD : undefined,
    };
  });
  const def = candidates.find((c) => c.id === best.actor.id) ?? candidates[0];
  if (!def) return false;
  // Compétence/Caractéristique RÉELLE (cadre de jet) ≠ intitulé de situation (titre). Char → libellé long.
  const skill = spec.skill ? refLabel('skills', spec.skill) : (spec.characteristic ? CHAR_LABELS[spec.characteristic] : undefined);
  const label = spec.label || skill || 'Test';
  set({
    pendingTest: {
      actorId: def.id, actorName: def.label, label, skill, skillValue: def.value, difficulty,
      skillId: spec.skill?.id, spec: spec.skill?.spec, char: spec.characteristic, // réf structurée pour talentTestSLBonus (LDB 10)
      requireSL: spec.requireSL ?? 0, target: def.target, clamped: def.clamped, base: def.base, mods: def.mods, psychMod: def.psychMod, psychDetail: def.psychDetail,
      itemUid: def.itemUid, isDouble: false, roll: null, success: false, sl: 0,
      support: def.support, easedBy,
      envMod: env?.mod, envLabel: env?.label,
      capriciousRoll, capriciousDR: capDR || undefined,
      onSuccess, onFailure, after,
      candidates: candidates.length > 1 ? candidates : undefined,
      ...(opts?.noOwnTestFailed ? { noOwnTestFailed: true } : {}),
      ...(opts?.combatAdvantage ? { combatAdvantage: opts.combatAdvantage } : {}),
      ...(opts?.cancellable ? { cancellable: true } : {}),
    },
  });
  // « Une situation = une modale » : le Test EST une cascade à une étape `jet:'test'`, rendue par
  // `CascadeModal` (via `useTestJetProps`). `pendingTest` coexiste comme porteur de données (comme
  // `pendingAttack` pour l'attaque) ; `resolveTest` ferme les deux. Pas d'applier : la conséquence
  // (branche onSuccess/onFailure + continuation) est lancée par `resolveTest`.
  // ENJEU (#1117) : `FlowTest.stake` DESCEND sur l'étape qui lance — c'est elle que `CascadeModal` lit.
  // Second transporteur du champ, à parité avec les deux fabriques de `combat/triggeredTest.ts` : sans
  // lui, tout Flow joué par `runFlow` (Escalade, Saut, Récolte…) porterait un enjeu que rien n'affiche.
  const jet = hostStep(get, { id: 'test-jet', kind: 'sceneTestJet', jet: 'test', actorId: def.id, ...(spec.stake ? { stake: spec.stake } : {}) });
  if (!jet) return false; // le mint ne refuse QUE si `pendingTest` manque — rien à défaire, il vient d'être posé
  openSequence(get, set, { title: label, icon: 'nav/dice', purpose: 'test', steps: [jet] });
  return true;
}

/**
 * Exécute un Flow (logique authorée : séquence/branches/Test) — SOURCE UNIQUE. `do` accumule les
 * Effets et les applique en lot (butin attribuable via `applyEffectsLoot`) ; `if` vide d'abord le lot
 * (la condition lit l'état VIVANT — flags/horloge — donc après les Effets émis) puis branche ; `test`
 * vide le lot, ouvre la modale et SUSPEND — la branche choisie + la continuation (reste de la pile)
 * sont reprises par `resolveTest`. Pas de boucle → terminaison garantie.
 */
export function runFlow(get: Get, set: SetFn, flow: Flow, label: string = t('eff.flowTitle'), sl?: number): void {
  const stack: Flow[] = [flow];
  const batch: Effect[] = [];
  const flush = () => { if (batch.length) applyEffectsLoot(get, set, batch.splice(0), label, sl); };
  while (stack.length) {
    const node = stack.shift()!;
    switch (node.kind) {
      case 'do':
        batch.push(node.effect);
        break;
      case 'seq': stack.unshift(...node.steps); break;
      case 'if': {
        flush();
        const branch = evalCondition(node.cond, condCtx(get)) ? node.then : node.else;
        if (branch) stack.unshift(branch);
        break;
      }
      case 'test': {
        flush();
        const after: Flow = { kind: 'seq', steps: stack.splice(0) };
        // Personne ne peut tenter → on saute le Test et on reprend directement la continuation.
        if (!openSkillTest(get, set, node.test, node.success, node.fail, after)) runFlow(get, set, after, label, sl);
        return;
      }
    }
  }
  flush();
}

/**
 * Walker PUR d'un Flow d'EFFET DÉCLENCHÉ (traits/talents/atouts/États/psychologie/manœuvres/Attributs de
 * Domaine — JAMAIS les sorts, qui passent par `runCastFlow`→`runCombatFlow`) : exécute `seq`/`do`/`if`
 * contre une CIBLE (et le lanceur/porteur pour les feuilles `on:'caster'`), accumulant son journal dans
 * un `string[]` RENDU, sans `get`/`set`. Couvre la Condition `compare` lue sur `target`/`caster` +
 * `sl`/`location`/`woundsDealt`/`attackKind` du contexte d'incantation.
 *
 * GARDE-FOU anti-jet-silencieux (calque `flattenFlow:280`) : un nœud `test` LÈVE — un Test EN COMBAT est
 * interactif/cadence-aware (étape de cascade ou jet inline avec branche honorée), résolu par
 * `resolveFlowTest`/`runCombatFlow`, JAMAIS en avalant la branche succès. Les sites de ce module sont
 * PROUVÉS sans nœud `test` au 1ᵉʳ niveau (un trigger `test` top-level est routé en amont par `testRouter`,
 * une branche de Test n'en contient pas) ; si un `test` enfoui apparaît un jour (Lot 4), l'erreur le rend
 * détectable au lieu de redevenir un jet silencieux. */
export function runPureFlowLines(target: Combatant, caster: Combatant | undefined, flow: Flow, ctx: OpsCtx): string[] {
  const lines: string[] = [];
  const walk = (f: Flow): void => {
    switch (f.kind) {
      case 'seq': f.steps.forEach(walk); break;
      case 'do':
        if (f.effect.type === 'ops') {
          const unit = f.effect.on === 'caster' ? caster : target;
          // Contexte de FEUILLE (`leafOpsCtx`) : untilTime/label bakés (consommable) priment sur le ctx
          // appelant. Les ops IMPURES (`delayed`…) sont routées en amont vers runCombatFlow (flowHasImpureOp).
          if (unit) lines.push(...applyOps(unit, f.effect.ops, leafOpsCtx(ctx, f.effect)));
        }
        break;
      case 'if':
        // Condition `compare` : `target` = la cible du sous-Flow, `caster` = le lanceur/porteur.
        // `location`/`woundsDealt` : contexte de la touche courante (Assommante Tête, Venin sur PB).
        if (evalCondition(f.cond, { flags: {}, gameTime: ctx.now ?? 0, party: [target], sl: ctx.sl,
          location: ctx.location, woundsDealt: ctx.woundsDealt, engagedAdvantageGap: ctx.engagedAdvantageGap, engagedAdvantageLead: ctx.engagedAdvantageLead, foeInLoS: ctx.foeInLoS,
          hiddenFromFoes: ctx.hiddenFromFoes, engaged: ctx.engaged, nearestFoeDist: ctx.nearestFoeDist,
          attackKind: ctx.attackKind, startleCause: ctx.startleCause, target: buildActorView(target), caster: buildActorView(caster) })) walk(f.then);
        else if (f.else) walk(f.else);
        break;
      case 'test':
        throw new Error('runPureFlowLines: un nœud `test` est cadence-aware — utiliser runCombatFlow/resolveFlowTest.');
    }
  };
  walk(flow);
  return lines;
}

/**
 * Environnement d'exécution d'un Effet : l'état (get/set) + les helpers FACTORISÉS du switch d'origine.
 * `mutateHero` capture le motif RÉPÉTÉ « héros désigné par heroId, sinon une cible par défaut → clone →
 * muter le party » (7 cas) ; `targets` = `effectTargets` (cibles party/hero, file de combat ou groupe) ;
 * `log`/`pushReveal` = raccourcis. Aucune logique de domaine ici (chaque conséquence vit dans son handler).
 */
export interface EffectEnv {
  get: Get;
  set: SetFn;
  log(line: string): void;
  pushReveal(entry: RevealEntry): void;
  /** DR (SL) du Test résolu qui a produit ce lot d'Effets (`resolveTest`/`pt.sl`, symétrique de
   *  `opsCtx.sl` en combat, `triggeredTest.ts:159`) — absent hors Test (déclencheur de scène, etc.). */
  sl?: number;
  /** Cibles d'un effet `party`/`hero` (héros vivants concernés, bon ensemble) — `effectTargets`. */
  targets(on: 'party' | 'hero', heroId?: string): Combatant[];
  /**
   * Applique `mutate` au héros choisi (heroId, sinon `pick`/le premier vivant) et renvoie l'ORIGINAL
   * muté (pour le journal). `mutate(hero)` renvoie le NOUVEAU héros (immuable) ; renvoyer `hero`
   * inchangé = pas de mutation (le héros reste, ex. maladie déjà présente). `pick(party)` choisit
   * l'index défaut quand `heroId` est absent (−1 = abandon) ; absent → le premier (index 0).
   */
  mutateHero(
    heroId: string | undefined,
    mutate: (hero: Combatant) => Combatant,
    pick?: (party: Combatant[]) => number,
  ): Combatant | null;
}

function makeEffectEnv(get: Get, set: SetFn, sl?: number): EffectEnv {
  return {
    get,
    set,
    sl,
    log: (line) => get().log(line),
    pushReveal: (entry) => pushReveal(set, entry),
    targets: (on, heroId) => effectTargets(get, on, heroId),
    mutateHero: (heroId, mutate, pick) => {
      let chosen: Combatant | null = null;
      set((s: GameState) => {
        if (!s.party.length) return {};
        const idx = heroId
          ? s.party.findIndex((h) => h.id === heroId)
          : pick
            ? pick(s.party)
            : 0;
        if (idx < 0) return {};
        chosen = s.party[idx];
        return { party: s.party.map((h, i) => (i === idx ? mutate(h) : h)) };
      });
      return chosen;
    },
  };
}

/** Issue de l'`apply` d'un handler : `'suspend'` STOPPE la boucle `applyEffects` (l'effet a ouvert une
 *  modale/pending qui reprend la suite — extendedTest, forceDoor) ; sinon (void) la boucle continue. */
type EffectApplyResult = void | 'suspend';

/** Contexte de validation des réfs d'un effet (id-sets de la scène/projet + bornes de la carte). Fourni
 *  par `validateScene` ; `refs` produit des avertissements génériques (sans scope/refId — re-décorés par
 *  l'appelant), ce qui co-localise la validation d'un effet AVEC son application (fin du switch parallèle). */
export interface EffectRefCtx {
  sceneIds: ReadonlySet<string>;
  dialogueIds: ReadonlySet<string>;
  encounterIds: ReadonlySet<string>;
  /** Entités `personnage` de la scène — les PNJ qu'un effet peut désigner (soigneur…). */
  entityIds: ReadonlySet<string>;
  /** LA FICHE derrière une entité `personnage`, par la MÊME projection que le runtime (`sceneNpc`) —
   *  un handler peut ainsi exiger une COMPÉTENCE du PNJ désigné, pas seulement son existence. Fourni
   *  comme `within` : une fonction du contexte, jamais un canal parallèle vers la scène. */
  npcSheet(id: string): Combatant | undefined;
  within(x: number, y: number): boolean;
}
export interface EffectRefIssue {
  level: 'error' | 'warn';
  message: string;
}

/**
 * Un effet = UN handler portant TOUTES ses facettes (fin des Records parallèles `EFFECT_LABEL`/
 * `EFFECT_ICON`/`EFFECT_GROUPS`/`newEffect` + du switch `checkEffect`) : son APPLICATION (`apply`), ses
 * métadonnées d'auteur (`label`/`icon`/`group` pour le picker de l'éditeur), sa FABRIQUE par défaut
 * (`make`) et sa VALIDATION de réfs (`refs`). Le RENDU des champs (`EffectFields`) et le `summary`
 * restent dans l'UI (`EffectList`) car ils dépendent de React / `opSummary` (sib. éditeur) : l'inverser
 * tirerait l'UI dans le moteur (cycle). `T` = la variante d'Effet narrowée (apply/make typés sur elle).
 */
export interface EffectHandler<T extends Effect = Effect> {
  /** Groupe d'INTENTION d'auteur (libellé affiché dans le picker « + Effet », cf. `EFFECT_GROUP_ORDER`). */
  group: string;
  /** Libellé long (picker) et icône (rangée repliée). */
  label: string;
  icon: string;
  /** Effet par défaut posé quand l'auteur ajoute ce type. */
  make(): T;
  /** Conséquence appliquée par `applyEffects`. `'suspend'` = stoppe la boucle (modale/pending ouvert). */
  apply(e: T, env: EffectEnv): EffectApplyResult;
  /** Réfs cassées / valeurs invalides. Absent = rien à valider. */
  refs?(e: T, ctx: EffectRefCtx): EffectRefIssue[];
}

/** Noms des maladies câblées (LDB 20) — défaut de la fabrique `inflictDisease.make`. */
const DISEASE_NAMES = Object.keys(DISEASE_DEFS);

/** Ordre des groupes d'intention dans le picker « + Effet » (l'ordre des handlers ci-dessous donne
 *  l'ordre INTRA-groupe — la déclaration suit l'ancien `EFFECT_GROUPS` aplati). */
export const EFFECT_GROUP_ORDER = [
  'Narration',
  'Récompenses',
  'Afflictions',
  'Temps & repos',
  'Navigation',
  'Combat & social',
  'Tests',
] as const;

/** Mappe chaque `type` d'Effet à son handler narrowé — garantit l'EXHAUSTIVITÉ (tsc échoue si un type
 *  manque) ET le typage par variante de `apply`/`make`/`refs`. */
type EffectHandlerMap = {
  [K in Effect['type']]: EffectHandler<Extract<Effect, { type: K }>>;
};

/**
 * Chute (LDB 15 l.80-84) appliquée à UN combattant : 3 Dégâts/mètre + 1d10, réduits par le Bonus
 * d'Endurance mais PAS par les PA ; si les Blessures subies dépassent le BE → État À Terre. MUTE `c`.
 * Brique PURE partagée par l'Effet `fall` (repositionnement de groupe) et l'effondrement d'une
 * passerelle en combat (`collapseStructure`) — zéro duplication de la formule.
 */
export function applyFall(c: Combatant, metres: number, rng: RNG): void {
  const m = Math.max(0, metres);
  const be = Math.floor(effectiveChar(c, 'endurance') / 10);
  const lost = Math.max(0, 3 * m + d10(rng) - be);
  loseWounds(c, lost);
  if (lost > be) addCondition(c, 'a-terre');
}

/** Exécuteur EN COMBAT du flux d'incantation standard (`castSpell`, `state/combatFlow`) pour l'Effet
 *  `castSpell` (#98) — enregistré par `combatFlow` à son chargement : ce module FEUILLE n'importe RIEN
 *  de `combatFlow` (qui, lui, importe CE module). `null` tant qu'aucun appelant ne s'est enregistré. */
let castSpellRunner: ((get: Get, set: SetFn, caster: Combatant, target: Combatant, spellId: string) => void) | null = null;
/** Enregistre l'exécuteur d'incantation EN COMBAT de l'Effet `castSpell` (appelé par `combatFlow`). */
export function registerCastSpellEffect(fn: NonNullable<typeof castSpellRunner>): void {
  castSpellRunner = fn;
}

/**
 * REGISTRE des effets — source unique data-driven (fin du god-switch `applyEffects`). Déclaré dans
 * l'ordre du picker (groupes de `EFFECT_GROUP_ORDER`, ordre intra-groupe = ordre de déclaration).
 */
export const EFFECT_HANDLERS: EffectHandlerMap = {
  // ── Narration ──────────────────────────────────────────────────────────
  journal: {
    group: 'Narration', label: 'Journal', icon: 'journal/detail',
    make: () => ({ type: 'journal', desc: '' }),
    apply: (e, env) => { env.log(e.desc); },
  },
  document: {
    group: 'Narration', label: 'Document (handout)', icon: 'file/document',
    make: () => ({ type: 'document', title: '', desc: '' }),
    apply: (e, env) => { env.set({ document: { title: e.title, text: e.desc } }); },
  },
  revealClue: {
    group: 'Narration', label: 'Révéler un indice (carnet)', icon: 'ui/search',
    make: () => ({ type: 'revealClue', indiceId: '' }),
    apply: (e, env) => {
      const ind = indiceById(e.indiceId);
      if (!ind) { console.warn(`revealClue : indice inconnu « ${e.indiceId} ».`); return; }
      const before = env.get().clues[e.indiceId];
      const clues = revealClue(env.get().clues, ind, env.get().gameTime, e.stade);
      if (clues === env.get().clues) return;
      env.set({ clues });
      const key = before?.statut === 'réfuté' ? 'eff.clueReactivate' : before ? 'eff.clueAdvance' : 'eff.clueReveal';
      env.log(t(key, { titre: ind.titre }));
    },
  },
  discreditClue: {
    group: 'Narration', label: 'Écarter un indice (fausse piste)', icon: 'ui/forbidden',
    make: () => ({ type: 'discreditClue', indiceId: '' }),
    apply: (e, env) => {
      const ind = indiceById(e.indiceId);
      if (!ind) { console.warn(`discreditClue : indice inconnu « ${e.indiceId} ».`); return; }
      const clues = discreditClue(env.get().clues, ind, env.get().gameTime);
      if (clues === env.get().clues) return;
      env.set({ clues });
      env.log(t('eff.clueDiscredit', { titre: ind.titre }));
    },
  },
  startDialogue: {
    group: 'Narration', label: 'Ouvrir un dialogue', icon: 'journal/dialogue',
    make: () => ({ type: 'startDialogue', dialogue: '' }),
    apply: (e, env) => {
      const dlg = env.get().scene?.dialogues.find((d) => d.id === e.dialogue);
      if (dlg) env.set({ dialogue: { dialogue: dlg, nodeId: dlg.start, speakerId: e.speakerId } });
    },
    refs: (e, ctx) => ctx.dialogueIds.has(e.dialogue) ? [] : [{ level: 'error', message: `Effet → dialogue inexistant « ${e.dialogue} »` }],
  },
  endDialogue: {
    group: 'Narration', label: 'Fermer le dialogue', icon: 'ui/close',
    make: () => ({ type: 'endDialogue' }),
    apply: (_e, env) => {
      if (env.get().dialogue) env.get().advanceTime(TIME_COST.dialogue); // clôture d'une conversation ≈ dialogue min
      env.set({ dialogue: null });
    },
  },
  setFlag: {
    group: 'Narration', label: 'Définir un flag', icon: 'map-tool/start-flag',
    make: () => ({ type: 'setFlag', flag: '', value: true }),
    apply: (e, env) => { env.set((s: GameState) => ({ flags: { ...s.flags, [e.flag]: e.value ?? true } })); },
  },
  setObjective: {
    group: 'Narration', label: 'Objectif courant (« je fais quoi maintenant ? »)', icon: 'map-tool/start-flag',
    make: () => ({ type: 'setObjective', id: '', desc: '' }),
    apply: (e, env) => {
      // Pile keyée par id STABLE : re-poser le même id MET À JOUR le texte (et le remonte en tête), sinon
      // AJOUTE en fin (le plus récent = surface HUD). #238 « personne ne lit le journal » → archivé aussi.
      const hasSched = e.afterMinutes != null || e.afterDays != null || e.atDate != null || e.atHour != null || e.atMinute != null;
      const deadline = hasSched ? scheduleAt(env.get().gameTime, e) : undefined;
      env.set((s: GameState) => {
        const rest = s.objectives.filter((o) => o.id !== e.id);
        return { objectives: [...rest, { id: e.id, text: e.desc, deadline }] };
      });
      env.log(t('eff.objectiveSet', { text: e.desc }));
    },
  },
  clearObjective: {
    group: 'Narration', label: 'Retirer un objectif', icon: 'ui/close',
    make: () => ({ type: 'clearObjective' }),
    apply: (e, env) => {
      const before = env.get().objectives;
      const done = e.id ? before.find((o) => o.id === e.id) : undefined;
      // Solder un objectif l'ARCHIVE (`objectifsSoldes`, #717) : même objet, keyage par id STABLE
      // (re-solder le même id ne le compte pas deux fois). Cette archive est la SEULE dont le récap
      // de fin de chapitre dérive sa chronique — le journal, lui, est une fenêtre glissante de 40.
      env.set((s: GameState) => {
        const soldes = e.id ? (done ? [done] : []) : before;
        const dejaLa = new Set(s.objectifsSoldes.map((o) => o.id));
        return {
          objectives: e.id ? s.objectives.filter((o) => o.id !== e.id) : [],
          objectifsSoldes: [...s.objectifsSoldes, ...soldes.filter((o) => !dejaLa.has(o.id))],
        };
      });
      env.log(done ? t('eff.objectiveDone', { text: done.text }) : t('eff.objectiveClearAll'));
    },
  },
  setLight: {
    group: 'Narration', label: 'Lumière de scène (les lumières baissent / se rallument)', icon: 'scene/light',
    make: () => ({ type: 'setLight', level: 0.3 }),
    apply: (e, env) => { env.set({ lightLevel: Math.max(0, Math.min(1, e.level)) }); }, // mise en scène (Lot L) : niveau borné [0,1]
  },
  setDoor: {
    group: 'Narration', label: 'Porte (ouvrir / fermer — bloque vue et passage)', icon: 'map-tool/door',
    make: () => ({ type: 'setDoor', x: 0, y: 0, side: 'N', open: true }),
    apply: (e, env) => { env.set((s: GameState) => (s.scene ? { scene: setDoorOpen(s.scene, e.x, e.y, e.side, e.z ?? 0, e.open) } : {})); },
  },
  moveEntity: {
    group: 'Narration', label: 'Déplacer / retirer une entité (mise en scène : fuite, entrée, disparition)', icon: 'travel/foot',
    make: () => ({ type: 'moveEntity', id: '' }),
    apply: (e, env) => {
      const sc = env.get().scene;
      if (!sc) return;
      const ent = sc.entities.find((x) => x.id === e.id);
      if (!ent) return; // entité introuvable → no-op
      if (e.to) env.set({ scene: { ...sc, entities: sc.entities.map((x) => (x.id === e.id ? { ...x, pos: { x: e.to!.x, y: e.to!.y }, z: e.to!.z ?? x.z } : x)) } });
      if (e.remove) removeEntity(env.get, env.set, e.id); // APRÈS le repositionnement (fuite-puis-disparition)
    },
  },
  playSfx: {
    group: 'Narration', label: 'Son ponctuel (cloche, cri hors-champ…)', icon: 'audio/volume',
    make: () => ({ type: 'playSfx', id: '' }),
    // Coop : `applyEffects` tourne côté HÔTE (hôte-autoritaire) — ce son ponctuel scripté ne
    // joue que chez l'hôte, pas de réplication audio à l'invité dans ce lot. `moveEntity`
    // (changement d'état) se réplique gratis par le snapshot hôte.
    apply: (e) => { playSfx(e.id); },
  },

  // ── Récompenses ────────────────────────────────────────────────────────
  giveTrapping: {
    group: 'Récompenses', label: 'Donner un objet (équipement/potion/babiole — réel ou custom)', icon: 'item/misc',
    make: () => ({ type: 'giveTrapping', custom: '' }),
    apply: (e, env) => {
      // Objet de CATALOGUE (`trappingId`) sinon objet CUSTOM (`custom`, misc) — source unique itemFromGive.
      // Résolveur campagne-D'ABORD (`campaignData.trappingById`) : un objet de `narratif.objets` gagne (#767).
      const it = itemFromGive(e, undefined, trappingById);
      // Butin MAGIQUE (optionnel) : qualités ajoutées, objet non identifié (qualités masquées jusqu'à
      // Évaluation, #2), skin légendaire. Les qualités restent ACTIVES mécaniquement (registre).
      it.qualities = withGiveQualities(it.qualities, e); // def du catalogue + magiques (ids de scène)
      if (e.identified === false) it.identified = false;
      if (e.skin) it.skin = e.skin;
      if (e.magicKnown) it.magicKnown = true; // aura détectée en fenêtre de loot → suit l'objet
      if (e.detectTried) it.detectTried = true;
      if (e.appraiseTriedDay != null) it.appraiseTriedDay = e.appraiseTriedDay;
      if (e.price) it.price = { gold: e.price.gold ?? 0, silver: e.price.silver ?? 0, brass: e.price.brass ?? 0 };
      const who = env.mutateHero(e.heroId, (h) => {
        const clone: Combatant = structuredClone(h);
        clone.items = [...(clone.items ?? []), it]; // arrive NON équipé
        autoStowNewItem(clone, it); // #204 : rangement par défaut (contenant avec le plus de place libre)
        recomputeLoadout(clone); // met à jour l'encombrement
        return clone;
      });
      env.log(t('eff.recover', { name: who?.label || t('eff.party'), item: it.label }));
    },
  },
  givePossession: {
    group: 'Récompenses', label: 'Donner une possession (bête/serviteur/véhicule)', icon: 'item/misc',
    make: () => ({ type: 'givePossession', nature: 'bete', ref: { creatureId: '' } }),
    apply: (e, env) => {
      const owner = env.mutateHero(e.heroId, (h) => h); // pas de mutation : choisit seulement le propriétaire
      if (!owner) return;
      // `nature`/`ref` corrélés par construction de l'Effet (vehicule ⟺ {vehicleId}, sinon LivingRef) —
      // l'union discriminée de `Possession` ne se reconstruit pas depuis 2 champs plats sans assertion.
      const input = (
        e.nature === 'vehicule'
          ? { nature: 'vehicule', vehicleId: (e.ref as { vehicleId: string }).vehicleId, ownerId: owner.id, location: { kind: 'avec-le-groupe' }, items: [] }
          : { nature: e.nature, ref: e.ref as LivingRef, ownerId: owner.id, location: { kind: 'avec-le-groupe' }, items: [] }
      ) as unknown as PossessionInput;
      const uid = addPossession(env.get, env.set, input);
      env.log(t('eff.recover', { name: owner.label, item: possessionLabel({ ...input, uid } as Possession) }));
    },
  },
  giveMoney: {
    group: 'Récompenses', label: 'Donner/retirer de l’argent', icon: 'resource/gold-purse',
    make: () => ({ type: 'giveMoney', gold: 0, silver: 0, brass: 0 }),
    apply: (e, env) => {
      // Argent de GROUPE sans bénéficiaire unique : positif = butin/récompense réparti PAR TÊTE
      // (`distributeCredit`) ; négatif = perte SCRIPTÉE — `drainGroup` (glouton PLAFONNÉ, jamais
      // esquivée par le tout-ou-rien de `payFromGroup` : une perte > total du groupe vide tout à 0).
      const net = toBrass({ gold: e.gold ?? 0, silver: e.silver ?? 0, brass: e.brass ?? 0 });
      if (net > 0) distributeCredit(env.get, env.set, fromBrass(net));
      else if (net < 0) drainGroup(env.get, env.set, fromBrass(-net));
      const parts = [e.gold && t('eff.coin.gold', { n: e.gold }), e.silver && t('eff.coin.silver', { n: e.silver }), e.brass && t('eff.coin.brass', { n: e.brass })].filter(Boolean); // noms canon FR (couronne/pistole/sou)
      if (parts.length) env.log(t('eff.purse', { sign: (e.gold ?? 0) < 0 || (e.silver ?? 0) < 0 ? '' : '+', parts: parts.join(' ') }));
    },
  },
  giveXp: {
    group: 'Récompenses', label: 'Donner des PX (groupe)', icon: 'resource/xp',
    make: () => ({ type: 'giveXp', amount: 50 }),
    apply: (e, env) => {
      env.set((s: GameState) => ({
        party: s.party.map((h) => {
          const clone: Combatant = structuredClone(h);
          clone.xp = (clone.xp ?? 0) + e.amount;
          return clone;
        }),
      }));
      env.log(t('eff.xp', { amount: e.amount }));
    },
  },
  learnSpell: {
    group: 'Récompenses', label: 'Apprendre un sort (trouvaille, sans PX)', icon: 'magic/power',
    make: () => ({ type: 'learnSpell', spell: '', heroId: '' }),
    apply: (e, env) => {
      // Trouvaille de campagne : le sort est appris SANS PX (l'auteur l'octroie — le coût
      // en PX ne vaut que pour la mémorisation volontaire, LDB 46 l.16-20).
      const sp = findSpellById(e.spell);
      if (!sp) return;
      // `c.spells` = IDS de sort (résolus par findSpellById dans la console/IA/grimoire) ; le libellé
      // ne sert qu'à l'affichage (log ci-dessous). Même convention que pregens/buySpell/Béni.
      const who = env.mutateHero(
        e.heroId,
        (h) => ((h.spells ?? []).includes(sp.id) ? h : { ...h, spells: [...(h.spells ?? []), sp.id] }),
        (party) => party.findIndex((h) => !!eligibleTalent(h, sp) && !(h.spells ?? []).includes(sp.id)),
      );
      if (who) env.log(t('eff.learnSpell', { name: who.label, spell: sp.label }));
    },
  },
  petitePriere: {
    group: 'Récompenses', label: 'Petites Prières (site sacré — non-Béni, LDB 25)', icon: 'faith/prayer',
    make: () => ({ type: 'petitePriere', reward: EMPTY_FLOW }),
    apply: (e, env) => {
      // « Petites Prières » (LDB 25 l.22-24, option `prayer-petites`) : un NON-Béni prie dans un site
      // sacré → 1d100 secret, exaucé sur 01 (pourcentage relevé s'il a la Compétence Prière).
      if (!rule('prayer-petites')) return; // option désactivée → ignorée
      const pool = env.get().party;
      const isBeni = (h: Combatant) => h.talents.some((t) => t.talentId === 'beni' && (t.times ?? 1) >= 1);
      const target = e.heroId
        ? pool.find((h) => h.id === e.heroId && !h.dead)
        : pool.find((h) => !h.dead && !isBeni(h));
      if (!target) return;
      // Un Bienheureux prie NORMALEMENT (Miracle/Bénédiction) — les Petites Prières sont la voie des
      // non-Bénis (LDB 25 l.24).
      if (isBeni(target)) {
        env.log(t('eff.petitePriereBeni', { name: target.label }));
        return;
      }
      // Seuil : « exaucé sur 01 » ; LDB 25 l.22-24 — silence, valeur maison (règle
      // `prayer-petites-bonus-per-advance`) pour le « le MJ peut augmenter ce pourcentage ».
      const priereAdv = target.skills.find((sk) => sk.id === 'priere')?.advances ?? 0;
      const threshold = 1 + Math.max(0, priereAdv) * Number(rule('prayer-petites-bonus-per-advance'));
      const roll = d100(battleRng());
      if (petitePriereAnswered(roll, threshold)) {
        env.log(t('eff.petitePriereOk', { name: target.label, roll, threshold }));
        runFlow(env.get, env.set, e.reward, t('eff.petitePriereReward')); // récompense authorée (bonus/don/flag)
      } else {
        env.log(t('eff.petitePriereKo', { name: target.label, roll }));
      }
    },
  },
  sessionEnd: {
    group: 'Récompenses', label: 'Fin de séance (Ambitions/Motivation — LDB 05/17)', icon: 'journal/detail',
    make: () => ({ type: 'sessionEnd' }),
    apply: (_e, env) => { env.get().openSessionEnd(); }, // ouvre l'écran de fin de séance existant (SessionEndModal → endSession)
  },
  openCharacterCreator: {
    group: 'Récompenses', label: 'Créer un personnage (assistant)', icon: 'ui/add',
    make: () => ({ type: 'openCharacterCreator' }),
    apply: (_e, env) => { env.get().setEditingHero(null); env.get().setScreen('creator'); }, // assistant existant (src/ui/creator), nouveau héros
  },
  restoreFortune: {
    group: 'Récompenses', label: 'Regagner la Chance (début de session, max = Destin)', icon: 'resource/fortune',
    make: () => ({ type: 'restoreFortune' }),
    apply: (_e, env) => {
      // Début de session (LDB 17 l.41) : Chance regagnée jusqu'au maximum = Destin actuel.
      env.set((s: GameState) => ({ party: restoreFortune(s.party) }));
      env.log(t('eff.restoreFortune'));
    },
  },
  grantFavor: {
    group: 'Récompenses', label: 'Accorder une Faveur due (LDB 23 l.139-153)', icon: 'ui/balance',
    make: () => ({ type: 'grantFavor', level: 'mineure', owedTo: '', desc: '' }),
    apply: (e, env) => {
      // Faveur de départ de campagne ou octroi narratif (#509) — cible : héros désigné, sinon le
      // premier héros vivant (`env.targets` : même défaut que les autres Effets `hero`).
      const hero = env.targets('hero', e.heroId)[0];
      if (hero) env.get().favorGrant(hero.id, e.level, e.owedTo, e.desc);
    },
  },

  // ── Afflictions ────────────────────────────────────────────────────────
  ops: {
    group: 'Afflictions', label: 'Effets mécaniques (Blessures / État / buffs… — vocabulaire des sorts)', icon: 'mechanic/stat-mod',
    make: () => ({ type: 'ops', on: 'party', ops: [{ op: 'wounds', amount: 5 }] }),
    apply: (e, env) => {
      // EffectOp : applique les GameOps (vocabulaire mécanique des sorts) à la cible de SCÈNE
      // (`party`/`hero`). `caster`/`target` = contexte d'incantation, résolu par le flux de sort → ignoré ici.
      // `applyLeafOps` = SOURCE UNIQUE : contexte de FEUILLE (untilTime/label bakés par un consommable —
      // la branche d'un `test` suspendu garde sa durée) + programmation des ops `delayed`.
      const on = e.on ?? 'party';
      if (on !== 'party' && on !== 'hero') return;
      const targets = env.targets(on, e.heroId);
      if (!targets.length) return;
      const lines = targets.flatMap((c) => applyLeafOps(env.get, env.set, c, e, { rng: defaultRNG, sl: env.sl, onCorruption: (n, align) => gainCorruption(env.get, env.set, c, n, align) }));
      env.set(touchActors(env.get()));
      lines.forEach((l) => env.log(l));
    },
  },
  zoneBlast: {
    group: 'Afflictions', label: 'Souffle de zone (effets mécaniques, rayon)', icon: 'magic/area',
    make: () => ({ type: 'zoneBlast', center: { x: 0, y: 0 }, radius: 2, ops: [{ op: 'wounds', amount: { dice: { n: 1, sides: 10, plus: 15 } } }] }),
    apply: (e, env) => {
      // Cibles dans le disque (Chebyshev, `combatantsWithinRadius`) : en combat par position de chaque
      // combattant ; hors combat, le groupe entier est à partyPos. Chaque cible encaisse les `ops`
      // (vocabulaire unique, jet PAR cible pour les Dégâts à dés) via `applyOps`.
      const inBattle = !!env.get().battle;
      const pp = env.get().partyPos;
      // Hors combat : on positionne virtuellement les héros à partyPos pour la géométrie d'aire partagée.
      const pool: Combatant[] = inBattle
        ? env.get().battle!.combatants
        : env.get().party.filter((c) => c.kind === 'hero').map((c) => ({ ...c, pos: pp }));
      // `Effect.zoneBlast.center` n'authore que `{x,y}` (pas d'étage éditable) — hors combat, le pool
      // entier est virtuellement à `pp` (ligne ci-dessus) : le centre du souffle DOIT porter le même
      // étage que `pp`, sinon le défaut z-aware de `combatantsWithinRadius` (`center.z ?? 0`) exclut
      // le groupe dès que `pp.z` n'est pas 0 (bombe posée à l'étage, #opera). En combat, le centre
      // reste tel qu'authoré (les combattants réels portent chacun leur propre étage).
      const center = inBattle ? e.center : { ...e.center, z: pp.z };
      const targets = combatantsWithinRadius(center, e.radius, pool, (c) => !c.dead);
      if (!targets.length) return;
      // Hors combat, `applyOps` a muté les CLONES → on ré-applique aux héros réels par id.
      const lines = targets.flatMap((c) => {
        const real = inBattle ? c : env.get().party.find((h) => h.id === c.id) ?? c;
        return applyOps(real, e.ops, { rng: battleRng() });
      });
      env.set(touchActors(env.get()));
      env.log(t('eff.blast', { lines: lines.join(' · ') }));
    },
    refs: (e, ctx) => {
      const out: EffectRefIssue[] = [];
      if (!ctx.within(e.center.x, e.center.y)) out.push({ level: 'warn', message: `Souffle de zone : centre (${e.center.x},${e.center.y}) hors de la carte` });
      if (!e.ops?.length) out.push({ level: 'error', message: `Souffle de zone : aucun effet mécanique` });
      if (e.radius < 0) out.push({ level: 'error', message: `Souffle de zone : rayon négatif` });
      return out;
    },
  },
  fall: {
    group: 'Afflictions', label: 'Chute (dégâts/m + 1d10, À Terre, repositionne le groupe)', icon: 'journal/fall',
    make: () => ({ type: 'fall', target: 'party', metres: 4 }),
    apply: (e, env) => {
      // Chute (LDB 15 l.80-84) : 3 Dégâts/mètre + 1d10, réduits par le Bonus d'Endurance mais
      // PAS par les PA ; si les Blessures subies > BE → État À Terre. `to` repose le groupe (hors
      // combat). Dégâts TIRÉS par cible et révélés au journal (involontaire : pas de Test d'Athlétisme).
      const targets = env.targets(e.target, e.heroId);
      const m = Math.max(0, e.metres);
      const lines = targets.map((c) => {
        const before = c.wounds.current;
        const wasDown = hasCondition(c, 'a-terre');
        applyFall(c, m, battleRng());
        const lost = before - c.wounds.current;
        const knocked = !wasDown && hasCondition(c, 'a-terre');
        return t('eff.fallTarget', { name: c.label, lost, aterre: knocked ? t('eff.fragATerre') : '' });
      });
      // `to` ramène le faller au PIED (chute → il retombe en bas, LDB 15) : le GROUPE hors combat, ou
      // les combattants nommés en combat (escalade ratée → hisse annulée par `placeCombatant`).
      const sc = env.get().scene;
      if (e.to && env.get().battle && sc) for (const c of targets) placeCombatant(c, sc, e.to);
      if (targets.length) {
        env.set({ ...touchActors(env.get()), ...(e.to && !env.get().battle ? { partyPos: e.to } : {}) });
        env.log(t('eff.fall', { m, lines: lines.join(' · ') }));
      } else if (e.to && !env.get().battle) env.set({ partyPos: e.to });
    },
  },
  inflictDisease: {
    group: 'Afflictions', label: 'Infliger une maladie (LDB 20)', icon: 'medical/infection',
    make: () => ({ type: 'inflictDisease', disease: DISEASE_NAMES[0] ?? '', heroId: '' }),
    apply: (e, env) => {
      // Maladie (LDB 20) infligée par l'auteur (nourriture avariée, contact infecté…). Incubation/durée
      // tirées à la contraction ; les symptômes se déclareront au repos. Dédoublonnée par nom.
      let whoId = '';
      const who = env.mutateHero(e.heroId, (h) => {
        if ((h.diseases ?? []).some((d) => d.id === e.disease)) return h; // déjà présente → no-op
        const dz = contractDisease(e.disease, battleRng());
        if (!dz) return h;
        whoId = h.id;
        return { ...h, diseases: [...(h.diseases ?? []), dz] };
      });
      if (who && whoId) {
        const line = t('eff.diseaseContracted', { name: who.label, disease: e.disease });
        env.log(line);
        // VISIBLE (le journal seul ne suffit pas) : effet d'AUTEUR → révélation témoin.
        env.pushReveal({ kind: 'effet', title: t('eff.diseaseTitle', { disease: e.disease }), lines: [line], subjectId: whoId, severity: 'grave' });
      }
    },
  },
  inflictHunger: {
    group: 'Afflictions', label: 'Imposer la Faim (LDB 18 — groupe affamé)', icon: 'flag/hungry',
    make: () => ({ type: 'inflictHunger', days: 1, target: 'party' }),
    apply: (e, env) => {
      // Faim (LDB 18 l.337-343) posée par l'auteur (siège, cachot, traversée sans vivres) : `days`
      // échecs de Test de Faim encaissés d'affilée, via la fonction PURE `applyFaimTest` (1ᵉʳ → −10 F/E ;
      // 2ᵉ+ → −10 autres + 1d10 Dégâts ignorant les PA, min 1). Réutilise le moteur des provisions.
      const heroes = env.targets(e.target ?? 'party', e.heroId);
      const n = Math.max(1, e.days ?? 1);
      const lines: string[] = [];
      for (const c of heroes) {
        c.hunger = c.hunger ?? { days: 0, tests: 0, failures: 0 };
        c.hunger.days += n;
        const be = Math.floor(effectiveChar(c, 'endurance') / 10);
        let damage = 0;
        for (let i = 0; i < n; i++) {
          const r = applyFaimTest(c, false, be, battleRng());
          lines.push(...r.log);
          damage += r.damage;
        }
        if (damage > 0) loseWounds(c, damage);
      }
      if (heroes.length) { env.set(touchActors(env.get())); lines.forEach((l) => env.log(l)); }
    },
  },
  inflictThirst: {
    group: 'Afflictions', label: 'Imposer la Soif (LDB 18 — groupe assoiffé)', icon: 'flag/hungry',
    make: () => ({ type: 'inflictThirst', days: 1, target: 'party' }),
    apply: (e, env) => {
      // Soif (LDB 18 l.340, miroir de la Faim) posée par l'auteur — via la fonction PURE partagée
      // `applySoifTest` (1ᵉʳ → −10 Int/FM/Soc ; 2ᵉ+ → −10 autres + 1d10 Dégâts ignorant les PA, min 1).
      const heroes = env.targets(e.target ?? 'party', e.heroId);
      const n = Math.max(1, e.days ?? 1);
      const lines: string[] = [];
      for (const c of heroes) {
        const be = Math.floor(effectiveChar(c, 'endurance') / 10);
        let damage = 0;
        for (let i = 0; i < n; i++) {
          const r = applySoifTest(c, false, be, battleRng());
          lines.push(...r.log);
          damage += r.damage;
        }
        if (damage > 0) loseWounds(c, damage);
      }
      if (heroes.length) { env.set(touchActors(env.get())); lines.forEach((l) => env.log(l)); }
    },
  },
  exposureNight: {
    group: 'Afflictions', label: 'Exposition froid / chaleur (LDB 18)', icon: 'rest/cold',
    make: () => ({ type: 'exposureNight', kind: 'froid', count: 2, target: 'party' }),
    apply: (e, env) => {
      // Exposition (LDB 18 l.326-334) posée par l'auteur (nuit glaciale, désert, tempête) : `count` Tests
      // de Résistance PAR HÉROS, chacun une ÉTAPE de cascade INFLUENÇABLE (Chance/Résilience) — jamais de
      // jet silencieux (calque `waterExposure` / la nuit de repos). L'escalade froid/chaleur (`meta.kind`)
      // + la peau de phoque vivent dans l'applier partagé `exposure`. La protection magique (`weatherWard`)
      // court-circuite comme dans le moteur eager `exposureNight`.
      const heroes = env.targets(e.target ?? 'party', e.heroId);
      const count = Math.max(1, e.count ?? 2);
      const kind: ExposureKind = e.kind ?? 'froid';
      const steps: BuiltCascadeStep[] = [];
      const lines: string[] = [];
      for (const c of heroes) {
        if (isWeatherWarded(c)) { lines.push(t('eff.weatherWarded', { name: c.label, what: t(kind === 'froid' ? 'eff.wardFroid' : 'eff.wardChaleur') })); continue; }
        const resVal = testValue(c, 'resistance', 'endurance');
        const target = kind === 'froid' ? exposureTarget(c, resVal) : Math.max(0, resVal);
        // Ligne montée ICI : au FROID la cible vient d'`exposureTarget` (le manteau manquant y est fondu,
        // et ressort en chip nommée) — une autre arithmétique que celle du monteur, à ne pas refaire.
        const st = monoStep({
          id: `expo-${c.id}`, kind: 'exposure', actor: c, icon: 'rest/cold',
          rollLabel: 'Résistance', label: stepPrecision(t('step.exposition'), t(kind === 'froid' ? 'step.froid' : 'step.chaleur')),
          difficulty: 'intermediaire',
          montee: { base: resVal, ...(kind === 'froid' ? exposureCoatMods(c) : {}), target },
          meta: { kind }, stake: nightStakeRef('exposure'),
        });
        pousseSi(steps, st);
      }
      if (lines.length) { env.set(touchActors(env.get())); lines.forEach((l) => env.log(l)); }
      // BANDE d'Exposition (#1117 L3) : une fenêtre par VAGUE, les héros exposés en rangées — les
      // vagues suivantes se déroulent APRÈS les délestages de la précédente (`nextExposureWave`).
      const band = exposureWaveBand(steps, kind, count);
      if (band.length) openSequence(env.get, env.set, { title: t(kind === 'froid' ? 'eff.expoFroidTitre' : 'eff.expoChaleurTitre'), icon: 'rest/cold', purpose: 'test', steps: band });
    },
  },
  inflictTrauma: {
    group: 'Afflictions', label: 'Infliger une Blessure Critique (LDB 18)', icon: 'journal/critical',
    make: () => ({ type: 'inflictTrauma', kind: 'fracture', severity: 'mineur', location: 'brasD', heroId: '' }),
    apply: (e, env) => {
      // Blessure Critique posée rétroactivement par l'éditeur (LDB 18) : déchirure/fracture via `traumaById`
      // (fiche `traumas.json` résolue par `dechirureFractureFicheId`, effets en-combat + convalescence),
      // amputation via les séquelles permanentes (`permanentAmputations`). criticalWounds suit (compteur LDB 18).
      let labels: string[] = [];
      let whoId = '';
      const who = env.mutateHero(e.heroId, (h) => {
        whoId = h.id;
        const be = Math.floor(effectiveChar(h, 'endurance') / 10);
        // Amputation : séquelle PERMANENTE choisie par localisation (bras → main/bras ; jambe → membre
        // inférieur ; tête → œil, choix d'éditeur) — ids de fiche `traumas.json`, plus de texte parsé.
        const ampSequel = e.location === 'tete' ? 'oeil-perdu' : e.location === 'brasG' || e.location === 'brasD' ? 'main-bras-ampute' : 'membre-inferieur-ampute';
        const traumas = e.kind === 'amputation'
          ? permanentAmputations([ampSequel], e.location)
          : [traumaById(dechirureFractureFicheId(e.kind, e.severity ?? 'mineur', e.location), { be, d10: d10(battleRng()) }, e.location)];
        labels = traumas.map((tr) => tr.label);
        return { ...h, traumas: [...(h.traumas ?? []), ...traumas], criticalWounds: (h.criticalWounds ?? 0) + 1 };
      });
      if (who) {
        const line = t('eff.criticalSuffered', { name: who.label, kind: e.kind, location: e.location });
        env.log(line);
        // VISIBLE (le journal seul ne suffit pas) : effet d'AUTEUR → révélation témoin.
        env.pushReveal({ kind: 'effet', title: t('eff.criticalTitle', { kind: e.kind }), lines: [line, ...labels], subjectId: whoId, severity: 'grave' });
      }
    },
  },
  inflictNightmares: {
    group: 'Afflictions', label: 'Infliger des cauchemars (trauma nocturne)', icon: 'flag/fear',
    make: () => ({ type: 'inflictNightmares', heroId: '' }),
    apply: (e, env) => {
      // Trauma « Cauchemars » (LDB 21 l.95) posé sur un héros (défaut : le premier).
      const who = env.mutateHero(e.heroId, (h) => ({ ...h, nightmares: true }));
      if (who) env.log(t('eff.nightmares', { name: who.label }));
    },
  },
  ambitionLost: {
    group: 'Afflictions', label: 'Ambition anéantie → Trauma (ADE II Annexe I)', icon: 'journal/heartbreak',
    make: () => ({ type: 'ambitionLost', heroId: '' }),
    apply: (e, env) => {
      // Trauma (ADE II Annexe I) : « témoin d'un événement qui rend une Ambition complètement irréalisable
      // → Test de Calme Accessible (+20) ; échec → Trauma Psychologique ». La fonction pure porte la garde de
      // la règle facultative `psych-acquisition-optional` (null si éteinte → effet inerte, aucun RNG consommé).
      let shown: { roll: number; target: number } | null = null;
      let acquired = false;
      const who = env.mutateHero(e.heroId, (h) => {
        const res = traumaOnImpossibleAmbition(h, battleRng());
        if (!res) return h; // règle facultative éteinte
        shown = { roll: res.test.roll, target: res.test.target };
        if (!res.trait) return h; // Calme réussi → l'Ambition brisée n'a pas laissé de trauma
        acquired = true;
        return { ...h, psychTraits: [...(h.psychTraits ?? []), res.trait] };
      });
      if (!who || !shown) return;
      const s = shown as { roll: number; target: number };
      const line = t(acquired ? 'eff.ambitionTrauma' : 'eff.ambitionResisted', { name: who.label, roll: s.roll, target: s.target });
      env.log(line);
      if (acquired) env.pushReveal({ kind: 'effet', title: t('eff.ambitionTitle'), lines: [line], subjectId: who.id, severity: 'grave' });
    },
  },
  inflictPsychology: {
    group: 'Afflictions', label: 'Peur / Terreur scénique (LDB 21)', icon: 'flag/fear',
    make: () => ({ type: 'inflictPsychology', kind: 'peur', indice: 1, label: 'Une vision terrifiante', target: 'party' }),
    apply: (e, env) => {
      // Source de Peur/Terreur SCÉNIQUE (apparition, présage) : MÊME cascade de Tests de Calme que la
      // Psychologie de rencontre (`openScriptedPsych`, applier 'encounterPsych' partagé) — jamais un jet
      // silencieux. Frénésie s'octroie déjà via `ops`/`grantPsychTrait` (capacité, pas une affliction testée).
      const heroes = env.targets(e.target ?? 'party', e.heroId);
      openScriptedPsych(env.get, env.set, e.kind, Math.max(1, e.indice ?? 1), e.label || t('eff.psychScene'), heroes);
    },
  },
  corruptionExposure: {
    group: 'Afflictions', label: 'Influence corruptrice (Test, LDB 19)', icon: 'nav/mutation',
    make: () => ({ type: 'corruptionExposure', level: 'mineure', skill: { id: 'resistance' }, heroId: '' }),
    apply: (e, env) => {
      // Influence corruptrice (LDB 19 l.23-75) : ouvre le Test différé par modale
      // (Lancer → Chance → Appliquer) ; le gain dépendra du niveau et du DR.
      const hero = corruptionTarget(env.get(), e.heroId);
      // `e.skill` présent = déterminé en amont (verrouillé) ; absent = nature indéterminée → le
      // joueur choisira Résistance/Calme dans la modale (défaut affiché : Résistance).
      // Test d'Exposition = « résister à la Corruption » → Résistance (Menace : Corruption) offerte (LDB 10).
      // La pose passe par LA PORTE du slot (#1282) : une fenêtre de Corruption déjà ouverte n'est pas
      // écrasée — l'Exposition prend rang (`corruptionQueue`).
      if (hero) poseCorruptionPending(env.get, env.set, { heroId: hero.id, level: e.level, skill: testDeCorruption(e.skill), skillLocked: e.skill != null, align: e.align, menace: 'corruption' });
    },
  },
  giveSin: {
    group: 'Afflictions', label: 'Points de Péché (prêtre fautif, LDB 40)', icon: 'ui/balance',
    make: () => ({ type: 'giveSin', amount: 1, heroId: '' }),
    apply: (e, env) => {
      // Points de Péché (LDB 40 l.36) : sanction d'auteur, 1 à 3 selon la gravité — appliquée par
      // l'op `sinMod` (COUTURE UNIQUE du Péché, partagée avec les issues d'Activité ACE).
      // Cible : héros désigné, sinon le premier sachant Prier (le Péché vise un Bienheureux).
      const amount = Math.max(1, e.amount ?? 1);
      const lines: string[] = [];
      const who = env.mutateHero(
        e.heroId,
        (h) => {
          const clone = { ...h };
          lines.push(...applyOps(clone, [{ op: 'sinMod', amount }], {}));
          return clone;
        },
        (party) => {
          const i = party.findIndex((h) => h.skills.some((sk) => sk.id === 'priere' && sk.advances >= 1));
          return i >= 0 ? i : 0;
        },
      );
      if (who) for (const l of lines) env.log(l);
    },
  },
  waterExposure: {
    group: 'Afflictions', label: 'Exposition hydrique (eau souillée — MSRC 16)', icon: 'travel/wave',
    make: () => ({ type: 'waterExposure', mode: 'ingestion', target: 'hero' }),
    apply: (e, env) => {
      // « Maladies transmises par l'eau » (MSRC 16 p.91) : UN Test de Résistance Intermédiaire (+0) modifié
      // PAR HÉROS exposé — étape de cascade influençable (jamais de jet silencieux). Modificateurs
      // cumulés : tableau 1 « Source d'eau » (choix d'auteur `e.source`, ingestion ET immersion) +
      // tableau 2 « Blessures et États » (DÉRIVÉ du héros, immersion seule). La conséquence (d100
      // « +10/DR négatif » → contraction DIRECTE) vit dans l'applier `waterExposure`.
      const heroes = env.targets(e.target ?? 'hero', e.heroId);
      if (!heroes.length) return;
      const src = sourceExposureMod(e.source);
      const steps = heroes.flatMap((h) => {
        const auto = autoExposureMods(h, e.mode); // tableau 2 (gate `appliesTo` interne : immersion seule)
        const parts = [...(src ? [src] : []), ...auto]; // tableau 1 : « à l'ingestion et à l'immersion »
        const detail = parts.map((m) => `${m.label} ${m.mod > 0 ? '+' : ''}${m.mod}`).join(' · ');
        // Ligne montée par le MONTEUR CANONIQUE (dans le mint) : la base est le Niveau de Résistance NU,
        // et les deux tableaux d'exposition sont des lignes NOMMÉES sur la cible, chacune liée à la
        // fiche qui les octroie (MSRC 16).
        const step = monoStep({
          id: `waterExposure-${h.id}`, kind: 'waterExposure', actor: h, icon: 'travel/wave',
          rollLabel: refLabel('skills', WATER_EXPOSURE.test.skill),
          label: t('eff.waterExposure', { mode: e.mode === 'immersion' ? 'immersion' : 'ingestion', detail: detail ? ` (${detail})` : '' }),
          difficulty: WATER_EXPOSURE.test.difficulty,
          ligne: {
            test: { skill: WATER_EXPOSURE.test.skill.id, spec: WATER_EXPOSURE.test.skill.spec },
            surLaCible: parts.map((m): ModLine => ({
              label: m.label, value: m.mod, famille: 'jet', ref: RULE_REF['exposition-hydrique'],
            })),
          },
          stake: combatStakeRef('waterExposure'),
        });
        return step ? [step] : [];
      });
      if (steps.length) openSequence(env.get, env.set, { title: t('eff.waterTitle'), icon: 'travel/wave', purpose: 'test', steps });
    },
  },

  // ── Temps & repos ──────────────────────────────────────────────────────
  rest: {
    group: 'Temps & repos', label: 'Repos (Dormir / Se reposer N jours)', icon: 'rest/bed',
    make: () => ({ type: 'rest', days: 1 }),
    apply: (e, env) => {
      // Repos déclenché par l'éditeur (trigger/dialogue) : ouvre la MODALE DE NUIT (couchage +
      // pitance par héros, prix RAW, bilan globalisé). `lodging` non renseigné dans l'effet ⇒
      // défaut maison (arbitrage de contexte, cf. `placesOfKind`).
      openRest(env.get, env.set, { places: placesOfKind(e.lodging ?? 'maison'), quality: e.quality, days: e.days ?? 1 });
    },
  },
  mealParty: {
    group: 'Temps & repos', label: 'Repas (nourrit le groupe sans ration — faim à zéro)', icon: 'rest/stew',
    make: () => ({ type: 'mealParty' }),
    apply: (_e, env) => {
      // Repas (#T2) : tout le groupe est nourri pour la journée sans consommer de ration —
      // compteurs/malus de Faim remis à zéro (LDB 18 l.337-343 ; prix éventuel porté par le choix).
      const diners = env.get().party;
      for (const h of diners) if (!h.dead) feedFromMeal(h);
      env.set({ party: [...diners] });
      env.log(t('eff.meal'));
    },
  },
  interlude: {
    group: 'Temps & repos', label: 'Entre deux aventures (Événements + Activités, N semaines)', icon: 'time/calendar',
    make: () => ({ type: 'interlude', weeks: 1 }),
    apply: (e, env) => {
      // « Entre deux aventures » (LDB 22-23) — via l'action store (pas d'import direct : cycle).
      // Règle optionnelle (LDB 21 l.108-110) : tout le chapitre est facultatif → désactivable.
      if (rule('interlude-enabled')) env.get().startInterlude(e.weeks ?? 1);
    },
  },
  setTime: {
    group: 'Temps & repos', label: 'Régler l’heure (jour/nuit)', icon: 'time/clock',
    make: () => ({ type: 'setTime', phase: 'nuit' }),
    apply: (e, env) => {
      // Saut EN AVANT jusqu'à la prochaine occurrence de la phase/heure visée (le temps ne recule jamais).
      // `phase` ⊕ `hour` (XOR porté par `setTimeSchema`, defs-scenes/effets.ts).
      const target = e.phase !== undefined
        ? (DAY_PHASES.find((p) => p.id === e.phase)?.start ?? 0)
        : (e.hour ?? 0) * 60 + (e.minute ?? 0);
      env.get().advanceTime(minutesUntilNext(env.get().gameTime, target));
    },
  },
  delayedEffect: {
    group: 'Temps & repos', label: 'Effet différé (minuterie / heure)', icon: 'ui/wait',
    make: () => ({ type: 'delayedEffect', afterMinutes: 60, flow: EMPTY_FLOW, cancelFlag: '' }),
    apply: (e, env) => {
      // Échéance absolue (minute `gameTime`), résolue par `scheduleAt` (engine/clock — source unique).
      const now = env.get().gameTime;
      const executeAt = scheduleAt(now, e);
      env.set((s: GameState) => ({ scheduledEffects: [...s.scheduledEffects, { executeAt, flow: e.flow, cancelFlag: e.cancelFlag }] }));
    },
  },

  // ── Navigation ─────────────────────────────────────────────────────────
  transition: {
    group: 'Navigation', label: 'Transition de scène', icon: 'nav/entry-point',
    make: () => ({ type: 'transition', scene: '', entry: '' }),
    apply: (e, env) => {
      const cur = env.get();
      if (cur.scene) env.set({ previousScene: { id: cur.scene.id, pos: { ...cur.partyPos } } });
      env.get().transitionTo(e.scene, e.entry);
    },
    refs: (e, ctx) => ctx.sceneIds.has(e.scene) ? [] : [{ level: 'error', message: `Effet → scène inexistante « ${e.scene} »` }],
  },
  transitionBack: {
    group: 'Navigation', label: 'Retour scène précédente', icon: 'ui/undo',
    make: () => ({ type: 'transitionBack' }),
    apply: (_e, env) => {
      const prev = env.get().previousScene;
      if (prev) {
        env.set({ previousScene: null });
        env.get().transitionTo(prev.id, undefined, prev.pos);
      }
    },
  },
  openWorldMap: {
    group: 'Navigation', label: 'Ouvrir la carte du monde (partir en voyage)', icon: 'travel/world',
    make: () => ({ type: 'openWorldMap' }),
    apply: (_e, env) => {
      // « Partir en voyage » depuis une porte/route de la scène (#T2) — l'action est déjà gardée
      // (no-op sans carte ou en combat).
      env.get().openWorldMap();
    },
  },
  setVessel: {
    group: 'Navigation', label: 'Doter le groupe d\'un navire (MDG 13-15)', icon: 'travel/anchor',
    make: () => ({ type: 'setVessel', vehicleId: '', morale: MORALE_BASE }),
    apply: (e, env) => {
      // Pose le NAVIRE DE CAMPAGNE (`state.vessel`) — comme le champ de scénario `TestScenario.vessel`,
      // mais authorable. Moral neuf par défaut (MORALE_BASE) ; coque intacte sauf `hull*` authoré.
      const v = findVehicleById(e.vehicleId);
      if (!v?.ship) return; // ref invalide (validée par `refs`) : no-op
      env.set({
        vessel: {
          vehicleId: e.vehicleId,
          ...(e.label?.trim() ? { label: e.label.trim() } : {}), // #230 — nom d'instance (affichage)
          morale: { score: e.morale ?? MORALE_BASE, lastMoraleWeek: 0, factors: [] },
          ...(e.hullMax != null ? { wounds: { current: e.hullCurrent ?? e.hullMax, max: e.hullMax } } : {}),
          ...(e.saboteurDR != null ? { saboteurDR: e.saboteurDR } : {}),
          ...(e.waterLitres != null ? { waterLitres: Math.max(0, e.waterLitres) } : {}),
          ...(e.provisions != null ? { provisions: Math.max(0, e.provisions) } : {}),
          ...(e.crew && e.crew.length ? { crew: e.crew.filter((h) => h.roleId && h.count > 0) } : {}),
        },
      });
      env.log(t('eff.setVessel', { name: e.label?.trim() || v.label }));
    },
    refs: (e) => {
      const v = e.vehicleId ? findVehicleById(e.vehicleId) : undefined;
      if (!v) return [{ level: 'error', message: `Effet → navire inexistant « ${e.vehicleId || '(vide)'} »` }];
      if (!v.ship) return [{ level: 'error', message: `Effet → « ${v.label} » n'est pas un navire (pas de facette ship)` }];
      return [];
    },
  },
  adjustManann: {
    group: 'Navigation', label: 'Humeur de Manann (MDG 15 l.83-125)', icon: 'travel/anchor',
    make: () => ({ type: 'adjustManann', delta: { flat: 5, d10: 0, sign: 1 } }),
    apply: (e, env) => {
      const vessel = env.get().vessel;
      if (!vessel) { env.log(t('eff.manannNoVessel')); return; }
      const mood = vesselManann(vessel);
      if (e.factorId) {
        const already = mood.applied.includes(e.factorId);
        const { mood: next, delta, label } = applyManannFactor(mood, e.factorId, battleRng());
        if (already) { env.log(t('eff.manannAlready', { factor: label ?? e.factorId })); return; }
        env.set({ vessel: { ...vessel, manann: next } });
        env.log(t('eff.manannFactor', { delta: `${delta >= 0 ? '+' : ''}${delta}`, factor: label ?? e.factorId }));
        return;
      }
      if (e.delta) {
        const rolled = e.delta.sign * (e.delta.flat + (e.delta.d10 > 0 ? rollDice(e.delta.d10, 10, battleRng()) : 0));
        env.set({ vessel: { ...vessel, manann: addManann(mood, rolled) } });
        env.log(t('eff.manannRolled', { delta: `${rolled >= 0 ? '+' : ''}${rolled}` }));
      }
    },
    refs: (e) => (e.factorId && !findManannFactor(e.factorId)) ? [{ level: 'error', message: `Effet → facteur Manann inexistant « ${e.factorId} »` }] : [],
  },
  adjustVessel: {
    group: 'Navigation', label: 'Ajuster le navire de campagne (#233)', icon: 'travel/anchor',
    make: () => ({ type: 'adjustVessel' }),
    apply: (e, env) => {
      const vessel = env.get().vessel;
      if (!vessel) { env.log(t('eff.vesselNoVessel')); return; }
      const parts: string[] = [];
      const next: typeof vessel = { ...vessel };
      if (e.label?.trim()) { next.label = e.label.trim(); parts.push(t('eff.vesselName', { label: e.label.trim() })); }
      if (e.morale != null) { next.morale = { ...vessel.morale, score: e.morale }; parts.push(t('eff.vesselMorale', { n: e.morale })); }
      if (e.saboteurDR != null) { next.saboteurDR = clampSaboteurDR(e.saboteurDR); parts.push(t('eff.vesselSabotage', { n: next.saboteurDR })); }
      if (e.waterLitres != null) { next.waterLitres = Math.max(0, e.waterLitres); parts.push(t('eff.vesselWater', { n: next.waterLitres })); }
      if (e.provisions != null) { next.provisions = Math.max(0, e.provisions); parts.push(t('eff.vesselProvisions', { n: next.provisions })); }
      if (e.crew && e.crew.length) { next.crew = e.crew.filter((h) => h.roleId && h.count > 0); parts.push(t('eff.vesselCrew', { n: next.crew.reduce((s, h) => s + h.count, 0) })); }
      // Blessures de coque : valeur ABSOLUE d'auteur → seam `setVesselHull` (#308, pas d'écriture directe
      // de `vessel.wounds` — resynchronise aussi la copie de travail `travelPlan.vehicle` si active).
      const hullMax = e.hullMax ?? vessel.wounds?.max ?? env.get().travelPlan?.vehicle?.wounds.max;
      const hasHullWrite = hullMax != null && (e.hullMax != null || e.hullCurrent != null);
      const hullCurrent = hasHullWrite ? (e.hullCurrent ?? hullMax) : undefined;
      if (hasHullWrite) parts.push(t('eff.vesselHull', { cur: Math.max(0, Math.min(hullCurrent!, hullMax!)), max: hullMax! }));
      if (!parts.length) { env.log(t('eff.vesselNoField')); return; }
      env.set({ vessel: next });
      if (hasHullWrite) setVesselHull(env.get, env.set, hullCurrent!, hullMax!);
      env.log(t('eff.vesselDone', { parts: parts.join(', ') }));
    },
    refs: () => [],
  },

  // ── Combat & social ────────────────────────────────────────────────────
  startCombat: {
    group: 'Combat & social', label: 'Démarrer un combat', icon: 'action/attack',
    make: () => ({ type: 'startCombat', encounter: '' }),
    apply: (e, env) => { env.get().startCombat(e.encounter); },
    refs: (e, ctx) => ctx.encounterIds.has(e.encounter) ? [] : [{ level: 'error', message: `Effet → rencontre inexistante « ${e.encounter} »` }],
  },
  startPursuit: {
    group: 'Combat & social', label: 'Poursuite terrestre (LDB 15)', icon: 'travel/foot',
    make: () => ({ type: 'startPursuit', partyRole: 'fleeing', distance: 4, skill: { id: 'athletisme' }, foes: [{ ref: { creatureId: '' } }], encounter: '' }),
    apply: (e, env) => { startGroundPursuit(env.get, env.set, { partyRole: e.partyRole, distance: e.distance, escapeAt: e.escapeAt, skill: e.skill.id, foes: e.foes, encounter: e.encounter || undefined, policy: e.policy }); },
    refs: (e, ctx) => {
      const issues: EffectRefIssue[] = [];
      if (!e.foes?.length) issues.push({ level: 'error', message: 'Poursuite : aucun adversaire' });
      // Chaque adversaire est une RÉFÉRENCE : c'est sur la fiche que se lisent son Mouvement et sa
      // valeur de Test — une référence cassée n'a aucune stat à offrir.
      for (const f of e.foes ?? []) {
        if ('creatureId' in f.ref && !findCreatureById(f.ref.creatureId)) {
          issues.push({ level: 'error', message: `Poursuite → créature inexistante « ${f.ref.creatureId || '(aucune)'} »` });
        }
      }
      if (e.encounter && !ctx.encounterIds.has(e.encounter)) issues.push({ level: 'error', message: `Poursuite → rencontre inexistante « ${e.encounter} »` });
      return issues;
    },
  },
  startMassBattle: {
    group: 'Combat & social', label: 'Combat de masse (Puissance de Bataille)', icon: 'map-tool/start-flag',
    make: () => ({ type: 'startMassBattle', battle: { allyName: 'Armée des Personnages', enemyName: 'Armée ennemie', allyMight: 50, enemyMight: 50, plannedRounds: 3 } }),
    apply: (e, env) => { env.get().startMassBattle(e.battle); }, // ouvre l'écran de bataille sur le spec authoré (ADE II 08)
    // Les rencontres mappées aux Scènes de combat/menace doivent exister dans la scène courante.
    refs: (e, ctx) => Object.entries(e.battle.sceneEncounters ?? {}).flatMap(([sceneId, encId]) =>
      ctx.encounterIds.has(encId) ? [] : [{ level: 'error' as const, message: `Combat de masse → rencontre inexistante « ${encId} » (Scène ${sceneId})` }]),
  },
  openMerchant: {
    group: 'Combat & social', label: 'Ouvrir une boutique (marchand)', icon: 'merchant/cart',
    make: () => ({ type: 'openMerchant', entityId: '' }),
    apply: (e, env) => { env.get().openMerchant(e.entityId); }, // ouvre la boutique de l'entité (Marchand inclus dans un dialogue, #2)
  },
  openPort: {
    group: 'Navigation', label: 'Ouvrir un port (MDG 15 — relâche à terre)', icon: 'travel/anchor',
    make: () => ({ type: 'openPort', placeId: '' }),
    apply: (e, env) => {
      // SOURCE UNIQUE avec l'accostage en mer (`finishSeaDay`) : `openPortAt` (state/seaVoyageFlow).
      const wm = env.get().worldMap;
      const place = wm ? placeById(wm, e.placeId) : undefined;
      if (!place) return;
      openPortAt(env.get, env.set, place);
    },
    refs: (e) => (e.placeId ? [] : [{ level: 'error', message: 'Effet → Ouvrir un port : lieu manquant' }]),
  },
  openTavernGames: {
    group: 'Combat & social', label: 'Jeux de taverne (NADJ 16)', icon: 'nav/dice',
    make: () => ({ type: 'openTavernGames' }),
    // Option facultative : sans effet si éteinte (comme interlude). Le PROPOSEUR est celui qui PARLE
    // (`state.dialogue.speakerId`, posé par l'interaction ou `startDialogue`) quand son entité offre
    // une partie (`SceneEntity.tavernGame`) : la table s'ouvre alors sur SON offre. Aucun PNJ n'est
    // nommé ici — tout proposeur en hérite, et une ouverture hors dialogue reste générique.
    apply: (_e, env) => {
      if (!rule('tavern-games')) return;
      const parle = env.get().dialogue?.speakerId;
      const propose = parle && tavernNpcOffers(env.get().scene).some((o) => o.id === parle);
      env.get().openTavernGames(propose ? parle : undefined);
    },
  },
  medicalAid: {
    group: 'Combat & social', label: 'Acte de soin payant (PNJ médecin/guérisseur)', icon: 'medical/aid',
    // tarif par défaut : « aide médicale 4-6 pistoles » (LDB 75) → 5 pa
    make: () => ({ type: 'medicalAid', acts: [{ act: 'wounds', cost: { silver: 5 } }], entityId: '' }),
    apply: (e, env) => { openMedicalAidEffect(env.get, env.set, e); }, // soins payants d'un PNJ : ouvre son infirmerie (actes tarifés)
    // Le soigneur PORTE ses stats : sans entité résolvable, l'infirmerie n'a ni nom ni fiche à lire —
    // et sans la Compétence Guérison sur cette fiche, l'acte n'a aucune valeur à jouer (LDB 09 l.30).
    refs: (e, ctx) => {
      if (!ctx.entityIds.has(e.entityId)) return [{ level: 'error', message: `Soins payants → PNJ soigneur inexistant « ${e.entityId || '(aucun)'} »` }];
      const npc = ctx.npcSheet(e.entityId);
      if (!npc) return [{ level: 'error', message: `Soins payants → le PNJ « ${e.entityId} » n'a aucune fiche (ni réf de bestiaire, ni profil, ni preset)` }];
      return hasHealSkill(npc) ? [] : [{ level: 'error', message: `Soins payants → le PNJ « ${e.entityId} » ne possède pas la Compétence Guérison` }];
    },
  },
  castSpell: {
    group: 'Combat & social', label: 'Incanter un sort/prière (scripté, #98)', icon: 'magic/power',
    make: () => ({ type: 'castSpell', casterId: '', spellId: '', mode: 'jet' }),
    apply: (e, env) => {
      const { get, set } = env;
      const caster = actorIn(get(), e.casterId);
      if (!caster) { env.log(t('eff.castCasterMissing', { id: e.casterId })); return; }
      const spell = findSpellById(e.spellId);
      if (!spell) { env.log(t('eff.castSpellMissing', { id: e.spellId })); return; }
      const target = (e.targetId ? actorIn(get(), e.targetId) : undefined) ?? caster;
      if (e.mode === 'forceSuccess') {
        // Arbitrage D'AUTEUR explicite (rituel garanti) : le RAW ne prévoit aucun lancer scripté SANS jet —
        // applique directement les effets du sort (Critique/Imparfaite n'ont pas de sens hors d'un vrai jet).
        const ctx: OpsCtx = { rng: battleRng(), caster, label: spell.label, sl: spell.cn ?? 0, source: { kind: 'spell', id: spell.id } };
        for (const line of applyOps(target, spellOps(spell.effects, 'target'), ctx)) env.log(line);
        for (const line of applyOps(caster, spellOps(spell.effects, 'caster'), ctx)) env.log(line);
        env.log(`${caster.label} incante ${spell.label} (rituel garanti).`);
        return;
      }
      if (get().battle) {
        // EN COMBAT : flux d'incantation STANDARD (jet influençable si piloté par un humain, cadence-aware,
        // même chemin que l'IA) — exécuteur enregistré par `combatFlow` (module FEUILLE, anti-cycle).
        castSpellRunner?.(get, set, caster, target, spell.id);
        return;
      }
      // HORS COMBAT (couture D) : seul un héros du GROUPE a un flux d'incantation jouable (`oocCastSpell`,
      // jet réel par modale) — un PNJ hors combat n'a pas de Combatant à faire incanter (`actorIn` ne
      // l'a alors résolu que depuis `party`), pas de pseudo-combat inventé pour ce cas.
      get().oocCastSpell(caster.id, spell.id, target.id);
    },
    refs: (e) => {
      const issues: EffectRefIssue[] = [];
      if (!e.casterId) issues.push({ level: 'error', message: 'Effet Incanter : lanceur manquant' });
      if (!e.spellId || !findSpellById(e.spellId)) issues.push({ level: 'error', message: `Effet Incanter : sort inexistant « ${e.spellId} »` });
      return issues;
    },
  },

  // ── Tests ──────────────────────────────────────────────────────────────
  extendedTest: {
    group: 'Tests', label: 'Test Étendu (DR cumulé : crocheter/forcer un mécanisme)', icon: 'ui/key',
    make: () => ({ type: 'extendedTest', skill: { id: 'crochetage' }, difficulty: 'intermediaire', label: 'Crocheter la serrure', targetDR: 5, flag: '', stake: flowStakeRef('extendedTest', 'roll') }),
    apply: (e, env) => {
      // Test ÉTENDU (LDB 12 l.187-200) : le meilleur du groupe enchaîne les Rounds, SOUTENU par les autres
      // membres capables (+10 chacun, plafond Bonus de Carac — `partyAssisted`). Adjacence (l.196) : même
      // pool `battle.combatants` (héros positionnés) que `openSkillTest` quand un combat est en cours.
      const battle = env.get().battle;
      const pool = battle?.combatants.filter((c) => c.kind === 'hero') ?? env.get().party;
      const leader = partyBest(pool, e.skill?.id, e.characteristic, undefined, e.skill?.spec)?.actor;
      const eligible = battle && leader?.pos ? (c: Combatant) => !!c.pos && combatDistance(leader, c) <= 1 : undefined;
      const best = leader ? partyAssisted(pool, e.skill?.id, e.characteristic, undefined, e.skill?.spec, eligible) : null;
      if (!best) return;
      const difficulty = e.difficulty ?? 'intermediaire';
      // Cible montée par le MONTEUR CANONIQUE : la valeur SOUTENUE de `partyAssisted` se déclare avec
      // son Soutien, l'écrêtage est celui de `rollTest` (`clampTarget`), plus une borne recopiée ici.
      const { target } = rollStep({
        actor: best.actor, test: { skill: e.skill?.id, char: e.characteristic, spec: e.skill?.spec },
        difficulty, valeur: best.value, soutien: best.support,
      });
      env.get().startExtendedTest({ actorId: best.actor.id, label: e.label, skillLabel: e.skill ? refLabel('skills', e.skill) : (e.characteristic ?? 'Test'), target, targetDR: e.targetDR, flag: e.flag, stake: e.stake ?? flowStakeRef('extendedTest', 'roll'), ...(best.support.count > 0 ? { support: best.support } : {}) });
      return 'suspend';
    },
  },
  forceDoor: {
    group: 'Tests', label: 'Enfoncer une porte à plusieurs (objet BE/B)', icon: 'action/force',
    make: () => ({ type: 'forceDoor', label: 'Porte', doorBE: 3, doorB: 10, flag: '' }),
    apply: (e, env) => {
      // Enfoncer une PORTE/objet à plusieurs (EDO Append. 2) : tout le groupe vivant frappe.
      const heroes = env.get().party.filter((h) => !h.dead).map((h) => h.id);
      if (!heroes.length) return;
      env.get().startForceDoor({ label: e.label, doorBE: e.doorBE, doorB: e.doorB, heroIds: heroes, flag: e.flag });
      return 'suspend';
    },
  },
};

/** Étape de cascade `waterExposure` (MSRC 16 p.91) : Test raté → d100 « avec un modificateur de +10
 *  pour chaque DR négatif » → maladie CONTRACTÉE directement (`applyContraction`, incubation normale —
 *  le Test d'exposition EST le test, jamais un second Test de Contraction). « Relancez si le Personnage
 *  n'est pas blessé » honoré par `drawWaterDisease`. Déjà porteur → rien de neuf (dédoublonnée). */
registerCascadeApplier('waterExposure', (_get, _set, step, hero) => {
  if (!hero || !step.result) return;
  if (step.result.success) return { consequences: freeCons([t('eff.waterSafe', { name: hero.label })]) };
  const draw = drawWaterDisease(Math.max(0, -step.result.sl), isWounded(hero), battleRng());
  const lines = applyContraction(hero, draw.disease, false, battleRng());
  const rollTxt = draw.modified !== draw.roll ? `${draw.roll} (+${draw.modified - draw.roll} → ${draw.modified})` : String(draw.roll);
  return {
    consequences: freeCons([
      t('eff.waterDraw', { roll: rollTxt, disease: diseaseLabel(draw.disease) }),
      ...(lines.length ? lines : [t('eff.waterAlready', { name: hero.label })]),
    ]),
  };
});

/**
 * Applique une liste d'Effets via le REGISTRE `EFFECT_HANDLERS` (1 effet = 1 handler). Un handler qui
 * renvoie `'suspend'` (extendedTest/forceDoor → modale/pending) STOPPE la boucle, comme l'ancien
 * `return` au milieu du switch — l'ORDRE, les journaux et les révélations restent identiques.
 */
export function applyEffects(get: Get, set: SetFn, effects: Effect[], sl?: number) {
  const env = makeEffectEnv(get, set, sl);
  for (const e of effects) {
    const handler = EFFECT_HANDLERS[e.type] as EffectHandler;
    if (handler.apply(e, env) === 'suspend') break;
  }
  // Couture UNIQUE du cadre de campagne (#717) : la CLÔTURE authorée est une `Condition` — elle se
  // relit après CHAQUE lot d'effets, jamais par un branchement dans `setFlag` (un `when` peut porter
  // sur l'horloge, la bourse, le groupe autant que sur un drapeau).
  armChapterRecapIfDue(get, set);
}

/**
 * Soins PAYANTS d'un PNJ (Effet `medicalAid`, LDB 75) : ouvre l'INFIRMERIE (state/medicFlow) avec
 * la compétence du PNJ et ses actes tarifés — le débit a lieu à l'acte, dans la modale. Le joueur
 * choisit les patients ; le PNJ effectue les jets (la Chance interroge `actorIn(healerId)` →
 * introuvable pour un PNJ → boutons inertes).
 */
function openMedicalAidEffect(get: Get, set: SetFn, e: { acts?: { act: HealMode; cost?: { gold?: number; silver?: number; brass?: number } }[]; entityId: string }): void {
  const acts = e.acts ?? [];
  if (!acts.length) return;
  // LE soigneur est une entité de la scène, et sa FICHE est la source unique de ce qu'il vaut : sa
  // valeur de Guérison et son Bonus d'Intelligence s'y LISENT. Sans fiche, ou sans la Compétence
  // Avancée Guérison sur cette fiche (LDB 09 l.30), aucune infirmerie ne s'ouvre — et le refus se DIT.
  const npc = sceneNpc(get().scene, e.entityId);
  if (!npc) { get().log(t('eff.medicNoNpc', { id: e.entityId || '(aucun)' })); return; }
  if (!hasHealSkill(npc)) { get().log(t('eff.medicNoHealSkill', { name: npc.label })); return; }
  openMedic(get, set, {
    npc: {
      id: e.entityId,
      label: npc.label,
      skill: { id: HEAL_SKILL, value: testValue(npc, HEAL_SKILL) },
      intBonus: bonus(effectiveChar(npc, 'intelligence')),
      acts,
    },
  });
}
