/**
 * Noyade et Suffocation (LDB 18 l.424-425) : « si vous n'avez pas eu le temps de vous préparer et
 * que vous vous retrouvez brutalement privé d'air, vous suffoquez immédiatement. Vous perdez
 * 1 Point de blessure par Round que vous passez à suffoquer. Si vos Points de blessure passent
 * à 0, gagnez immédiatement l'État Inconscient. Après cela, et au bout d'un nombre de Rounds
 * égal à votre Bonus d'Endurance, vous mourez par suffocation ou par noyade. »
 *
 * Le drapeau `suffocates` est porté par un ActiveEffect (sorts : Ombres étrangleuses,
 * Transmutation de Chamon ; environnement futur : noyade). `noBreath` (Bénédiction de Souffle,
 * LDB 41 : « n'a pas besoin de respirer et ignore les règles de suffocation ») immunise.
 * La MORT passe par le canal mort-lente existant (`inDeathCondition` lit `suffocationCountdown`)
 * → un héros à Destin est suspendu (pendingFateSave) comme pour toute mort lente.
 *
 * Rétention de souffle (LDB 18 l.345) : « si vous êtes suffisamment préparé, vous pouvez retenir
 * votre souffle pendant un nombre de secondes égal à votre Bonus d'Endurance x 10 sans avoir à
 * effectuer un Test. À l'inverse, si vous n'avez pas eu le temps de vous préparer et que vous vous
 * retrouvez brutalement privé d'air, vous suffoquez immédiatement. » Une plongée ANTICIPÉE appelle
 * `prepareBreathHold` (pose `breathHoldSeconds = BE×10`) : tant que ce crédit dure, la suffocation ne
 * fait perdre aucune Blessure. Le crédit est décompté par Round via `SECONDS_PER_ROUND` — la borne du
 * canon lui-même (BE×10 s de souffle ↔ BE Rounds de survie une fois inconscient, l.425) fixe 1 Round
 * ≈ 10 s, aucun chiffre inventé. Privé d'air brutalement (`breathHoldSeconds` absent) = suffocation immédiate.
 */
import type { Combatant } from './types';
import { hasActiveFlag } from './activeFlags';
import { addCondition, hasCondition, loseWounds } from './conditions';
import { bonus, effectiveChar } from './characteristics';

/** Durée d'un Round de combat en secondes, DÉRIVÉE du canon (LDB 18 : BE×10 s de souffle ↔ BE Rounds
 *  de survie inconscient) → 1 Round ≈ 10 s. Utilisée pour décompter la rétention de souffle. */
export const SECONDS_PER_ROUND = 10;

/** Souffle retenable sans Test (LDB 18 l.345) : Bonus d'Endurance × 10 secondes. Pur. */
export function breathHoldSeconds(c: Combatant): number {
  return Math.max(0, bonus(effectiveChar(c, 'E'))) * 10;
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
  if (!hasActiveFlag(c, 'suffocates') || hasActiveFlag(c, 'noBreath')) {
    // L'air revient (effet expiré / immunité) : on arrête de mourir ET on récupère son souffle.
    if (c.suffocationCountdown != null) delete c.suffocationCountdown;
    if (c.breathHoldSeconds != null) delete c.breathHoldSeconds;
    return [];
  }
  // Rétention de souffle (l.345) : tant que le crédit dure, aucune Blessure perdue — on l'entame.
  if ((c.breathHoldSeconds ?? 0) > 0) {
    c.breathHoldSeconds = Math.max(0, c.breathHoldSeconds! - SECONDS_PER_ROUND);
    return [c.breathHoldSeconds > 0
      ? `${c.name} retient son souffle (${c.breathHoldSeconds} s d'air).`
      : `${c.name} n'a plus d'air — la suffocation commence.`];
  }
  const lines: string[] = [];
  const be = Math.max(1, bonus(effectiveChar(c, 'E')));
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
