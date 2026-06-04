/**
 * États (conditions) — Livre de base, chapitre « États ».
 * Gestion minimale pour le combat tactique : ajout, empilement, retrait.
 */
import { Combatant, ConditionInstance } from './types';

export function addCondition(c: Combatant, name: string, value = 1): void {
  const existing = c.conditions.find((x) => x.name === name);
  if (existing) existing.value += value;
  else c.conditions.push({ name, value });
}

export function removeCondition(c: Combatant, name: string, value = 1): void {
  const existing = c.conditions.find((x) => x.name === name);
  if (!existing) return;
  existing.value -= value;
  if (existing.value <= 0) c.conditions = c.conditions.filter((x) => x.name !== name);
}

export function hasCondition(c: Combatant, name: string): boolean {
  return c.conditions.some((x) => x.name === name);
}

/**
 * Fin de Round : certains États se dissipent (Assourdi, Étourdi/Sonné) et
 * l'Hémorragique inflige 1 Blessure par point. Retourne un journal.
 */
export function endOfRound(c: Combatant): string[] {
  const log: string[] = [];
  const bleed = c.conditions.find((x) => x.name === 'Hémorragique');
  if (bleed) {
    c.wounds.current = Math.max(0, c.wounds.current - bleed.value);
    log.push(`${c.name} subit ${bleed.value} Blessure(s) (Hémorragique).`);
  }
  for (const n of ['Assourdi', 'Sonné', 'Étourdi']) {
    if (hasCondition(c, n)) {
      removeCondition(c, n, 1);
      log.push(`${c.name} : un État ${n} se dissipe.`);
    }
  }
  return log;
}

export function isOutOfAction(c: Combatant): boolean {
  return c.wounds.current <= 0 || hasCondition(c, 'Inconscient');
}
