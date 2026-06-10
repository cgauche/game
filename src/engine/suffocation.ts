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
 * (La rétention de souffle préparée — BE × 10 secondes sans Test — est hors échelle tactique.)
 */
import type { Combatant } from './types';
import { hasActiveFlag } from './activeFlags';
import { addCondition, hasCondition, loseWounds } from './conditions';
import { bonus, effectiveChar } from './characteristics';

/** Tick de fin de Round d'un combattant qui suffoque. Mute `c`, retourne le journal. */
export function suffocationTick(c: Combatant): string[] {
  if (c.dead || c.outOfRencontre) return [];
  if (!hasActiveFlag(c, 'suffocates') || hasActiveFlag(c, 'noBreath')) {
    // L'air revient (effet expiré / immunité) : on arrête de mourir.
    if (c.suffocationCountdown != null) delete c.suffocationCountdown;
    return [];
  }
  const lines: string[] = [];
  const be = Math.max(1, bonus(effectiveChar(c, 'E')));
  if (c.wounds.current > 0) {
    loseWounds(c, 1);
    lines.push(`${c.name} suffoque (−1 PB).`);
    if (c.wounds.current <= 0) {
      if (!hasCondition(c, 'Inconscient')) addCondition(c, 'Inconscient');
      c.suffocationCountdown = be;
      lines.push(`${c.name} s'évanouit, privé d'air (Inconscient) — mort dans ${be} Round(s).`);
    }
    return lines;
  }
  // Déjà à 0 PB : décompte vers la mort (BE Rounds après l'Inconscient, LDB 18 l.425).
  if (c.suffocationCountdown == null) {
    if (!hasCondition(c, 'Inconscient')) addCondition(c, 'Inconscient');
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
