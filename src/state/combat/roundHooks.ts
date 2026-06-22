/**
 * Hooks de FRANCHISSEMENT DE ROUND (`roundBoundary`) enregistrés sur la couture `combatHooks`. Module
 * FEUILLE chargé par effet de bord depuis combatFlow (comme restFlow/travelFlow peuplent cascadeAppliers) :
 * la séquence de fin de Round (anciennement ~15 boucles inline d'`advanceTurn`) vit ICI, chaque effet
 * étant un hook ordonné par `order` (l'ordre RAW est encodé par les valeurs). Les helpers sont appelés
 * dans les closures `run()` (au RUNTIME, quand `runCombatHooks` se déclenche) → pas de souci de cycle à
 * l'import. Le golden `roundBoundary.golden.test.ts` fige l'ordre + les tirages RNG byte-pour-byte.
 */
import { registerCombatHook } from '../combatHooks';
import { registerCascadeApplier } from '../cascade';
import { battleRng } from '../battleRng';
import { rollTest } from '../../engine/tests';
import { testValue } from '../../engine/skills';
import { bonus, effectiveChar, refreshWounds } from '../../engine/characteristics';
import { addCondition, isOutOfAction, COND, tickDeath, stacks, removeCondition, endOfRound, loseWounds, hasCondition, poisonResistValue, poisonResistApply, combatTestPenalty } from '../../engine/conditions';
import { suffocationTick } from '../../engine/suffocation';
import { clearPsychOf, calmeValue } from '../../engine/psychology';
import { zonesRoundTick } from '../zones';
import { purgeExpiredSummons } from '../summonFlow';
import { fireTriggers, fireConditionEffects } from '../triggeredEffects';
import { isUnstable, isBestial, hasPerturbingAura } from '../../engine/traits/dispatch';
import { outnumberCountBonus, hasBraveheart } from '../../engine/combatFeatures/dispatch';
import { chebyshev } from '../path';
import { isEngaged } from '../../engine/engagement';
import { lineOfSightCover } from '../lineOfSight';
import { smokeOf } from '../combatGeometry';
import { rule } from '../../engine/policy';
import { cadenceAuto } from '../../engine/cadence';
import { DIFFICULTY_MODIFIERS } from '../../engine/types';
import type { Combatant, Difficulty } from '../../engine/types';
import type { CascadeStep } from '../pendings';
import type { Get, Set as SetFn } from '../flowTypes';

/**
 * Un Test de fin de Round de `c` doit-il être une étape de CASCADE influençable (modale) plutôt qu'un
 * jet silencieux résolu dans le hook ? VRAI uniquement pour un HÉROS en cadence MANUELLE — en rapide/auto
 * (`cadenceAuto`), le héros est auto-résolu COMME un monstre → jet silencieux dans le hook (pas de cascade
 * redondante). C'est l'axe RÉEL de l'interactivité (kind × cadence), PAS `kind` seul (un héros auto-piloté
 * n'est pas « interactif »). Une seule source pour tous les hooks d'upkeep + le collecteur de cascade.
 */
export function roundTestInteractive(c: Combatant): boolean {
  return c.kind === 'hero' && !cadenceAuto();
}

// ============================================================================================
// Séquence RAW de franchissement de Round, migrée ISO-COMPORTEMENT depuis advanceTurn (corps copiés
// tel quel, `ctx.sink` remplaçant la `tickLine` locale, `ctx.get` le `get`). Les `order` reflètent la
// position d'origine → ordre + RNG préservés (golden byte-pour-byte).
// ============================================================================================

registerCombatHook({
  id: 'end-of-round', // dégâts/effets périodiques d'États — RNG. Hémorragique/En flammes/Sonné/dissipation
  // restent dans endOfRound (en dur, à migrer) ; Empoisonné MIGRÉ en données (effects: onRoundEnd).
  phase: 'onRoundEnd',
  order: 10,
  run: ({ get, set, battle, sink }) => {
    for (const c of battle.combatants) {
      endOfRound(c, battleRng()).forEach((l) => sink(l, c));
      fireConditionEffects(get, c, 'onRoundEnd', { rng: battleRng(), set }).forEach((l) => sink(l, c)); // dégâts data-driven (Empoisonné…)
    }
  },
});
registerCombatHook({
  id: 'poison-resist', // Résistance à l'Empoisonné (LDB 16 l.70-72) : retire 1+DR pions sur succès, puis Exténué quand vidé
  phase: 'onRoundEnd',
  order: 15, // juste après les DÉGÂTS périodiques (end-of-round 10)
  run: ({ battle, sink }) => {
    for (const c of battle.combatants) {
      // Non-interactif (monstre OU héros en rapide/auto) → jet SILENCIEUX ici. Héros MANUEL → différé à
      // la cascade influençable (étape `poisonResist`, cf. collectHeroRoundEndUpkeep) → on le saute.
      if (roundTestInteractive(c) || stacks(c, COND.empoisonne) <= 0) continue;
      const t = rollTest(poisonResistValue(c), 'intermediaire', battleRng(), combatTestPenalty(c));
      poisonResistApply(c, t.success, t.sl)?.split('\n').forEach((l) => sink(l, c));
    }
  },
});
registerCombatHook({
  id: 'refresh-wounds', // dissipation d'un buff F/E/FM → recale les Blessures (LDB 85)
  phase: 'onRoundEnd',
  order: 20,
  run: ({ battle }) => { for (const c of battle.combatants) refreshWounds(c); },
});
registerCombatHook({
  id: 'fire-round-start-triggers', // effets « début de Round » authorés (Régénération…) — dispatcher générique (RNG)
  phase: 'onRoundEnd',
  order: 25,
  run: ({ get, set, battle, sink }) => {
    for (const c of battle.combatants) {
      if (c.dead || c.outOfRencontre) continue;
      for (const line of fireTriggers(get, c, 'onRoundStart', { rng: battleRng(), set })) sink(line, c);
    }
  },
});
registerCombatHook({
  id: 'unstable', // Instable (LDB 85 p.340) : Engagé avec un Avantage SUPÉRIEUR → perd la différence en PB ; à 0, « meurt »
  phase: 'onRoundEnd',
  order: 30,
  run: ({ battle, sink }) => {
    for (const c of battle.combatants) {
      if (isOutOfAction(c) || !isUnstable(c.traits)) continue;
      const foesAdv = (c.engagedWith ?? [])
        .map((id) => battle.combatants.find((x) => x.id === id))
        .filter((e): e is Combatant => !!e && e.kind !== c.kind && !isOutOfAction(e))
        .map((e) => e.advantage ?? 0);
      const diff = (foesAdv.length ? Math.max(...foesAdv) : 0) - (c.advantage ?? 0);
      if (diff > 0) {
        loseWounds(c, diff);
        sink(`${c.name} (Instable) est repoussée : −${diff} PB.`, c);
        if (c.wounds.current <= 0) { c.dead = true; sink(`${c.name} se délite — les magies qui la maintenaient s'effondrent.`, c); }
      }
    }
  },
});
registerCombatHook({
  id: 'bestial-fire-fear', // Bestial (LDB 85 p.338) : En flammes → gagne Brisé (approximation granularité Round)
  phase: 'onRoundEnd',
  order: 40,
  run: ({ battle, sink }) => {
    for (const c of battle.combatants) {
      if (!isOutOfAction(c) && isBestial(c.traits) && hasCondition(c, COND.enFlammes) && !hasCondition(c, COND.brise)) {
        addCondition(c, COND.brise);
        sink(`${c.name} (Bestial) est terrifié par les flammes : Brisé.`, c);
      }
    }
  },
});
registerCombatHook({
  id: 'perturbing-aura', // Perturbant (LDB 85 p.341) : −20 aux Tests à BE mètres d'une créature Perturbante (aura recalculée/Round)
  phase: 'onRoundEnd',
  order: 50,
  run: ({ battle }) => {
    for (const c of battle.combatants) {
      c.perturbed = !isOutOfAction(c) && !!c.pos && battle.combatants.some(
        (p) => p.id !== c.id && p.kind !== c.kind && !isOutOfAction(p) && p.pos
          && hasPerturbingAura(p.traits) && chebyshev(p.pos, c.pos!) * 2 <= bonus(effectiveChar(p, 'E')),
      );
    }
  },
});
registerCombatHook({
  id: 'outnumbered', // Surnombre (LDB 14 l.149) : ≥2 ennemis Engagés → −1 Avantage en fin de Round
  phase: 'onRoundEnd',
  order: 55,
  run: ({ battle, sink }) => {
    for (const c of battle.combatants) {
      if (isOutOfAction(c) || (c.advantage ?? 0) <= 0) continue;
      const foes = (c.engagedWith ?? []).filter((id) => {
        const e = battle.combatants.find((x) => x.id === id);
        return !!e && e.kind !== c.kind && !isOutOfAction(e);
      }).length;
      // Maîtrise du combat (LDB 10) : on compte pour 1+niveau personnes au calcul du surnombre.
      if (foes >= 2 + outnumberCountBonus(c)) { c.advantage = Math.max(0, c.advantage - 1); sink(`${c.name} est surpassé en nombre (${foes} c.1) : −1 Avantage.`, c); }
    }
  },
});
// Mâchoires d'acier (LDB 10) NE vit PLUS comme un hook de franchissement de Round : c'est un effet
// DÉCLENCHÉ `onGainCondition` data-driven (talents.json) — « chaque fois que vous gagnez un État Sonné »,
// résolu cadence-aware par la brique `combat/triggeredTest` (héros manuel → cascade influençable ;
// ennemi/auto → jet inline). L'ordre 60 du franchissement de Round est désormais libre.

// Détermination (LDB 17 l.62/64) : décomptes de fin de Round (flags, RNG-free).
registerCombatHook({
  id: 'determination-ignore-crit-expire', // « ignorer modifs de critique » expire au début du prochain Round
  phase: 'onRoundEnd',
  order: 70,
  run: ({ battle }) => { for (const c of battle.combatants) if (c.ignoreCritMods) c.ignoreCritMods = false; },
});
registerCombatHook({
  id: 'determination-psych-immune-tick', // l'immunité psychologique décompte 1 Round
  phase: 'onRoundEnd',
  order: 72,
  run: ({ battle }) => { for (const c of battle.combatants) if (c.psychImmuneRoundsLeft) c.psychImmuneRoundsLeft -= 1; },
});

/**
 * Contexte RNG-free de récupération du Brisé pour `c` (LDB 16 l.57-59 ; Cœur vaillant LDB 10) :
 * « caché hors de vue » (tous les ennemis ont la Ligne de Vue bloquée → retire 1 Brisé sans Test) et
 * la difficulté du Test de Calme. Pur de RNG → calculé à l'IDENTIQUE par le hook ENNEMI (roll inline)
 * et le collecteur HÉROS (étape de cascade). N'applique PAS encore le retrait « caché » ni l'Exténué.
 */
function brokenContext(get: Get, c: Combatant): { hidden: boolean; testDue: boolean; difficulty: Difficulty } | null {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle || !stacks(c, COND.brise) || isOutOfAction(c) || !c.pos) return null;
  const enemies = battle.combatants.filter((e) => e.kind !== c.kind && !isOutOfAction(e) && e.pos);
  const hidden = !!scene && enemies.length > 0 && enemies.every((e) => lineOfSightCover(scene, e.pos!, c.pos!, [], smokeOf(battle)).blocked);
  // Restera-t-il du Brisé à tester APRÈS l'éventuel retrait « caché » (1 stack) ? Le Test n'a lieu que
  // si pas Engagé (l.57) — sauf Cœur vaillant (LDB 10, sans restriction d'Engagement).
  const briseAfterHidden = stacks(c, COND.brise) - (hidden ? 1 : 0);
  const testDue = briseAfterHidden > 0 && (!isEngaged(c) || hasBraveheart(c));
  const nearest = enemies.length ? Math.min(...enemies.map((e) => chebyshev(c.pos!, e.pos!))) : Infinity;
  const difficulty: Difficulty = hidden ? 'accessible' : nearest <= 3 ? 'tresDifficile' : 'intermediaire';
  return { hidden, testDue, difficulty };
}
/** « Une fois que vous n'avez plus d'États Brisé, vous gagnez 1 État Exténué » (LDB 16 l.80). */
function brokenExhaustIfClear(c: Combatant, sink: (line: string, c: Combatant) => void): void {
  if (!stacks(c, COND.brise)) { addCondition(c, COND.extenue); sink(`${c.name} est Exténué (après s'être ressaisi).`, c); }
}
/** Conséquence d'un Test de Calme de récupération du Brisé : retire 1 + DR Brisé sur succès (LDB 16 l.59).
 *  Partagée par le hook (ENNEMIS) et l'applier de cascade (HÉROS). */
function brokenRecoveryApply(c: Combatant, success: boolean, sl: number, sink: (line: string, c: Combatant) => void): void {
  if (success) {
    const removed = Math.min(stacks(c, COND.brise), 1 + Math.max(0, sl));
    removeCondition(c, COND.brise, removed);
    sink(`${c.name} se ressaisit : retire ${removed} État(s) Brisé (Test de Calme réussi).`, c);
  } else {
    sink(`${c.name} reste Brisé (Test de Calme raté).`, c);
  }
  brokenExhaustIfClear(c, sink);
}
/**
 * Récupération du Brisé en fin de Round (LDB 16 l.57-59 ; Cœur vaillant LDB 10). Déplacé ICI depuis
 * combatFlow (qui le ré-exporte pour `broken-recovery.test`). Émet chaque ligne via `sink(line, c)`.
 * `shouldResolveInline` restreint la résolution SILENCIEUSE : le hook combat ne résout INLINE que les
 * combattants NON-interactifs (monstres + héros en rapide/auto) — les héros MANUELS passent par la
 * cascade influençable ; absent → tous (broken-recovery.test l'appelle sans filtre).
 */
export function brokenRecovery(get: Get, sink: (line: string, c: Combatant) => void, shouldResolveInline?: (c: Combatant) => boolean): void {
  const battle = get().battle;
  if (!battle) return;
  for (const c of battle.combatants) {
    if (shouldResolveInline && !shouldResolveInline(c)) continue;
    const ctx = brokenContext(get, c);
    if (!ctx) continue;
    if (ctx.hidden) { removeCondition(c, COND.brise, 1); sink(`${c.name} est resté caché hors de vue : retire 1 État Brisé.`, c); }
    if (ctx.testDue) {
      const t = rollTest(calmeValue(c), ctx.difficulty, battleRng());
      brokenRecoveryApply(c, t.success, t.sl, sink);
    } else {
      brokenExhaustIfClear(c, sink);
    }
  }
}
registerCombatHook({
  id: 'broken-recovery', // récupération du Brisé en fin de Round (LDB 16 l.57-59) — RNG (Test de Calme)
  phase: 'onRoundEnd',
  order: 74,
  run: ({ get, sink }) => brokenRecovery(get, sink, (c) => !roundTestInteractive(c)), // héros MANUEL → cascade ; non-interactif (monstre/rapide/auto) → silence
});

// --- Migration ISO-COMPORTEMENT des derniers blocs du franchissement de Round (corps copiés tel quel,
//     `ctx.sink` remplace `tickLine`). Pas de hook suspensif (aucun pending). ---
registerCombatHook({
  id: 'tick-death', // 0 PB → Inconscient (LDB 18 l.28)
  phase: 'onRoundEnd',
  order: 76,
  run: ({ battle, sink }) => { for (const c of battle.combatants) tickDeath(c, battleRng()).forEach((l) => sink(l, c)); },
});
registerCombatHook({
  id: 'suffocation-tick', // Noyade et Suffocation (LDB 18 l.424-425)
  phase: 'onRoundEnd',
  order: 78,
  run: ({ battle, sink }) => { for (const c of battle.combatants) suffocationTick(c).forEach((l) => sink(l, c)); },
});
registerCombatHook({
  id: 'zones-round-tick', // zones perRound (Grands feux d'U'Zhul, LDB 47 : « au début d'un Round »)
  phase: 'onRoundEnd',
  order: 79,
  run: ({ battle, sink }) => { zonesRoundTick(battle.zones, battle.combatants, battleRng()).forEach((t) => sink(t.line, t.combatant)); },
});
registerCombatHook({
  id: 'clear-psych-of-dead', // effets psy d'une créature morte → fin (catch-all toutes causes de mort)
  phase: 'onRoundEnd',
  order: 79.3,
  run: ({ battle }) => { for (const c of battle.combatants) if (isOutOfAction(c)) clearPsychOf(battle.combatants, c.id); },
});
registerCombatHook({
  id: 'purge-expired-summons', // invocations à durée écoulée OU lanceur tombé ; round = battle.round+1 (set après le dispatch)
  phase: 'onRoundEnd',
  order: 79.5,
  run: ({ battle, sink }) => { purgeExpiredSummons(battle, battle.round + 1).forEach((l) => sink(l)); },
});
registerCombatHook({
  id: 'fire-round-end-triggers', // effets « fin de Round » authorés — dispatcher générique (RNG) ; inerte sans donnée
  phase: 'onRoundEnd',
  order: 79.6, // après les décomptes/purges de fin de Round, avant la règle optionnelle se-fatiguer (80)
  run: ({ get, set, battle, sink }) => {
    for (const c of battle.combatants) {
      if (c.dead || c.outOfRencontre) continue;
      for (const line of fireTriggers(get, c, 'onRoundEnd', { rng: battleRng(), set })) sink(line, c);
    }
  },
});

/**
 * Règle optionnelle « Se fatiguer » (LDB 16 l.99) : un effort physique soutenu finit par épuiser.
 * Approximation assumée (granularité Round) : chaque Round en action = 1 Round d'effort ; à Bonus
 * d'Endurance Rounds cumulés, Test de Résistance — échec → +1 Exténué (compteur remis à zéro) ;
 * réussite → le délai avant le prochain Test est repoussé de 1 + DR Rounds. Inerte tant que la règle
 * `combat-se-fatiguer` est inactive (aucun tirage RNG consommé → franchissement de Round iso-comportement).
 */
/** Seuil de « se-fatiguer » : Bonus d'Endurance Rounds d'effort cumulés (min 1) avant un Test (LDB 16 l.99). */
function fatigueThreshold(c: Combatant): number {
  return Math.max(1, bonus(effectiveChar(c, 'E')));
}
/** Conséquence d'un Test de Résistance « se-fatiguer » : succès → recule le délai (−1−DR Rounds) ;
 *  échec → Exténué + compteur remis à zéro. Partagée par le hook (ENNEMIS) et l'applier (HÉROS). */
function fatigueApply(c: Combatant, success: boolean, sl: number): string | null {
  if (success) {
    c.effortRounds = Math.max(0, (c.effortRounds ?? 0) - (1 + Math.max(0, sl)));
    return null;
  }
  addCondition(c, COND.extenue);
  c.effortRounds = 0;
  return `${c.name} s'épuise (effort soutenu) : Exténué.`;
}
registerCombatHook({
  id: 'se-fatiguer',
  phase: 'onRoundEnd',
  order: 80, // après tous les effets de Round RAW, avant la révélation héros
  enabledIf: 'combat-se-fatiguer',
  run: ({ battle, sink }) => {
    for (const c of battle.combatants) {
      if (isOutOfAction(c)) continue;
      // L'incrément du compteur d'effort est DÉTERMINISTE (RNG-free) : il a lieu pour TOUT le monde,
      // héros compris (le collecteur de cascade lit `effortRounds` ≥ seuil pour émettre l'étape).
      c.effortRounds = (c.effortRounds ?? 0) + 1;
      if (c.effortRounds < fatigueThreshold(c)) continue;
      // Héros MANUEL au seuil : différé à la cascade influençable. Non-interactif (monstre/rapide/auto) : silence ici.
      if (roundTestInteractive(c)) continue;
      const t = rollTest(testValue(c, 'resistance'), 'intermediaire', battleRng());
      const line = fatigueApply(c, t.success, t.sl);
      if (line) sink(line, c);
    }
  },
});

// ============================================================================================
// JETS D'UPKEEP de fin de Round concernant un HÉROS → étapes de CASCADE influençable (Chance/
// Résilience), fusionnées dans la cascade de fin de Round (cf. combatFlow `openRoundEndCascade`).
// Les ENNEMIS restent résolus en silence dans les hooks ci-dessus (IA, en masse). Le JET d'une étape
// est kind-agnostique (`FLOWS.cascade` → Test +0 sur `step.target`) ; l'APPLIER ci-dessous interprète
// `step.result` par `kind`. Modules feuilles : RIEN n'importe combatFlow (pas de cycle).
// ============================================================================================

/** Cible EFFECTIVE d'un Test (difficulté repliée → `FLOWS.cascade` applique +0 sur `target`). */
function effTarget(base: number, difficulty: Difficulty): number {
  return base + DIFFICULTY_MODIFIERS[difficulty];
}

/**
 * Tests d'upkeep de fin de Round DUS pour le héros `c` ce Round, en ÉTAPES de cascade (jumeau des
 * collecteurs de Psychologie). Ordre : Empoisonné → récupération du Brisé → se-fatiguer (du plus
 * mécanique au plus optionnel). Side-effect ASSUMÉ (comme `endFrenzyIfDone` côté psy) : le
 * retrait « caché » du Brisé et l'Exténué SANS-Test sont appliqués ICI (RNG-free, déterministes via
 * `sink`) ; seuls les Tests réellement dus deviennent des étapes influençables.
 */
export function collectHeroRoundEndUpkeep(get: Get, c: Combatant, sink: (line: string, c: Combatant) => void): CascadeStep[] {
  // Étapes de cascade SEULEMENT pour un Test INTERACTIF (héros en cadence manuelle) ; en rapide/auto, le
  // héros est auto-résolu COMME un monstre → ses Tests se résolvent silencieusement dans les hooks ci-dessus.
  if (!roundTestInteractive(c) || isOutOfAction(c)) return [];
  const steps: CascadeStep[] = [];
  // 0) Résistance à l'Empoisonné (LDB 16 l.70-72) — Test de Résistance Intermédiaire (+0). Les DÉGÂTS
  //    périodiques ont DÉJÀ été appliqués par `endOfRound` (hook `end-of-round`) ; seul le TEST passe en
  //    cascade. Placé en TÊTE (physiologique, groupé avec les dégâts de poison).
  //    La pénalité d'États (−10 Empoisonné/Sonné/Exténué…) est repliée dans `target`, comme pour le Brisé.
  if (stacks(c, COND.empoisonne) > 0) {
    const base = poisonResistValue(c);
    steps.push({ id: `poisonResist-${c.id}`, kind: 'poisonResist', actorId: c.id, icon: '☠️', rollLabel: 'Résistance', base, target: base + DIFFICULTY_MODIFIERS.intermediaire + combatTestPenalty(c), label: '☠️ Résistance à l’Empoisonné' });
  }
  // (Mâchoires d'acier n'est PLUS un Test de fin de Round : c'est un effet `onGainCondition` data-driven,
  //  déclenché à l'acquisition du Sonné — cf. talents.json + brique `combat/triggeredTest`.)
  // 2) Récupération du Brisé (LDB 16) — retrait « caché » + Exténué SANS-Test appliqués ici ; le Test
  //    de Calme (difficulté variable) devient une étape si dû.
  const bctx = brokenContext(get, c);
  if (bctx) {
    if (bctx.hidden) { removeCondition(c, COND.brise, 1); sink(`${c.name} est resté caché hors de vue : retire 1 État Brisé.`, c); }
    if (bctx.testDue) {
      const calme = calmeValue(c);
      steps.push({ id: `brokenRecovery-${c.id}`, kind: 'brokenRecovery', actorId: c.id, icon: '😱', rollLabel: 'Calme', base: calme, target: effTarget(calme, bctx.difficulty), label: '😱 Récupération du Brisé' });
    } else {
      brokenExhaustIfClear(c, sink); // pas de Test (caché a tout retiré, ou Engagé) → Exténué déterministe
    }
  }
  // 3) Se-fatiguer (règle optionnelle) — l'incrément du compteur a déjà eu lieu dans le hook ; ici on
  //    n'émet l'étape que si le seuil est atteint (Test de Résistance différé).
  if (rule('combat-se-fatiguer') && (c.effortRounds ?? 0) >= fatigueThreshold(c)) {
    const res = testValue(c, 'resistance');
    steps.push({ id: `fatigue-${c.id}`, kind: 'fatigue', actorId: c.id, icon: '💢', rollLabel: 'Résistance', base: res, target: res, label: '💢 Effort soutenu' });
  }
  return steps;
}

/** Applique la conséquence d'une étape d'upkeep (mute le héros, renvoie les lignes de journal). Mirroir
 *  du refresh d'état de `combatPsych` (le collecteur ne possède pas `set`, l'applier oui). */
function syncCombatant(get: Get, set: SetFn): void {
  set({ party: [...get().party] });
  if (get().battle) set({ battle: { ...get().battle!, combatants: [...get().battle!.combatants] } });
}

registerCascadeApplier('poisonResist', (get, set, step, hero) => {
  if (!hero || !step.result) return;
  const line = poisonResistApply(hero, step.result.success, step.result.sl);
  syncCombatant(get, set);
  // `poisonResistApply` peut renvoyer 2 lignes jointes (« éliminé » + « Exténué ») → on les sépare.
  return { journal: line ? line.split('\n') : [`${hero.name} ne surmonte pas le poison (Résistance ratée).`] };
});

registerCascadeApplier('brokenRecovery', (get, set, step, hero) => {
  if (!hero || !step.result) return;
  const lines: string[] = [];
  brokenRecoveryApply(hero, step.result.success, step.result.sl, (l) => lines.push(l));
  syncCombatant(get, set);
  return { journal: lines };
});

registerCascadeApplier('fatigue', (get, set, step, hero) => {
  if (!hero || !step.result) return;
  const line = fatigueApply(hero, step.result.success, step.result.sl);
  syncCombatant(get, set);
  return { journal: line ? [line] : [`${hero.name} tient bon malgré l’effort.`] };
});
