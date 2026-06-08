/**
 * Guérison — Compétence Avancée (Int). Soin de Blessures et arrêt d'Hémorragie.
 * Source : LDB 09-Compétences l.226-243 (skills.json), 16-États l.104-109, 18-Traumatisme l.28.
 * Pur + testé ; ne dépend que de types/conditions (déjà purs).
 */
import { Combatant } from './types';
import { loseWounds, addCondition, removeCondition, hasCondition, recoveredStacks } from './conditions';
import { hasTreatableTrauma, hasSurgeryTrauma } from './trauma';

/** Pions d'un État (local — `stacks` n'est pas exporté par conditions.ts). */
const condStacks = (c: Combatant, name: string) => c.conditions.find((x) => x.name === name)?.value ?? 0;

/** Le combattant possède-t-il la Compétence (Avancée) Guérison ? Sans Augmentation, « aucune idée
 *  de comment soigner » (LDB 09-Compétences l.31, l.226). */
export function hasHealSkill(c: Combatant): boolean {
  return (c.skills ?? []).some((s) => s.name.toLowerCase().startsWith('guérison'));
}

/** Le personnage possède-t-il le Talent Chirurgie (LDB 10) ? Prérequis pour opérer une blessure
 *  chirurgicale (amputation, fracture majeure). */
export function hasSurgerySkill(c: Combatant): boolean {
  return (c.talents ?? []).some((t) => t.name.toLowerCase().startsWith('chirurgie'));
}

/** Cible soignable : blessée (PB perdus) OU porteuse d'≥1 État Hémorragique OU avec une déchirure traitable ;
 *  ni morte ni éjectée. Les cibles Inconscientes/À Terre sont valides (1 PB lève l'inconscience, LDB 18 l.28). */
export function isHealable(c: Combatant): boolean {
  if (c.dead || c.outOfRencontre) return false;
  return c.wounds.current < c.wounds.max || condStacks(c, 'Hémorragique') > 0 || hasTreatableTrauma(c) || hasSurgeryTrauma(c);
}

export type HealMode = 'wounds' | 'bleed' | 'trauma' | 'surgery';

/** Modes disponibles pour soigner `target`, compte tenu de la limite « 1 soin de Blessures / rencontre ».
 *  Le mode `trauma` (accélérer la convalescence d'une déchirure, LDB 18 l.317) est hors-combat — les
 *  consommateurs en combat le filtrent. */
export function availableHealModes(target: Combatant): HealMode[] {
  const modes: HealMode[] = [];
  if (target.wounds.current < target.wounds.max && !target.soinRencontreUtilise) modes.push('wounds');
  if (condStacks(target, 'Hémorragique') > 0) modes.push('bleed');
  if (hasTreatableTrauma(target)) modes.push('trauma');
  if (hasSurgeryTrauma(target)) modes.push('surgery'); // gate Talent Chirurgie côté action
  return modes;
}

/** Cibles soignables atteignables par `healer`. En combat : soi + adjacents (Chebyshev ≤ 1).
 *  Hors combat : tout le `pool`. */
export function healableTargets(healer: Combatant, pool: Combatant[], opts: { adjacency: boolean }): Combatant[] {
  return pool.filter((t) => {
    if (!isHealable(t)) return false;
    if (!opts.adjacency || t.id === healer.id) return true;
    if (!healer.pos || !t.pos) return false;
    return Math.max(Math.abs(healer.pos.x - t.pos.x), Math.abs(healer.pos.y - t.pos.y)) <= 1;
  });
}

/** Soin de Blessures (LDB 09 l.233) : succès ⇒ BI+DR (plancher 0) ; échec ⇒ si BI+DR<0, perte de
 *  |BI+DR| PB (sinon 0). Renvoie le delta de PB (positif = soin, négatif = dégât). */
export function healWoundsDelta(intBonus: number, dr: number, success: boolean): number {
  const total = intBonus + dr;
  if (success) return Math.max(0, total);
  return total < 0 ? total : 0;
}

/** Arrêt d'Hémorragie (LDB 09 l.235 / 16-États l.107-109) : succès ⇒ retire 1+DR pions (borné) ;
 *  tous retirés ⇒ Exténué. Échec ⇒ rien. */
export function stopBleedOutcome(dr: number, stacks: number, success: boolean): { removed: number; gainExtenue: boolean } {
  const removed = recoveredStacks(dr, stacks, success); // « 1 + DR » borné, partagé avec Empêtré/En flammes
  return { removed, gainExtenue: removed > 0 && removed >= stacks };
}

/** Applique un soin de Blessures (mutation). Lève l'Inconscient et remet l'horloge de mort à zéro
 *  quand on repasse > 0 PB (LDB 18 l.28). Renvoie un journal. */
export function applyHealWounds(target: Combatant, delta: number): string[] {
  if (delta < 0) {
    const lost = loseWounds(target, -delta); // perte centralisée (−Avantage + À Terre à 0)
    return [`${target.name} : le soin tourne mal — ${lost} Blessure(s) en plus.`];
  }
  if (delta === 0) return [`${target.name} : le soin n'apporte rien.`];
  const before = target.wounds.current;
  target.wounds.current = Math.min(target.wounds.max, target.wounds.current + delta);
  target.soinRencontreUtilise = true; // a bénéficié de SON soin de cette rencontre (LDB 09 l.233)
  target.woundDressed = true; // matériel stérile : « aucune Infection » suite à la blessure (LDB 09 / 18 l.382)
  const log = [`${target.name} : +${target.wounds.current - before} PB (${target.wounds.current}/${target.wounds.max}).`];
  if (target.wounds.current > 0 && hasCondition(target, 'Inconscient')) {
    removeCondition(target, 'Inconscient', condStacks(target, 'Inconscient')); // reprend connaissance (LDB 18 l.28)
    log.push(`${target.name} reprend connaissance.`);
  }
  if (target.wounds.current > 0) target.roundsAtZero = 0;
  return log;
}

/** Applique l'arrêt d'Hémorragie (mutation). `dr` = DR du Test réussi. */
export function applyStopBleed(target: Combatant, dr: number): string[] {
  const { removed, gainExtenue } = stopBleedOutcome(dr, condStacks(target, 'Hémorragique'), true);
  if (removed <= 0) return [`${target.name} : l'hémorragie ne cède pas.`];
  removeCondition(target, 'Hémorragique', removed);
  const log = [`${target.name} : ${removed} État(s) Hémorragique stoppé(s).`];
  if (gainExtenue) {
    addCondition(target, 'Exténué');
    log.push(`${target.name} est Exténué (après l'arrêt de l'hémorragie, LDB 16 l.109).`);
  }
  return log;
}
