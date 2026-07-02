import type { GameState, RevealEntry } from './store';
import type { Get, Set as SetFn } from './flowTypes';
import type { LootGear, CascadeStep } from './pendings';
import { Combatant, DIFFICULTY_MODIFIERS, CHAR_LABELS } from '../engine/types';
import { battleRng } from './battleRng';
import { d10, defaultRNG, type RNG } from '../engine/dice';
import { applyOps, type OpsCtx } from '../engine/ops';
import { rule } from '../engine/policy';
import { gainCorruption, corruptionTarget } from './corruptionFlow';
import { eligibleTalent } from '../engine/grimoire';
import { effectiveChar } from '../engine/characteristics';
import { buildActorView } from './combat/flowEval';
import { partyBest, partyAssisted, soutienBonus, isSocialTest, socialPsychMod, socialPsychLabel, testValue, actorHasSkill } from '../engine/skills';
import { statusCharmMod, statusCharmLabel, actorStatus } from '../engine/social';
import { parseStatus } from '../engine/creation';
import { easeDifficulty } from '../engine/tests';
import { restoreFortune } from '../engine/fortune';
import { hasTalent } from '../engine/magic';
import { recomputeLoadout, itemFromGive, giveTrappingLabel } from '../engine/items';
import { findCreatureById, refLabel } from '../data';
import { harvestSizeOf, harvestYield } from '../engine/harvest';
import { applySummon } from './summonFlow';
import { contractDisease, DISEASE_DEFS } from '../engine/disease';
import { type HealMode } from '../engine/healing';
import { openMedic } from './medicFlow';
import { openRest, placesOfKind } from './restFlow';
import { permanentAmputations } from '../engine/critical';
import { traumaById, dechirureFractureFicheId } from '../engine/trauma';
import { DAY_PHASES, minutesUntilNext } from '../engine/clock';
import { TIME_COST } from '../engine/timeCost';
import { feedFromMeal } from '../engine/provisions';
import { findSpellById } from '../data/index';
import { toBrass, fromBrass } from '../engine/money';
import { Effect, setDoorOpen } from './scene';
import { type Flow, type FlowTest, flowFromEffects, flowEffects, testFlow, evalCondition, conditionCtx, EMPTY_FLOW } from './flow';
import { inRect, combatantsWithinRadius } from './combatGeometry';
import { startCascade } from './cascade';
import { loseWounds, addCondition, hasCondition } from '../engine/conditions';
import { touchActors } from './combatOrParty';
import { ev } from './combatLog';
import { t } from '../i18n';

/**
 * Effets de scène/campagne (`Effect[]`) appliqués par le store : le grand `applyEffects`
 * (setFlag/journal/dons/transitions/tests/soins…) + la brique de butin ATTRIBUABLE
 * (`gearFromEffects`/`applyEffectsLoot`/`assignGearAt`), les déclencheurs de zone
 * (`checkTriggers`) et la file de révélations témoins (`pushReveal`). Extrait de combatFlow
 * (baril : ré-exporté par `./combatFlow`). Module FEUILLE — n'importe RIEN de combatFlow.
 */
/** Conséquences d'ATTAQUE rapatriées INLINE dans la séquence (au lieu d'une RevealModal séparée) :
 *  Coup Critique (panneau riche), Assommante, Coup dans le dos. Les autres révélations (fin de Round,
 *  mutation, Calme, effet d'auteur) restent en file témoin. */
const COMBAT_SEQ_KINDS: ReadonlySet<RevealEntry['kind']> = new Set(['critical', 'assommante', 'backstab']);
const SEQ_ICON: Partial<Record<RevealEntry['kind'], string>> = { critical: '💥', assommante: '🌟', backstab: '🗡️' };

/** Une révélation de conséquence d'attaque → étape d'AFFICHAGE de la séquence. Le Critique garde son
 *  panneau DÉTAILLÉ via la charge riche `reveal` ; les autres montrent leurs lignes. `actorId` = le
 *  CONCERNÉ (victime → propriétaire de la modale en coop). */
function revealToStep(entry: RevealEntry, index: number): CascadeStep {
  const isCrit = entry.kind === 'critical';
  return {
    id: `cons-${entry.kind}-${index}`,
    kind: entry.kind,
    actorId: entry.subjectId,
    icon: SEQ_ICON[entry.kind] ?? '⚔️',
    label: entry.title,
    outcome: entry.lines,
    reveal: isCrit ? entry : undefined,
    interactive: true,
  };
}

/** Empile une révélation : conséquence d'attaque → étape INLINE de la séquence de combat (append à
 *  celle en cours, sinon démarre) ; sinon → file de révélation témoin FIFO. */
export function pushReveal(set: SetFn, entry: RevealEntry): void {
  if (COMBAT_SEQ_KINDS.has(entry.kind)) {
    set((s: GameState) => {
      const c = s.pendingCascade;
      const active = c && c.purpose === 'combat' && c.cursor < c.participants.length ? c : null;
      const step = revealToStep(entry, active ? active.participants.length : 0);
      return active
        ? { pendingCascade: { ...active, participants: [...active.participants, step] } }
        : { pendingCascade: { title: 'Conséquences', icon: '⚔️', purpose: 'combat', cursor: 0, log: [], participants: [step] } };
    });
    return;
  }
  set((s: GameState) => ({ pendingReveals: [...s.pendingReveals, entry] }));
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

/** Pousse une ÉTAPE de séquence de combat déjà formée (ex. choix de déviation foldé, P3a) : append à
 *  la séquence `purpose:'combat'` en cours, sinon en démarre une. Même placement que les conséquences.
 *  Quand l'étape OUVRE la cascade (aucune en cours), elle PRÊTE son `label`/`icon` au titre de la
 *  fenêtre (« Surprise », « Imparfaite »…) — la situation qui l'a ouverte est le titre juste ; repli
 *  générique « Conséquences » si l'étape n'en porte pas. */
export function pushCombatStep(set: SetFn, step: CascadeStep): void {
  set((s: GameState) => {
    const c = s.pendingCascade;
    const active = c && c.purpose === 'combat' && c.cursor < c.participants.length ? c : null;
    return active
      ? { pendingCascade: { ...active, participants: [...active.participants, step] } }
      : { pendingCascade: { title: step.label ?? 'Conséquences', icon: step.icon ?? '⚔️', purpose: 'combat', cursor: 0, log: [], participants: [step] } };
  });
}

// occupied / pushBackTiles / findFreeTile / displaceSmaller / removeEntity → combatGeometry.ts

/** Items ramassables d'un prop interactif : un par feuille `do` « donneuse » de son `interact.flow`.
 *  `key` = `eff:<index dans flowEffects(interact.flow)>`. Effets non-objet & branches (test) ignorés. */
export function entityPickables(ent: { interact?: { flow: Flow } }): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  (ent.interact ? flowEffects(ent.interact.flow) : []).forEach((e, i) => {
    if (e.type === 'giveTrapping') out.push({ key: `eff:${i}`, label: giveTrappingLabel(e) });
    else if (e.type === 'giveMoney') out.push({ key: `eff:${i}`, label: 'Argent' });
  });
  return out;
}

export function checkTriggers(get: Get, set: SetFn) {
  const { scene, partyPos, flags } = get();
  if (!scene) return;
  for (const t of scene.triggers) {
    if (flags[`__trigger_${t.id}`]) continue;
    if (!inRect(partyPos, t.rect)) continue;
    if (t.when && !evalCondition(t.when, conditionCtx(get()))) continue;
    if (t.once) flags[`__trigger_${t.id}`] = true;
    set({ flags: { ...flags } });
    runFlow(get, set, t.flow, 'Découverte');
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
    if (e.type === 'giveTrapping' && !e.heroId) gear.push({ label: giveTrappingLabel(e), magic: !!e.qualities?.length || e.identified === false, effect: e });
    else rest.push(e);
  }
  return { gear, rest };
}

/** applyEffects + fenêtre de loot : hors combat, l'équipement trouvé (giveTrapping sans heroId)
 *  devient ATTRIBUABLE dans `pendingLoot` au lieu d'aller en silence au 1er héros ; l'argent
 *  s'applique à la bourse ET s'affiche ; les textes `journal` du lot deviennent le texte
 *  d'ambiance de la fenêtre. Sans butin (ou en combat : Ramasser/victoire ont leurs flux),
 *  strictement équivalent à applyEffects. Fenêtre déjà ouverte → le butin s'y AJOUTE. */
export function applyEffectsLoot(get: Get, set: SetFn, effects: Effect[], title: string) {
  if (get().battle) { applyEffects(get, set, effects); return; }
  const { gear, rest } = gearFromEffects(effects);
  applyEffects(get, set, rest);
  const found = effects
    .filter((e): e is Extract<Effect, { type: 'giveMoney' }> => e.type === 'giveMoney')
    .reduce((m, e) => m + toBrass({ gold: e.gold ?? 0, silver: e.silver ?? 0, brass: e.brass ?? 0 }), 0);
  if (!gear.length && found <= 0) return; // dépense (giveMoney négatif) ou simple récit : pas de fenêtre
  const messages = effects.filter((e): e is Extract<Effect, { type: 'journal' }> => e.type === 'journal').map((e) => e.text);
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
  const part = (enc: number) => `Pièces de ${name} (${enc} Enc)`; // objet CUSTOM (hors catalogue)
  if (pv) set({ pendingVictory: { ...pv, harvested: [...(pv.harvested ?? []), creatureId] } }); // grise le bouton
  runFlow(get, set, testFlow(
    { skill: 'Savoir (Bêtes)', difficulty: 'intermediaire', label: `Récolter — ${name}` },
    flowFromEffects([{ type: 'giveTrapping', custom: part(full.enc), price: full.total }]),
    flowFromEffects([{ type: 'giveTrapping', custom: part(lo.enc), price: lo.total }]),
  ), `Récolter — ${name}`);
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
    if (s.flow) runFlow(get, set, s.flow, 'Événement');
  }
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
export function openSkillTest(get: Get, set: SetFn, spec: FlowTest, onSuccess: Flow, onFailure: Flow, after: Flow, opts?: { actorId?: string }): boolean {
  // Modulateurs sociaux PAR ACTEUR (un Test social vs un interlocuteur) : malus psy Animosité/Préjugé
  // (LDB 21) + mod de Statut Échelon/Standing (LDB 08). Le Statut compare l'acteur à la cible `vsStatus`.
  const isSocial = isSocialTest(spec.skill, spec.characteristic);
  const tgtStatus = isSocial && spec.vsStatus ? parseStatus(spec.vsStatus) : undefined;
  const psychMod = spec.vsGroups?.length && isSocial ? (c: Combatant) => socialPsychMod(c, spec.vsGroups!) : undefined;
  // 1d10 « réaction au Statut » (option, LDB 08 l.54/90) tiré UNE fois par Test (RNG seedé) — appliqué à
  // tous les candidats de façon cohérente (la réaction de l'interlocuteur ne dépend pas du héros choisi).
  const reactionRoll = tgtStatus && rule('social-status-reaction-roll') ? battleRng().int(1, 10) : undefined;
  const statusMod = tgtStatus ? (c: Combatant) => statusCharmMod(actorStatus(c), tgtStatus, { begging: spec.begging, reactionRoll }) : undefined;
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
  // `opts.actorId` RESTREINT le Test à UN acteur précis (ex. le Personnage qui prend l'Action « Diriger
  //  l'équipe » — le porteur du Talent, pas le meilleur du groupe) ; sinon le meilleur PJ (partyBest).
  const restrictId = opts?.actorId;
  const best = restrictId
    ? (() => { const a = get().party.find((c) => c.id === restrictId && !c.dead); return a ? { actor: a } : null; })()
    : partyBest(get().party, spec.skill, spec.characteristic, socialMod, spec.spec);
  if (!best) return false;
  const baseDifficulty = spec.difficulty ?? 'intermediaire';
  const eased = !!spec.easierIf && get().party.some((c) => !c.dead && (
    (!!spec.easierIf!.hasSkill && actorHasSkill(c, spec.easierIf!.hasSkill.id, spec.easierIf!.hasSkill.spec)) ||
    (!!spec.easierIf!.hasTalent && hasTalent(c, spec.easierIf!.hasTalent))
  ));
  const difficulty = eased ? easeDifficulty(baseDifficulty, spec.easierIf!.steps ?? 1) : baseDifficulty;
  const living = get().party.filter((c) => !c.dead && (!restrictId || c.id === restrictId));
  const candidates = living.map((actor) => {
    // Soutien (LDB 12 l.214-225) : si CET acteur mène, les AUTRES membres capables l'assistent (+10, plafond
    // Bonus de Carac). Calculé par candidat car le sélecteur laisse le joueur choisir qui lance.
    const sout = soutienBonus(living, actor, spec.skill, spec.characteristic, spec.spec);
    const value = testValue(actor, spec.skill, spec.characteristic, spec.spec) + (socialMod ? socialMod(actor) : 0) + sout;
    // Objet catalogué → match par `trappingId` stable ; objet CUSTOM (sans trappingId) → repli nom.
    const tool = spec.tool ? actor.items?.find((i) => (i.trappingId === spec.tool || i.name === spec.tool) && !i.destroyed) : undefined;
    return {
      id: actor.id, name: actor.name, value,
      target: Math.max(1, Math.min(99, value + DIFFICULTY_MODIFIERS[difficulty])),
      psychMod: (socialMod ? socialMod(actor) : 0) || undefined,
      psychDetail: socialDetail(actor),
      itemUid: tool?.uid,
    };
  });
  const def = candidates.find((c) => c.id === best.actor.id) ?? candidates[0];
  if (!def) return false;
  // Compétence/Caractéristique RÉELLE (cadre de jet) ≠ intitulé de situation (titre). Char → libellé long.
  const skill = spec.skill ? refLabel('skills', { id: spec.skill, spec: spec.spec }) : (spec.characteristic ? CHAR_LABELS[spec.characteristic] : undefined);
  const label = spec.label || skill || 'Test';
  set({
    pendingTest: {
      actorId: def.id, actorName: def.name, label, skill, skillValue: def.value, difficulty,
      skillId: spec.skill, spec: spec.spec, char: spec.characteristic, // réf structurée pour talentTestSLBonus (LDB 10)
      requireSL: spec.requireSL ?? 0, target: def.target, psychMod: def.psychMod, psychDetail: def.psychDetail,
      itemUid: def.itemUid, isDouble: false, roll: null, success: false, sl: 0,
      onSuccess, onFailure, after,
      candidates: candidates.length > 1 ? candidates : undefined,
    },
  });
  // « Une situation = une modale » : le Test EST une cascade à une étape `jet:'test'`, rendue par
  // `CascadeModal` (via `useTestJetProps`). `pendingTest` coexiste comme porteur de données (comme
  // `pendingAttack` pour l'attaque) ; `resolveTest` ferme les deux. Pas d'applier : la conséquence
  // (branche onSuccess/onFailure + continuation) est lancée par `resolveTest`.
  startCascade(get, set, { title: label, icon: '🎲', purpose: 'test', steps: [{ id: 'test-jet', kind: 'sceneTestJet', jet: 'test', actorId: def.id }] });
  return true;
}

/**
 * Exécute un Flow (logique authorée : séquence/branches/Test) — SOURCE UNIQUE. `do` accumule les
 * Effets et les applique en lot (butin attribuable via `applyEffectsLoot`) ; `if` vide d'abord le lot
 * (la condition lit l'état VIVANT — flags/horloge — donc après les Effets émis) puis branche ; `test`
 * vide le lot, ouvre la modale et SUSPEND — la branche choisie + la continuation (reste de la pile)
 * sont reprises par `resolveTest`. Pas de boucle → terminaison garantie.
 */
export function runFlow(get: Get, set: SetFn, flow: Flow, label = 'Effet'): void {
  const stack: Flow[] = [flow];
  const batch: Effect[] = [];
  const flush = () => { if (batch.length) applyEffectsLoot(get, set, batch.splice(0), label); };
  while (stack.length) {
    const node = stack.shift()!;
    switch (node.kind) {
      case 'do':
        batch.push(node.effect);
        break;
      case 'seq': stack.unshift(...node.steps); break;
      case 'if': {
        flush();
        const branch = evalCondition(node.cond, conditionCtx(get())) ? node.then : node.else;
        if (branch) stack.unshift(branch);
        break;
      }
      case 'test': {
        flush();
        const after: Flow = { kind: 'seq', steps: stack.splice(0) };
        // Personne ne peut tenter → on saute le Test et on reprend directement la continuation.
        if (!openSkillTest(get, set, node.test, node.success, node.fail, after)) runFlow(get, set, after, label);
        return;
      }
    }
  }
  flush();
}

/**
 * Exécute un Flow EN COMBAT contre une CIBLE (et le lanceur/porteur pour les feuilles `on:'caster'`) en
 * accumulant son journal dans un `string[]` RENDU — variante PURE de `runCombatFlow` pour les sites qui
 * tissent ces lignes INLINE dans leur propre journal à une position précise (effets de manœuvre, traits/
 * atouts onHit, branches de Test), sans `get`/`set`. Couvre `seq`/`do`/`if` (Condition `compare` lue sur
 * `target`/`caster` + `sl`/`location`/`woundsDealt`/`attackKind` du contexte d'incantation).
 *
 * GARDE-FOU anti-jet-silencieux (calque `flattenFlow:280`) : un nœud `test` LÈVE — un Test EN COMBAT est
 * interactif/cadence-aware (étape de cascade ou jet inline avec branche honorée), résolu par
 * `resolveFlowTest`/`runCombatFlow`, JAMAIS en avalant la branche succès. Les sites de ce module sont
 * PROUVÉS sans nœud `test` au 1ᵉʳ niveau (un trigger `test` top-level est routé en amont par `testRouter`,
 * une branche de Test n'en contient pas) ; si un `test` enfoui apparaît un jour (Lot 4), l'erreur le rend
 * détectable au lieu de redevenir un jet silencieux. */
export function runSpellFlowLines(target: Combatant, caster: Combatant | undefined, flow: Flow, ctx: OpsCtx): string[] {
  const lines: string[] = [];
  const walk = (f: Flow): void => {
    switch (f.kind) {
      case 'seq': f.steps.forEach(walk); break;
      case 'do':
        if (f.effect.type === 'ops') {
          const unit = f.effect.on === 'caster' ? caster : target;
          if (unit) lines.push(...applyOps(unit, f.effect.ops, ctx));
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
        throw new Error('runSpellFlowLines: un nœud `test` est cadence-aware — utiliser runCombatFlow/resolveFlowTest.');
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

function makeEffectEnv(get: Get, set: SetFn): EffectEnv {
  return {
    get,
    set,
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
  /** Effet par défaut posé quand l'auteur ajoute ce type (ex-`newEffect`). */
  make(): T;
  /** Conséquence appliquée par `applyEffects`. `'suspend'` = stoppe la boucle (modale/pending ouvert). */
  apply(e: T, env: EffectEnv): EffectApplyResult;
  /** Réfs cassées / valeurs invalides (ex-`checkEffect`). Absent = rien à valider. */
  refs?(e: T, ctx: EffectRefCtx): EffectRefIssue[];
}

/** Noms des maladies câblées (LDB 20) — défaut de la fabrique `inflictDisease.make`. */
const DISEASE_NAMES = Object.keys(DISEASE_DEFS);

/** Ordre des groupes d'intention dans le picker « + Effet » (l'ordre des handlers ci-dessous donne
 *  l'ordre INTRA-groupe — la déclaration suit l'ancien `EFFECT_GROUPS` aplati). */
export const EFFECT_GROUP_ORDER = [
  '📜 Narration',
  '🎁 Récompenses',
  '☠️ Afflictions',
  '🕰 Temps & repos',
  '🚪 Navigation',
  '⚔️ Combat & social',
  '🎲 Tests',
] as const;

/** Mappe chaque `type` d'Effet à son handler narrowé — garantit l'EXHAUSTIVITÉ (tsc échoue si un type
 *  manque) ET le typage par variante de `apply`/`make`/`refs`. */
type EffectHandlerMap = {
  [K in Effect['type']]: EffectHandler<Extract<Effect, { type: K }>>;
};

/**
 * Chute (LDB 15 l.117-122) appliquée à UN combattant : 3 Dégâts/mètre + 1d10, réduits par le Bonus
 * d'Endurance mais PAS par les PA ; si les Blessures subies dépassent le BE → État À Terre. MUTE `c`.
 * Brique PURE partagée par l'Effet `fall` (repositionnement de groupe) et l'effondrement d'une
 * passerelle en combat (`collapseStructure`) — zéro duplication de la formule.
 */
export function applyFall(c: Combatant, metres: number, rng: RNG): void {
  const m = Math.max(0, metres);
  const be = Math.floor(effectiveChar(c, 'E') / 10);
  const lost = Math.max(0, 3 * m + d10(rng) - be);
  loseWounds(c, lost);
  if (lost > be) addCondition(c, 'a-terre');
}

/**
 * REGISTRE des effets — source unique data-driven (fin du god-switch `applyEffects`). Déclaré dans
 * l'ordre du picker (groupes de `EFFECT_GROUP_ORDER`, ordre intra-groupe = ordre de déclaration).
 */
export const EFFECT_HANDLERS: EffectHandlerMap = {
  // ── 📜 Narration ──────────────────────────────────────────────────────────
  journal: {
    group: '📜 Narration', label: 'Journal', icon: '📜',
    make: () => ({ type: 'journal', text: '' }),
    apply: (e, env) => { env.log(e.text); },
  },
  document: {
    group: '📜 Narration', label: 'Document (handout)', icon: '📄',
    make: () => ({ type: 'document', title: '', text: '' }),
    apply: (e, env) => { env.set({ document: { title: e.title, text: e.text } }); },
  },
  startDialogue: {
    group: '📜 Narration', label: 'Ouvrir un dialogue', icon: '💬',
    make: () => ({ type: 'startDialogue', dialogue: '' }),
    apply: (e, env) => {
      const dlg = env.get().scene?.dialogues.find((d) => d.id === e.dialogue);
      if (dlg) env.set({ dialogue: { dialogue: dlg, nodeId: dlg.start } });
    },
    refs: (e, ctx) => ctx.dialogueIds.has(e.dialogue) ? [] : [{ level: 'error', message: `Effet → dialogue inexistant « ${e.dialogue} »` }],
  },
  endDialogue: {
    group: '📜 Narration', label: 'Fermer le dialogue', icon: '✖️',
    make: () => ({ type: 'endDialogue' }),
    apply: (_e, env) => {
      if (env.get().dialogue) env.get().advanceTime(TIME_COST.dialogue); // clôture d'une conversation ≈ dialogue min
      env.set({ dialogue: null });
    },
  },
  setFlag: {
    group: '📜 Narration', label: 'Définir un flag', icon: '🚩',
    make: () => ({ type: 'setFlag', flag: '', value: true }),
    apply: (e, env) => { env.set((s: GameState) => ({ flags: { ...s.flags, [e.flag]: e.value ?? true } })); },
  },
  setLight: {
    group: '📜 Narration', label: 'Lumière de scène (les lumières baissent / se rallument)', icon: '💡',
    make: () => ({ type: 'setLight', level: 0.3 }),
    apply: (e, env) => { env.set({ lightLevel: Math.max(0, Math.min(1, e.level)) }); }, // mise en scène (Lot L) : niveau borné [0,1]
  },
  setDoor: {
    group: '📜 Narration', label: 'Porte (ouvrir / fermer — bloque vue et passage)', icon: '🚪',
    make: () => ({ type: 'setDoor', x: 0, y: 0, side: 'N', open: true }),
    apply: (e, env) => { env.set((s: GameState) => (s.scene ? { scene: setDoorOpen(s.scene, e.x, e.y, e.side, e.z ?? 0, e.open) } : {})); },
  },

  // ── 🎁 Récompenses ────────────────────────────────────────────────────────
  giveTrapping: {
    group: '🎁 Récompenses', label: 'Donner un objet (équipement/potion/babiole — réel ou custom)', icon: '🎒',
    make: () => ({ type: 'giveTrapping', custom: '' }),
    apply: (e, env) => {
      // Objet de CATALOGUE (`trappingId`) sinon objet CUSTOM (`custom`, misc) — source unique itemFromGive.
      const it = itemFromGive(e);
      // Butin MAGIQUE (optionnel) : qualités ajoutées, objet non identifié (qualités masquées jusqu'à
      // Évaluation, #2), skin légendaire. Les qualités restent ACTIVES mécaniquement (registre).
      if (e.qualities?.length) it.qualities = [...it.qualities, ...e.qualities.map((id) => ({ id }))]; // e.qualities = ids (donnée de scène)
      if (e.identified === false) it.identified = false;
      if (e.skin) it.skin = e.skin;
      if (e.magicKnown) it.magicKnown = true; // aura détectée en fenêtre de loot → suit l'objet
      if (e.detectTried) it.detectTried = true;
      if (e.appraiseTriedDay != null) it.appraiseTriedDay = e.appraiseTriedDay;
      if (e.price) it.price = { gold: e.price.gold ?? 0, silver: e.price.silver ?? 0, brass: e.price.brass ?? 0 };
      const who = env.mutateHero(e.heroId, (h) => {
        const clone: Combatant = structuredClone(h);
        clone.items = [...(clone.items ?? []), it]; // arrive NON équipé
        recomputeLoadout(clone); // met à jour l'encombrement
        return clone;
      });
      env.log(t('eff.recover', { name: who?.name || t('eff.party'), item: it.name }));
    },
  },
  giveMoney: {
    group: '🎁 Récompenses', label: 'Donner/retirer de l’argent', icon: '🪙',
    make: () => ({ type: 'giveMoney', gold: 0, silver: 0, brass: 0 }),
    apply: (e, env) => {
      env.set((s: GameState) => ({
        money: {
          gold: s.money.gold + (e.gold ?? 0),
          silver: s.money.silver + (e.silver ?? 0),
          brass: s.money.brass + (e.brass ?? 0),
        },
      }));
      const parts = [e.gold && t('eff.coin.gold', { n: e.gold }), e.silver && t('eff.coin.silver', { n: e.silver }), e.brass && t('eff.coin.brass', { n: e.brass })].filter(Boolean); // noms canon FR (couronne/pistole/sou)
      if (parts.length) env.log(t('eff.purse', { sign: (e.gold ?? 0) < 0 || (e.silver ?? 0) < 0 ? '' : '+', parts: parts.join(' ') }));
    },
  },
  giveXp: {
    group: '🎁 Récompenses', label: 'Donner des PX (groupe)', icon: '✨',
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
    group: '🎁 Récompenses', label: 'Apprendre un sort (trouvaille, sans PX)', icon: '🪄',
    make: () => ({ type: 'learnSpell', spell: '', heroId: '' }),
    apply: (e, env) => {
      // Trouvaille de campagne : le sort est appris SANS PX (l'auteur l'octroie — le coût
      // en PX ne vaut que pour la mémorisation volontaire, LDB 46 l.44-47).
      const sp = findSpellById(e.spell);
      if (!sp) return;
      // `c.spells` = IDS de sort (résolus par findSpellById dans l'ActionBar/IA/grimoire) ; le libellé
      // ne sert qu'à l'affichage (log ci-dessous). Même convention que pregens/buySpell/Béni.
      const who = env.mutateHero(
        e.heroId,
        (h) => ((h.spells ?? []).includes(sp.id) ? h : { ...h, spells: [...(h.spells ?? []), sp.id] }),
        (party) => party.findIndex((h) => !!eligibleTalent(h, sp) && !(h.spells ?? []).includes(sp.id)),
      );
      if (who) env.log(t('eff.learnSpell', { name: who.name, spell: sp.label }));
    },
  },
  restoreFortune: {
    group: '🎁 Récompenses', label: 'Regagner la Chance (début de session, max = Destin)', icon: '🍀',
    make: () => ({ type: 'restoreFortune' }),
    apply: (_e, env) => {
      // Début de session (LDB 17 l.47) : Chance regagnée jusqu'au maximum = Destin actuel.
      env.set((s: GameState) => ({ party: restoreFortune(s.party) }));
      env.log(t('eff.restoreFortune'));
    },
  },

  // ── ☠️ Afflictions ────────────────────────────────────────────────────────
  ops: {
    group: '☠️ Afflictions', label: 'Effets mécaniques (Blessures / État / buffs… — vocabulaire des sorts)', icon: '✨',
    make: () => ({ type: 'ops', on: 'party', ops: [{ op: 'wounds', amount: 5 }] }),
    apply: (e, env) => {
      // EffectOp : applique les GameOps (vocabulaire mécanique des sorts) à la cible de SCÈNE
      // (`party`/`hero`). `caster`/`target` = contexte d'incantation, résolu par le flux de sort → ignoré ici.
      const on = e.on ?? 'party';
      if (on !== 'party' && on !== 'hero') return;
      const targets = env.targets(on, e.heroId);
      if (!targets.length) return;
      const lines = targets.flatMap((c) => applyOps(c, e.ops, { rng: defaultRNG, onCorruption: (n, align) => gainCorruption(env.get, env.set, c, n, align) }));
      env.set(touchActors(env.get()));
      lines.forEach((l) => env.log(l));
    },
  },
  zoneBlast: {
    group: '☠️ Afflictions', label: 'Souffle de zone (effets mécaniques, rayon)', icon: '🧨',
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
      const targets = combatantsWithinRadius(e.center, e.radius, pool, (c) => !c.dead);
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
    group: '☠️ Afflictions', label: 'Chute (dégâts/m + 1d10, À Terre, repositionne le groupe)', icon: '🪂',
    make: () => ({ type: 'fall', target: 'party', metres: 4 }),
    apply: (e, env) => {
      // Chute (LDB 15 l.117-122) : 3 Dégâts/mètre + 1d10, réduits par le Bonus d'Endurance mais
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
        return t('eff.fallTarget', { name: c.name, lost, aterre: knocked ? t('eff.fragATerre') : '' });
      });
      if (targets.length) {
        env.set({ ...touchActors(env.get()), ...(e.to && !env.get().battle ? { partyPos: e.to } : {}) });
        env.log(t('eff.fall', { m, lines: lines.join(' · ') }));
      } else if (e.to && !env.get().battle) env.set({ partyPos: e.to });
    },
  },
  inflictDisease: {
    group: '☠️ Afflictions', label: 'Infliger une maladie (LDB 20)', icon: '🤢',
    make: () => ({ type: 'inflictDisease', disease: DISEASE_NAMES[0] ?? '', heroId: '' }),
    apply: (e, env) => {
      // Maladie (LDB 20) infligée par l'auteur (nourriture avariée, contact infecté…). Incubation/durée
      // tirées à la contraction ; les symptômes se déclareront au repos. Dédoublonnée par nom.
      let whoId = '';
      const who = env.mutateHero(e.heroId, (h) => {
        if ((h.diseases ?? []).some((d) => d.name === e.disease)) return h; // déjà présente → no-op
        const dz = contractDisease(e.disease, battleRng());
        if (!dz) return h;
        whoId = h.id;
        return { ...h, diseases: [...(h.diseases ?? []), dz] };
      });
      if (who && whoId) {
        const line = t('eff.diseaseContracted', { name: who.name, disease: e.disease });
        env.log(line);
        // VISIBLE (le journal seul ne suffit pas) : effet d'AUTEUR → révélation témoin.
        env.pushReveal({ kind: 'effet', title: t('eff.diseaseTitle', { disease: e.disease }), lines: [line], subjectId: whoId, severity: 'grave' });
      }
    },
  },
  inflictTrauma: {
    group: '☠️ Afflictions', label: 'Infliger une Blessure Critique (LDB 18)', icon: '🦴',
    make: () => ({ type: 'inflictTrauma', kind: 'fracture', severity: 'mineur', location: 'brasD', heroId: '' }),
    apply: (e, env) => {
      // Blessure Critique posée rétroactivement par l'éditeur (LDB 18) : déchirure/fracture via `traumaById`
      // (fiche `traumas.json` résolue par `dechirureFractureFicheId`, effets en-combat + convalescence),
      // amputation via les séquelles permanentes (`permanentAmputations`). criticalWounds suit (compteur LDB 18).
      let labels: string[] = [];
      let whoId = '';
      const who = env.mutateHero(e.heroId, (h) => {
        whoId = h.id;
        const be = Math.floor(effectiveChar(h, 'E') / 10);
        // Amputation : séquelle PERMANENTE choisie par localisation (bras → main/bras ; jambe → membre
        // inférieur ; tête → œil, choix d'éditeur) — ids de fiche `traumas.json`, plus de texte parsé.
        const ampSequel = e.location === 'tete' ? 'oeil-perdu' : e.location === 'brasG' || e.location === 'brasD' ? 'main-bras-ampute' : 'membre-inferieur-ampute';
        const traumas = e.kind === 'amputation'
          ? permanentAmputations([ampSequel], e.location, battleRng())
          : [traumaById(dechirureFractureFicheId(e.kind, e.severity ?? 'mineur', e.location), { be, d10: d10(battleRng()) }, e.location)];
        labels = traumas.map((tr) => tr.label);
        return { ...h, traumas: [...(h.traumas ?? []), ...traumas], criticalWounds: (h.criticalWounds ?? 0) + 1 };
      });
      if (who) {
        const line = t('eff.criticalSuffered', { name: who.name, kind: e.kind, location: e.location });
        env.log(line);
        // VISIBLE (le journal seul ne suffit pas) : effet d'AUTEUR → révélation témoin.
        env.pushReveal({ kind: 'effet', title: t('eff.criticalTitle', { kind: e.kind }), lines: [line, ...labels], subjectId: whoId, severity: 'grave' });
      }
    },
  },
  inflictNightmares: {
    group: '☠️ Afflictions', label: 'Infliger des cauchemars (trauma nocturne)', icon: '😱',
    make: () => ({ type: 'inflictNightmares', heroId: '' }),
    apply: (e, env) => {
      // Trauma « Cauchemars » (LDB 21 l.92) posé sur un héros (défaut : le premier).
      const who = env.mutateHero(e.heroId, (h) => ({ ...h, nightmares: true }));
      if (who) env.log(t('eff.nightmares', { name: who.name }));
    },
  },
  corruptionExposure: {
    group: '☠️ Afflictions', label: 'Influence corruptrice (Test, LDB 19)', icon: '🧿',
    make: () => ({ type: 'corruptionExposure', level: 'mineure', skill: 'resistance', heroId: '' }),
    apply: (e, env) => {
      // Influence corruptrice (LDB 19 l.23-75) : ouvre le Test différé par modale
      // (Lancer → Chance → Appliquer) ; le gain dépendra du niveau et du DR.
      const hero = corruptionTarget(env.get(), e.heroId);
      // `e.skill` présent = déterminé en amont (verrouillé) ; absent = nature indéterminée → le
      // joueur choisira Résistance/Calme dans la modale (défaut affiché : Résistance).
      // Test d'Exposition = « résister à la Corruption » → Résistance (Menace : Corruption) offerte (LDB 10).
      if (hero) env.set({ pendingCorruption: { heroId: hero.id, level: e.level, skill: e.skill ?? 'resistance', skillLocked: e.skill != null, align: e.align, menace: 'Corruption' } });
    },
  },
  giveSin: {
    group: '☠️ Afflictions', label: 'Points de Péché (prêtre fautif, LDB 40)', icon: '⚖️',
    make: () => ({ type: 'giveSin', amount: 1, heroId: '' }),
    apply: (e, env) => {
      // Points de Péché (LDB 40 l.36) : sanction d'auteur, 1 à 3 selon la gravité.
      // Cible : héros désigné, sinon le premier sachant Prier (le Péché vise un Bienheureux).
      const amount = Math.max(1, e.amount ?? 1);
      const who = env.mutateHero(
        e.heroId,
        (h) => ({ ...h, sinPoints: (h.sinPoints ?? 0) + amount }),
        (party) => {
          const i = party.findIndex((h) => h.skills.some((sk) => sk.skillId === 'priere' && sk.advances >= 1));
          return i >= 0 ? i : 0;
        },
      );
      if (who) env.log(t('eff.sin', { name: who.name, amount }));
    },
  },

  // ── 🕰 Temps & repos ──────────────────────────────────────────────────────
  rest: {
    group: '🕰 Temps & repos', label: 'Repos (Dormir / Se reposer N jours)', icon: '🌙',
    make: () => ({ type: 'rest', days: 1 }),
    apply: (e, env) => {
      // Repos déclenché par l'éditeur (trigger/dialogue) : ouvre la MODALE DE NUIT (couchage +
      // pitance par héros, prix RAW, bilan globalisé). LEGACY sans `lodging` : contexte maison.
      openRest(env.get, env.set, { places: placesOfKind(e.lodging ?? 'maison'), quality: e.quality, days: e.days ?? 1 });
    },
  },
  mealParty: {
    group: '🕰 Temps & repos', label: 'Repas (nourrit le groupe sans ration — faim à zéro)', icon: '🍲',
    make: () => ({ type: 'mealParty' }),
    apply: (_e, env) => {
      // Repas (#T2) : tout le groupe est nourri pour la journée sans consommer de ration —
      // compteurs/malus de Faim remis à zéro (LDB 18 l.417-422 ; prix éventuel porté par le choix).
      const diners = env.get().party;
      for (const h of diners) if (!h.dead) feedFromMeal(h);
      env.set({ party: [...diners] });
      env.log(t('eff.meal'));
    },
  },
  interlude: {
    group: '🕰 Temps & repos', label: 'Entre deux aventures (Événements + Activités, N semaines)', icon: '📆',
    make: () => ({ type: 'interlude', weeks: 1 }),
    apply: (e, env) => {
      // « Entre deux aventures » (LDB 22-23) — via l'action store (pas d'import direct : cycle).
      // Règle optionnelle (LDB 22 l.14) : tout le chapitre est facultatif → désactivable.
      if (rule('interlude-enabled')) env.get().startInterlude(e.weeks ?? 1);
    },
  },
  setTime: {
    group: '🕰 Temps & repos', label: 'Régler l’heure (jour/nuit)', icon: '🕰',
    make: () => ({ type: 'setTime', phase: 'nuit' }),
    apply: (e, env) => {
      // Saut EN AVANT jusqu'à la prochaine occurrence de la phase/heure visée (le temps ne recule jamais).
      const target = 'phase' in e
        ? (DAY_PHASES.find((p) => p.key === e.phase)?.start ?? 0)
        : e.hour * 60 + (e.minute ?? 0);
      env.get().advanceTime(minutesUntilNext(env.get().gameTime, target));
    },
  },
  delayedEffect: {
    group: '🕰 Temps & repos', label: 'Effet différé (minuterie / heure)', icon: '⏳',
    make: () => ({ type: 'delayedEffect', afterMinutes: 60, flow: EMPTY_FLOW, cancelFlag: '' }),
    apply: (e, env) => {
      // Échéance absolue (minute `gameTime`) : compte à rebours relatif `afterMinutes`, sinon la
      // prochaine occurrence de l'heure du jour `atHour:atMinute`.
      const now = env.get().gameTime;
      const executeAt = e.afterMinutes != null
        ? now + Math.max(0, e.afterMinutes)
        : now + minutesUntilNext(now, (e.atHour ?? 0) * 60 + (e.atMinute ?? 0));
      env.set((s: GameState) => ({ scheduledEffects: [...s.scheduledEffects, { executeAt, flow: e.flow, cancelFlag: e.cancelFlag }] }));
    },
  },

  // ── 🚪 Navigation ─────────────────────────────────────────────────────────
  transition: {
    group: '🚪 Navigation', label: 'Transition de scène', icon: '🚪',
    make: () => ({ type: 'transition', scene: '', entry: '' }),
    apply: (e, env) => {
      const cur = env.get();
      if (cur.scene) env.set({ previousScene: { id: cur.scene.id, pos: { ...cur.partyPos } } });
      env.get().transitionTo(e.scene, e.entry);
    },
    refs: (e, ctx) => ctx.sceneIds.has(e.scene) ? [] : [{ level: 'error', message: `Effet → scène inexistante « ${e.scene} »` }],
  },
  transitionBack: {
    group: '🚪 Navigation', label: 'Retour scène précédente', icon: '↩️',
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
    group: '🚪 Navigation', label: 'Ouvrir la carte du monde (partir en voyage)', icon: '🗺️',
    make: () => ({ type: 'openWorldMap' }),
    apply: (_e, env) => {
      // « Partir en voyage » depuis une porte/route de la scène (#T2) — l'action est déjà gardée
      // (no-op sans carte ou en combat).
      env.get().openWorldMap();
    },
  },

  // ── ⚔️ Combat & social ────────────────────────────────────────────────────
  startCombat: {
    group: '⚔️ Combat & social', label: 'Démarrer un combat', icon: '⚔️',
    make: () => ({ type: 'startCombat', encounter: '' }),
    apply: (e, env) => { env.get().startCombat(e.encounter); },
    refs: (e, ctx) => ctx.encounterIds.has(e.encounter) ? [] : [{ level: 'error', message: `Effet → rencontre inexistante « ${e.encounter} »` }],
  },
  openMerchant: {
    group: '⚔️ Combat & social', label: 'Ouvrir une boutique (marchand)', icon: '🛒',
    make: () => ({ type: 'openMerchant', entityId: '' }),
    apply: (e, env) => { env.get().openMerchant(e.entityId); }, // ouvre la boutique de l'entité (Marchand inclus dans un dialogue, #2)
  },
  medicalAid: {
    group: '⚔️ Combat & social', label: 'Acte de soin payant (PNJ médecin/guérisseur)', icon: '🩺',
    // tarif par défaut : « aide médicale 4-6 pistoles » (LDB 75) → 5 pa
    make: () => ({ type: 'medicalAid', acts: [{ act: 'wounds', cost: { silver: 5 } }], skill: 50, intBonus: 4 }),
    apply: (e, env) => { openMedicalAidEffect(env.get, env.set, e); }, // soins payants d'un PNJ : ouvre son infirmerie (actes tarifés)
  },

  // ── 🎲 Tests ──────────────────────────────────────────────────────────────
  extendedTest: {
    group: '🎲 Tests', label: 'Test Étendu (DR cumulé : crocheter/forcer un mécanisme)', icon: '🗝️',
    make: () => ({ type: 'extendedTest', skill: 'crochetage', difficulty: 'intermediaire', label: 'Crocheter la serrure', targetDR: 5, flag: '' }),
    apply: (e, env) => {
      // Test ÉTENDU (LDB 12) : le meilleur du groupe enchaîne les Rounds, SOUTENU par les autres membres
      // capables (+10 chacun, plafond Bonus de Carac — `partyAssisted`).
      const best = partyAssisted(env.get().party, e.skill, e.characteristic, undefined, e.spec);
      if (!best) return;
      const difficulty = e.difficulty ?? 'intermediaire';
      const target = Math.max(1, Math.min(99, best.value + DIFFICULTY_MODIFIERS[difficulty]));
      env.get().startExtendedTest({ actorId: best.actor.id, label: e.label, skillLabel: e.skill ? refLabel('skills', { id: e.skill, spec: e.spec }) : (e.characteristic ?? 'Test'), target, targetDR: e.targetDR, flag: e.flag, ...(best.support.count > 0 ? { support: best.support } : {}) });
      return 'suspend';
    },
  },
  forceDoor: {
    group: '🎲 Tests', label: 'Enfoncer une porte à plusieurs (objet BE/B)', icon: '🔨',
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

/**
 * Applique une liste d'Effets via le REGISTRE `EFFECT_HANDLERS` (1 effet = 1 handler). Un handler qui
 * renvoie `'suspend'` (extendedTest/forceDoor → modale/pending) STOPPE la boucle, comme l'ancien
 * `return` au milieu du switch — l'ORDRE, les journaux et les révélations restent identiques.
 */
export function applyEffects(get: Get, set: SetFn, effects: Effect[]) {
  const env = makeEffectEnv(get, set);
  for (const e of effects) {
    const handler = EFFECT_HANDLERS[e.type] as EffectHandler;
    if (handler.apply(e, env) === 'suspend') return;
  }
}

/**
 * Soins PAYANTS d'un PNJ (Effet `medicalAid`, LDB 75) : ouvre l'INFIRMERIE (state/medicFlow) avec
 * la compétence du PNJ et ses actes tarifés — le débit a lieu à l'acte, dans la modale. Le joueur
 * choisit les patients ; le PNJ effectue les jets (la Chance interroge `actorIn(healerId)` →
 * introuvable pour un PNJ → boutons inertes).
 */
function openMedicalAidEffect(get: Get, set: SetFn, e: { acts?: { act: HealMode; cost?: { gold?: number; silver?: number; brass?: number } }[]; skill: number; intBonus: number; entityId?: string }): void {
  const acts = e.acts ?? [];
  if (!acts.length) return;
  const npc = e.entityId ? get().scene?.entities.find((x) => x.id === e.entityId) : undefined;
  openMedic(get, set, {
    npc: {
      id: npc?.id ?? e.entityId ?? 'pnj-soigneur',
      name: npc?.label ?? 'Soigneur',
      skill: e.skill,
      intBonus: e.intBonus,
      acts,
    },
  });
}
