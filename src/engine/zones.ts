/**
 * Effets de ZONE persistante (Jalon 2.6 L11) — partie PURE : l'effet appliqué à un combattant
 * qui traverse (`onCross` — Mur de feu, LDB 47) ou stationne dans (`perRound` — Grands feux
 * d'U'Zhul, LDB 47) une zone. La géométrie (cases, TTL, Ligne de Vue) vit dans `state/zones.ts`
 * (elle dépend de la grille de bataille).
 *
 * Mitigation des Dégâts : BE + PA du corps, sauf drapeaux — même règle que les attaques de
 * zone du Trait Souffle (LDB 85, cf. applyAreaAttack).
 */
import type { Combatant } from './types';
import { Formula, resolveFormula } from './ops';
import { RNG, defaultRNG } from './dice';
import { bonus, effectiveChar } from './characteristics';
import { addCondition, loseWounds, applyZeroWounds } from './conditions';

export interface ZoneEffect {
  /** Dégâts : `amount` résolu contre le LANCEUR (« votre Bonus de Force Mentale ») — repli : la victime. */
  damage?: { amount: Formula; ignoreAP?: boolean; ignoreTB?: boolean };
  /** Soin : `amount` rendu à qui stationne dans la zone (Sang de la Terre, LDB 48 — Vie : « guérissent
   *  d'un nombre de Blessures égal à votre BFM au début de chaque round »). Résolu contre le lanceur. */
  heal?: { amount: Formula };
  /** États infligés (« gagne 1 État En flammes »). */
  conditions?: { name: string; value?: number }[];
}

/** Applique l'effet d'une zone `label` à `victim`. Mute la victime, retourne le journal. */
export function applyZoneEffect(
  victim: Combatant,
  label: string,
  eff: ZoneEffect,
  ref: Combatant | undefined,
  rng: RNG = defaultRNG,
): string[] {
  const lines: string[] = [];
  if (eff.damage) {
    const raw = Math.max(0, resolveFormula(eff.damage.amount, ref ?? victim, rng));
    const tb = eff.damage.ignoreTB ? 0 : bonus(effectiveChar(victim, 'E'));
    const pa = eff.damage.ignoreAP ? 0 : Math.max(0, victim.armour.corps ?? 0);
    const wl = Math.max(0, raw - tb - pa);
    if (wl > 0) {
      loseWounds(victim, wl);
      lines.push(`${victim.name} subit ${wl} Blessure(s)${eff.damage.ignoreAP ? ' (ignore PA)' : ''} (${label}).`);
      if (victim.wounds.current <= 0) applyZeroWounds(victim);
    } else {
      lines.push(`${victim.name} encaisse sans dommage (${label}).`);
    }
  }
  if (eff.heal) {
    const h = Math.max(0, resolveFormula(eff.heal.amount, ref ?? victim, rng));
    if (h > 0 && victim.wounds.current < victim.wounds.max) {
      victim.wounds.current = Math.min(victim.wounds.max, victim.wounds.current + h);
      lines.push(`${victim.name} regagne ${h} Blessure(s) (${label}).`);
    }
  }
  for (const c of eff.conditions ?? []) {
    addCondition(victim, c.name, c.value ?? 1);
    lines.push(`${victim.name} reçoit ${c.value ?? 1} État ${c.name} (${label}).`);
  }
  return lines;
}
