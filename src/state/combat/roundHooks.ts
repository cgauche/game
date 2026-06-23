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
import { addCondition, isOutOfAction, COND, tickDeath, bleedDeathRoll, stacks, endOfRound } from '../../engine/conditions';
import { suffocationTick } from '../../engine/suffocation';
import { clearPsychOf } from '../../engine/psychology';
import { zonesRoundTick } from '../zones';
import { purgeExpiredSummons } from '../summonFlow';
import { fireTriggers } from '../triggeredEffects';
import { collectConditionRecoverySteps } from './triggeredTest';
import { roundTestInteractive } from './cadenceGate';
import { traitAuras } from '../../engine/traits/dispatch';
import { outnumberCountBonus } from '../../engine/combatFeatures/dispatch';
import { chebyshev } from '../path';
import { rule } from '../../engine/policy';
import type { Combatant } from '../../engine/types';
import type { CascadeStep } from '../pendings';
import type { Get, Set as SetFn } from '../flowTypes';

// ============================================================================================
// Séquence RAW de franchissement de Round, migrée ISO-COMPORTEMENT depuis advanceTurn (corps copiés
// tel quel, `ctx.sink` remplaçant la `tickLine` locale, `ctx.get` le `get`). Les `order` reflètent la
// position d'origine → ordre + RNG préservés (golden byte-pour-byte).
// ============================================================================================

registerCombatHook({
  id: 'end-of-round', // effets périodiques d'États — RNG. endOfRound : récupération du Sonné (Test) +
  // décrément des durées. Dégâts par-round (Empoisonné/En Flammes/Hémorragique) + auto-dissipation
  // (Aveuglé/Assourdi/Surpris) MIGRÉS en données (effects: onRoundEnd), dispatchés par le DISPATCHER UNIQUE.
  phase: 'onRoundEnd',
  order: 10,
  run: ({ get, set, battle, sink }) => {
    for (const c of battle.combatants) {
      endOfRound(c, battleRng()).forEach((l) => sink(l, c)); // machinerie : récupération du Sonné + décrément des durées
      // Dispatch UNIQUE des effets `onRoundEnd` (États : dégâts/dissipation ; Traits/Talents : réactions) —
      // fireTriggers réunit toutes les sources, aucun chemin par-kind. Inerte sans donnée. Pas de réaction
      // de fin de Round pour un combattant HORS COMBAT (un cadavre ne brûle/saigne plus — le dispatcher
      // autorise désormais les effets `on:'self'` sur une cible hors-combat, on filtre donc ici).
      // `deferInteractiveTest` : un Test de RÉCUPÉRATION d'État en DONNÉES (Empoisonné Résistance…) routé
      // pour un héros MANUEL n'est PAS poussé ici (la cascade de fin de Round n'est pas encore ouverte) —
      // il est COLLECTÉ par `collectHeroRoundEndUpkeep`. Ennemi/auto : résolu inline par le dispatcher.
      if (!isOutOfAction(c)) fireTriggers(get, c, 'onRoundEnd', { rng: battleRng(), set, deferInteractiveTest: true }).forEach((l) => sink(l, c));
    }
  },
});
// (Résistance à l'Empoisonné — LDB 16 l.70-72 : retire 1+DR pions sur succès, puis Exténué quand vidé — n'est
//  PLUS un hook impératif : c'est un effet `onRoundEnd` à nœud `test` en DONNÉES (etats.json), résolu par le
//  DISPATCHER UNIQUE — ennemi/auto inline, héros manuel → étape de cascade collectée ci-dessous. Hors combat :
//  inline générique, cf. outOfCombatUpkeep. Plus de `poisonResistValue`/`poisonResistApply` par-nom.)
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
      if (isOutOfAction(c)) continue; // pas de réaction « début de Round » pour un hors-combat (le dispatcher
      for (const line of fireTriggers(get, c, 'onRoundStart', { rng: battleRng(), set })) sink(line, c); // autorise on:'self' sur un hors-combat → filtré ici)
    }
  },
});
// Instable (LDB 85 p.340) MIGRÉ en DONNÉES : trait `instable` effects onRoundEnd — `if engagedAdvantageGap
// > 0` → wounds {engagedAdvantageGap} (perd la différence d'Avantage) puis `if woundsCurrent<=0` → banish
// {narration:'unravel'} (« se délite »). La valeur relationnelle est calculée par le dispatcher. Plus de hook.
// Bestial (LDB 85 p.338) « peur du feu → gagne Brisé » MIGRÉ en données : trait `bestial` effects
// onRoundEnd (if En Flammes ∧ pas déjà Brisé → condition Brisé), dispatché par le dispatcher unique.
registerCombatHook({
  // Auras de combat — machinerie GÉOMÉTRIQUE GÉNÉRIQUE : projette les `passive` de toute `TraitData.aura`
  // (Perturbant : −20 aux Tests à BE mètres, LDB 85 p.341) sur les combattants à portée, accumulés dans
  // `auraMods` (lus par `passiveMods`, kind `etat` non-cumul). Aucun trait nommé en dur ; recalcul/Round.
  id: 'recompute-auras',
  phase: 'onRoundEnd',
  order: 50,
  run: ({ battle }) => {
    for (const c of battle.combatants) c.auraMods = undefined; // recalcul intégral chaque Round
    for (const src of battle.combatants) {
      if (isOutOfAction(src) || !src.pos) continue;
      for (const aura of traitAuras(src.traits)) {
        const rangeM = aura.rangeChar ? bonus(effectiveChar(src, aura.rangeChar)) : (aura.rangeMeters ?? 0);
        for (const c of battle.combatants) {
          if (c.id === src.id || isOutOfAction(c) || !c.pos) continue;
          const sameCamp = c.kind === src.kind;
          if (aura.affects === 'enemies' && sameCamp) continue; // « désoriente ses ENNEMIS » (LDB 85 l.208)
          if (aura.affects === 'allies' && !sameCamp) continue;
          if (chebyshev(src.pos, c.pos) * 2 <= rangeM) c.auraMods = [...(c.auraMods ?? []), ...aura.passive];
        }
      }
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

// Détermination (LDB 17 l.62/64) MIGRÉE sur le système de Durée UNIFIÉ : l'immunité psychologique (2
// Rounds) et l'ignorance des modifs de Critique (1 Round) sont portées par des `ActiveEffect`
// (`psychImmune`/`ignoreCritMods`) à `duration` Rounds, décrémentés/expirés par `tickDurations` (hook
// `end-of-round`) — plus de compteur/flag round-scopé ni de hook de décompte dédié.

// Récupération du Brisé (LDB 16 l.55-59 ; Cœur vaillant LDB 10) MIGRÉE en DONNÉES (etats.json `brise.effects`,
// 2 effets `onRoundEnd`) : (A) « caché hors de vue de tout ennemi » → retire 1 Brisé SANS Test (Condition
// `hiddenFromFoes`) ; (B) Test de Calme gaté « pas Engagé OU Cœur vaillant, ET pions restants », difficulté par
// circonstances (`difficultyBy` : caché → Accessible, ennemi à ≤3 → Très difficile), succès retire 1 + DR, vidé
// → Exténué (l.80). Dispatché par le DISPATCHER UNIQUE (hook `end-of-round`) : ennemi/auto inline, héros manuel
// → étape de cascade collectée par `collectConditionRecoverySteps`. La géométrie d'arène est calculée par
// `recoveryGeometry` (triggeredEffects). Plus de hook `broken-recovery` ni de `brokenContext`/`brokenRecoveryApply`.

// --- Migration ISO-COMPORTEMENT des derniers blocs du franchissement de Round (corps copiés tel quel,
//     `ctx.sink` remplace `tickLine`). Pas de hook suspensif (aucun pending). ---
registerCombatHook({
  id: 'tick-death', // 0 PB → Inconscient (LDB 18 l.28)
  phase: 'onRoundEnd',
  order: 76,
  run: ({ battle, sink }) => { for (const c of battle.combatants) tickDeath(c, battleRng()).forEach((l) => sink(l, c)); },
});
registerCombatHook({
  // Mort par Hémorragique (LDB 16 l.105) : à la fin du Round, 10 %/pion de mourir (jet d100 ≤ 10×pions) ;
  // un double = coagulation (retire 1 pion + Exténué si vidé). RÈGLE DE MORT (comme `tick-death`) : RNG,
  // jouée UNE fois. La coagulation s'applique + se journalise ICI ; la MORT est DIFFÉRÉE (marquée dans
  // `battle.bleedDoomed`) car `resolveRoundBoundary` doit pouvoir SUSPENDRE pour le Destin d'un héros
  // (LDB 17) — on n'annonce donc pas la mort avant la décision de Destin.
  id: 'bleed-death',
  phase: 'onRoundEnd',
  order: 77,
  run: ({ battle, sink }) => {
    const doomed: { id: string; deathLine: string }[] = [];
    for (const c of battle.combatants) {
      if (isOutOfAction(c) || !stacks(c, COND.hemorragique)) continue;
      const bd = bleedDeathRoll(c, battleRng());
      if (bd.died) doomed.push({ id: c.id, deathLine: bd.log[0] }); // annonce différée (après le jet de Destin)
      else bd.log.forEach((l) => sink(l, c)); // coagulation (double) : retrait + éventuel Exténué, visible de suite
    }
    battle.bleedDoomed = doomed.length ? doomed : undefined;
  },
});
registerCombatHook({
  // Noyade et Suffocation (LDB 18 l.424-425) : MACHINERIE environnementale UNIVERSELLE — la règle de mort
  // par manque d'air s'applique à TOUT combattant portant le drapeau d'effet `suffocates` (posé par les
  // sorts d'étouffement / l'environnement — la DONNÉE éditable), `noBreath` immunise. Ne NOMME aucune
  // entité éditable (trait/talent/État) ; comme `tick-death`/`tick-durations`, c'est une règle de l'arène.
  id: 'suffocation-tick',
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
  // 0) Récupération d'États en DONNÉES (Empoisonné Résistance LDB 16 l.70-72 ; plus tard En Flammes/Sonné) —
  //    chaque État porté dont la donnée déclare un `effects: onRoundEnd` à nœud `test` devient une étape
  //    `triggeredTest` INFLUENÇABLE, bâtie depuis la MÊME donnée que la voie inline (ennemi/auto) et hors-combat
  //    (`simpleTriggeredTestStep`). Les DÉGÂTS périodiques ont DÉJÀ été appliqués par le dispatcher (hook
  //    `end-of-round`) ; seul le TEST passe en cascade. En TÊTE (physiologique). Plus de `poisonResist` par-nom.
  steps.push(...collectConditionRecoverySteps(get, c));
  // (Mâchoires d'acier n'est PLUS un Test de fin de Round : c'est un effet `onGainCondition` data-driven,
  //  déclenché à l'acquisition du Sonné — cf. talents.json + brique `combat/triggeredTest`.)
  // (Récupération du Brisé : MIGRÉE en DONNÉES — son retrait « caché » + Exténué SANS-Test sont appliqués
  //  par le hook `end-of-round` (effet A), et son Test de Calme arrive ci-dessus via collectConditionRecoverySteps.)
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

// (La Résistance à l'Empoisonné n'a PLUS d'applier dédié : son étape est de kind `triggeredTest` (générique),
//  résolue par l'applier `triggeredTest` de la brique cadence-aware — la branche `success`/`fail` de la donnée
//  (retire 1+DR, puis Exténué si vidé) y est rejouée. Plus de `poisonResistApply` par-nom.)

// (La récupération du Brisé n'a PLUS d'applier dédié : son étape est de kind `triggeredTest` (générique),
//  résolue par l'applier `triggeredTest` de la brique cadence-aware — la branche `success`/`fail` de la donnée
//  (retire 1+DR, puis Exténué si vidé) y est rejouée. Plus de `brokenRecoveryApply` par-nom.)

registerCascadeApplier('fatigue', (get, set, step, hero) => {
  if (!hero || !step.result) return;
  const line = fatigueApply(hero, step.result.success, step.result.sl);
  syncCombatant(get, set);
  return { journal: line ? [line] : [`${hero.name} tient bon malgré l’effort.`] };
});
