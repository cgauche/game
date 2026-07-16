/**
 * Noyade et Suffocation (LDB 18 l.424-425) : « si vous n'avez pas eu le temps de vous préparer et
 * que vous vous retrouvez brutalement privé d'air, vous suffoquez immédiatement. Vous perdez
 * 1 Point de blessure par Round que vous passez à suffoquer. Si vos Points de blessure passent
 * à 0, gagnez immédiatement l'État Inconscient. Après cela, et au bout d'un nombre de Rounds
 * égal à votre Bonus d'Endurance, vous mourez par suffocation ou par noyade. »
 *
 * Le drapeau `suffocates` est porté par un ActiveEffect (sorts : Ombres étrangleuses,
 * Transmutation de Chamon) OU dérivé POSITIONNELLEMENT (`offTerrainSuffocates`, `engine/ops.ts` —
 * Créature marine hors de l'eau, « sinon elles se mettent à suffoquer », MDG 16 l.19). `noBreath`
 * (Bénédiction de Souffle, LDB 41 : « n'a pas besoin de respirer et ignore les règles de
 * suffocation ») immunise. La MORT passe par le canal mort-lente existant (`inDeathCondition` lit
 * `suffocationCountdown`) → un héros à Destin est suspendu (pendingFateSave) comme pour toute mort
 * lente.
 *
 * Rétention de souffle (LDB 18 l.345) : « si vous êtes suffisamment préparé, vous pouvez retenir
 * votre souffle pendant un nombre de secondes égal à votre Bonus d'Endurance x 10 sans avoir à
 * effectuer un Test. À l'inverse, si vous n'avez pas eu le temps de vous préparer et que vous vous
 * retrouvez brutalement privé d'air, vous suffoquez immédiatement. » Une plongée ANTICIPÉE appelle
 * `prepareBreathHold` (pose `breathHoldSeconds = BE×10`) : tant que ce crédit dure, la suffocation ne
 * fait perdre aucune Blessure. Le crédit est décompté par Round via la règle `combat-round-seconds`
 * (LDB 13 l.13 — « c'est le MJ qui décide » de la durée d'un Round ; hypothèse de calibrage 10 s,
 * non RAW). Privé d'air brutalement (`breathHoldSeconds` absent) = suffocation immédiate.
 *
 * Contre-mesure « aspergée d'eau » (Créature marine, MDG 16 l.19 : « elles doivent être
 * régulièrement aspergées d'eau, sinon elles se mettent à suffoquer ») — le RAW nomme le geste mais
 * ne chiffre AUCUNE mécanique (pas de Test, pas de coût, pas de cadence en Rounds) : `c.wateredThisRound`
 * est un drapeau MAISON (interface Action/consommable à brancher — hors périmètre #477) qui immunise
 * le Round où il est posé, puis se consomme (« régulièrement » = à reposer chaque Round pour rester
 * immunisé).
 */
import type { Combatant } from './types';
import { hasActiveFlag } from './activeFlags';
import { addCondition, hasCondition, loseWounds } from './conditions';
import { bonus, effectiveChar } from './characteristics';
import { rule } from './policy';
import { offTerrainSuffocates } from './ops';

/** Durée d'un Round de combat en secondes — LDB 13 l.13 : « c'est le MJ qui décide » ; hypothèse de
 *  calibrage maison (règle `combat-round-seconds`), PAS une certitude canon. Utilisée pour décompter
 *  la rétention de souffle. */
const secondsPerRound = (): number => Number(rule('combat-round-seconds'));

/** Souffle retenable sans Test (LDB 18 l.345) : Bonus d'Endurance × 10 secondes. Pur. */
export function breathHoldSeconds(c: Combatant): number {
  return Math.max(0, bonus(effectiveChar(c, 'endurance'))) * 10;
}

/** Anticipation d'une privation d'air (plongée volontaire, apnée préparée) : pose le crédit de souffle
 *  BE×10 s (LDB 18 l.345). À appeler AVANT que le combattant se retrouve privé d'air pour qu'il ne
 *  suffoque pas immédiatement. Mute `c`. Sans cet appel, la privation brutale suffoque tout de suite. */
export function prepareBreathHold(c: Combatant): void {
  c.breathHoldSeconds = breathHoldSeconds(c);
}

/** Tick de fin de Round d'un combattant qui suffoque. Mute `c`, retourne le journal. */
export function suffocationTick(c: Combatant): string[] {
  if (c.dead || c.outOfRencontre) return [];
  // Contre-mesure MAISON « aspergée d'eau » (MDG 16 l.19) : immunise CE Round, puis se consomme —
  // à reposer chaque Round pour rester immunisé (« régulièrement »).
  const wateredThisRound = !!c.wateredThisRound;
  if (wateredThisRound) delete c.wateredThisRound;
  const marineSuffocating = offTerrainSuffocates(c) && !wateredThisRound;
  if ((!hasActiveFlag(c, 'suffocates') && !marineSuffocating) || hasActiveFlag(c, 'noBreath')) {
    // L'air revient (effet expiré / immunité / de retour dans l'eau / aspergée) : on arrête de mourir
    // ET on récupère son souffle.
    if (c.suffocationCountdown != null) delete c.suffocationCountdown;
    if (c.breathHoldSeconds != null) delete c.breathHoldSeconds;
    return [];
  }
  // Rétention de souffle (l.345) : tant que le crédit dure, aucune Blessure perdue — on l'entame.
  if ((c.breathHoldSeconds ?? 0) > 0) {
    c.breathHoldSeconds = Math.max(0, c.breathHoldSeconds! - secondsPerRound());
    return [c.breathHoldSeconds > 0
      ? `${c.name} retient son souffle (${c.breathHoldSeconds} s d'air).`
      : `${c.name} n'a plus d'air — la suffocation commence.`];
  }
  const lines: string[] = [];
  const be = Math.max(1, bonus(effectiveChar(c, 'endurance')));
  if (c.wounds.current > 0) {
    loseWounds(c, 1);
    lines.push(`${c.name} suffoque (−1 PB).`);
    if (c.wounds.current <= 0) {
      if (!hasCondition(c, 'inconscient')) addCondition(c, 'inconscient');
      c.suffocationCountdown = be;
      lines.push(`${c.name} s'évanouit, privé d'air (Inconscient) — mort dans ${be} Round(s).`);
    }
    return lines;
  }
  // Déjà à 0 PB : décompte vers la mort (BE Rounds après l'Inconscient, LDB 18 l.425).
  if (c.suffocationCountdown == null) {
    if (!hasCondition(c, 'inconscient')) addCondition(c, 'inconscient');
    c.suffocationCountdown = be;
    lines.push(`${c.name} suffoque, inconscient — mort dans ${be} Round(s).`);
    return lines;
  }
  c.suffocationCountdown -= 1;
  lines.push(c.suffocationCountdown <= 0
    ? `${c.name} cesse de respirer — la mort par suffocation le prend.`
    : `${c.name} étouffe — mort dans ${c.suffocationCountdown} Round(s).`);
  return lines;
}
