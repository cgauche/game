/**
 * Hooks de FRANCHISSEMENT DE ROUND (`roundBoundary`) enregistrés sur la couture `combatHooks`. Module
 * FEUILLE chargé par effet de bord depuis combatFlow (comme restFlow/travelFlow peuplent cascadeAppliers) :
 * la séquence de fin de Round (anciennement ~15 boucles inline d'`advanceTurn`) vit ICI, chaque effet
 * étant un hook ordonné par `order` (l'ordre RAW est encodé par les valeurs). Les helpers sont appelés
 * dans les closures `run()` (au RUNTIME, quand `runCombatHooks` se déclenche) → pas de souci de cycle à
 * l'import. Le golden `roundBoundary.golden.test.ts` fige l'ordre + les tirages RNG byte-pour-byte.
 */
import { registerCombatHook } from '../combatHooks';
import { battleRng } from '../battleRng';
import { rollTest } from '../../engine/tests';
import { testValue } from '../../engine/skills';
import { bonus, effectiveChar, refreshWounds } from '../../engine/characteristics';
import { addCondition, isOutOfAction, COND, tickDeath, stacks, removeCondition, endOfRound, loseWounds, hasCondition } from '../../engine/conditions';
import { suffocationTick } from '../../engine/suffocation';
import { clearPsychOf, calmeValue } from '../../engine/psychology';
import { zonesRoundTick } from '../zones';
import { purgeExpiredSummons } from '../summonFlow';
import { fireTriggers } from '../triggeredEffects';
import { isUnstable, isBestial, hasPerturbingAura } from '../../engine/traits/dispatch';
import { outnumberCountBonus, hasStunSave, hasBraveheart } from '../../engine/combatFeatures/dispatch';
import { chebyshev } from '../path';
import { isEngaged } from '../../engine/engagement';
import { lineOfSightCover } from '../lineOfSight';
import { smokeOf } from '../combatGeometry';
import type { Combatant, Difficulty } from '../../engine/types';
import type { Get } from '../flowTypes';

// ============================================================================================
// Séquence RAW de franchissement de Round, migrée ISO-COMPORTEMENT depuis advanceTurn (corps copiés
// tel quel, `ctx.sink` remplaçant la `tickLine` locale, `ctx.get` le `get`). Les `order` reflètent la
// position d'origine → ordre + RNG préservés (golden byte-pour-byte).
// ============================================================================================

registerCombatHook({
  id: 'end-of-round', // dégâts/effets périodiques d'États (Empoisonné, En flammes, Hémorragique…) — RNG
  phase: 'roundBoundary',
  order: 10,
  run: ({ battle, sink }) => { for (const c of battle.combatants) endOfRound(c, battleRng()).forEach((l) => sink(l, c)); },
});
registerCombatHook({
  id: 'refresh-wounds', // dissipation d'un buff F/E/FM → recale les Blessures (LDB 85)
  phase: 'roundBoundary',
  order: 20,
  run: ({ battle }) => { for (const c of battle.combatants) refreshWounds(c); },
});
registerCombatHook({
  id: 'fire-round-start-triggers', // effets « début de Round » authorés (Régénération…) — dispatcher générique (RNG)
  phase: 'roundBoundary',
  order: 25,
  run: ({ get, battle, sink }) => {
    for (const c of battle.combatants) {
      if (c.dead || c.outOfRencontre) continue;
      for (const line of fireTriggers(get, c, 'onRoundStart', { rng: battleRng() })) sink(line, c);
    }
  },
});
registerCombatHook({
  id: 'unstable', // Instable (LDB 85 p.340) : Engagé avec un Avantage SUPÉRIEUR → perd la différence en PB ; à 0, « meurt »
  phase: 'roundBoundary',
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
  phase: 'roundBoundary',
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
  phase: 'roundBoundary',
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
  phase: 'roundBoundary',
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
registerCombatHook({
  id: 'steel-jaw', // Mâchoires d'acier (LDB 10) : Test de Résistance → retire 1 + DR États Sonné (RNG)
  phase: 'roundBoundary',
  order: 60,
  run: ({ battle, sink }) => {
    for (const c of battle.combatants) {
      if (isOutOfAction(c) || !hasStunSave(c) || !stacks(c, COND.sonne)) continue;
      const t = rollTest(testValue(c, 'Résistance'), 'intermediaire', battleRng());
      if (t.success) {
        const n = Math.min(stacks(c, COND.sonne), 1 + Math.max(0, t.sl));
        removeCondition(c, COND.sonne, n);
        sink(`${c.name} secoue la tête (Mâchoires d'acier) : ${n} État(s) Sonné retiré(s).`, c);
      }
    }
  },
});

// Détermination (LDB 17 l.62/64) : décomptes de fin de Round (flags, RNG-free).
registerCombatHook({
  id: 'determination-ignore-crit-expire', // « ignorer modifs de critique » expire au début du prochain Round
  phase: 'roundBoundary',
  order: 70,
  run: ({ battle }) => { for (const c of battle.combatants) if (c.ignoreCritMods) c.ignoreCritMods = false; },
});
registerCombatHook({
  id: 'determination-psych-immune-tick', // l'immunité psychologique décompte 1 Round
  phase: 'roundBoundary',
  order: 72,
  run: ({ battle }) => { for (const c of battle.combatants) if (c.psychImmuneRoundsLeft) c.psychImmuneRoundsLeft -= 1; },
});

/**
 * Récupération du Brisé en fin de Round (LDB 16 l.57-59 ; Cœur vaillant LDB 10). Déplacé ICI depuis
 * combatFlow (qui le ré-exporte pour `broken-recovery.test`). Émet chaque ligne via `sink(line, c)`.
 */
export function brokenRecovery(get: Get, sink: (line: string, c: Combatant) => void): void {
  const battle = get().battle;
  const scene = get().scene;
  if (!battle) return;
  for (const c of battle.combatants) {
    if (!stacks(c, COND.brise) || isOutOfAction(c) || !c.pos) continue;
    const enemies = battle.combatants.filter((e) => e.kind !== c.kind && !isOutOfAction(e) && e.pos);
    const hidden = !!scene && enemies.length > 0 && enemies.every((e) => lineOfSightCover(scene, e.pos!, c.pos!, [], smokeOf(battle)).blocked);
    if (hidden) { removeCondition(c, COND.brise, 1); sink(`${c.name} est resté caché hors de vue : retire 1 État Brisé.`, c); }
    // Récupération par Test de Calme : seulement si pas Engagé (l.57) — sauf Cœur vaillant
    // (LDB 10 : Test de Calme en fin de Round, sans restriction d'Engagement) — et qu'il reste du Brisé.
    if ((!isEngaged(c) || hasBraveheart(c)) && stacks(c, COND.brise)) {
      const nearest = enemies.length ? Math.min(...enemies.map((e) => chebyshev(c.pos!, e.pos!))) : Infinity;
      const diff: Difficulty = hidden ? 'accessible' : nearest <= 3 ? 'tresDifficile' : 'intermediaire';
      const t = rollTest(calmeValue(c), diff, battleRng());
      if (t.success) {
        const removed = Math.min(stacks(c, COND.brise), 1 + Math.max(0, t.sl));
        removeCondition(c, COND.brise, removed);
        sink(`${c.name} se ressaisit : retire ${removed} État(s) Brisé (Test de Calme réussi).`, c);
      } else {
        sink(`${c.name} reste Brisé (Test de Calme raté).`, c);
      }
    }
    // « Une fois que vous n'avez plus d'États Brisé, vous gagnez 1 État Exténué » (LDB 16 l.80).
    if (!stacks(c, COND.brise)) { addCondition(c, COND.extenue); sink(`${c.name} est Exténué (après s'être ressaisi).`, c); }
  }
}
registerCombatHook({
  id: 'broken-recovery', // récupération du Brisé en fin de Round (LDB 16 l.57-59) — RNG (Test de Calme)
  phase: 'roundBoundary',
  order: 74,
  run: ({ get, sink }) => brokenRecovery(get, sink),
});

// --- Migration ISO-COMPORTEMENT des derniers blocs du franchissement de Round (corps copiés tel quel,
//     `ctx.sink` remplace `tickLine`). Pas de hook suspensif (aucun pending). ---
registerCombatHook({
  id: 'tick-death', // 0 PB → Inconscient (LDB 18 l.28)
  phase: 'roundBoundary',
  order: 76,
  run: ({ battle, sink }) => { for (const c of battle.combatants) tickDeath(c, battleRng()).forEach((l) => sink(l, c)); },
});
registerCombatHook({
  id: 'suffocation-tick', // Noyade et Suffocation (LDB 18 l.424-425)
  phase: 'roundBoundary',
  order: 78,
  run: ({ battle, sink }) => { for (const c of battle.combatants) suffocationTick(c).forEach((l) => sink(l, c)); },
});
registerCombatHook({
  id: 'zones-round-tick', // zones perRound (Grands feux d'U'Zhul, LDB 47 : « au début d'un Round »)
  phase: 'roundBoundary',
  order: 79,
  run: ({ battle, sink }) => { zonesRoundTick(battle.zones, battle.combatants, battleRng()).forEach((t) => sink(t.line, t.combatant)); },
});
registerCombatHook({
  id: 'clear-psych-of-dead', // effets psy d'une créature morte → fin (catch-all toutes causes de mort)
  phase: 'roundBoundary',
  order: 79.3,
  run: ({ battle }) => { for (const c of battle.combatants) if (isOutOfAction(c)) clearPsychOf(battle.combatants, c.id); },
});
registerCombatHook({
  id: 'purge-expired-summons', // invocations à durée écoulée OU lanceur tombé ; round = battle.round+1 (set après le dispatch)
  phase: 'roundBoundary',
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
registerCombatHook({
  id: 'se-fatiguer',
  phase: 'roundBoundary',
  order: 80, // après tous les effets de Round RAW, avant la révélation héros
  enabledIf: 'combat-se-fatiguer',
  run: ({ battle, sink }) => {
    for (const c of battle.combatants) {
      if (isOutOfAction(c)) continue;
      const seuil = Math.max(1, bonus(effectiveChar(c, 'E')));
      c.effortRounds = (c.effortRounds ?? 0) + 1;
      if (c.effortRounds < seuil) continue;
      const t = rollTest(testValue(c, 'Résistance'), 'intermediaire', battleRng());
      if (t.success) {
        c.effortRounds = Math.max(0, c.effortRounds - (1 + Math.max(0, t.sl)));
      } else {
        addCondition(c, COND.extenue);
        c.effortRounds = 0;
        sink(`${c.name} s'épuise (effort soutenu) : Exténué.`, c);
      }
    }
  },
});
