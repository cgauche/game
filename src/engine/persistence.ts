/**
 * Persistance des conséquences de combat — ce qui suit le héros d'un combat au suivant.
 * Les États persistants sont sourcés du Livre de base (16-États.md) : ils exigent repos,
 * Compétence Guérison, Sort/Prière ou Tests hors combat — par opposition aux états de combat
 * transitoires (Surpris/À Terre/Sonné/Aveuglé/Assourdi/Empêtré), retirés en/par le combat.
 * La récupération elle-même (temps, repos, Guérison, Chirurgie) reste hors périmètre (Jalon 5).
 */
import { Combatant, ConditionInstance, Trauma } from './types';

/** États qui persistent après le combat (LDB 16-États : Brisé l.57, Empoisonné l.70,
 *  En flammes l.77, Exténué l.91, Hémorragique l.107, Inconscient l.116). */
export const PERSISTENT_CONDITIONS: ReadonlySet<string> = new Set([
  'Brisé', 'Empoisonné', 'En flammes', 'Exténué', 'Hémorragique', 'Inconscient',
]);

/** État persistant d'un combattant à reporter vers le groupe (fin de combat) ou à ré-importer
 *  (combat suivant). N'inclut QUE ce qui survit hors combat ; le transitoire est omis. Copie défensive. */
export function carryOverState(c: Combatant): {
  wounds: { current: number; max: number };
  conditions: ConditionInstance[];
  criticalWounds: number;
  roundsAtZero: number;
  dead: boolean;
  outOfRencontre: boolean;
  traumas: Trauma[];
} {
  return {
    wounds: { current: c.wounds.current, max: c.wounds.max },
    conditions: c.conditions.filter((x) => PERSISTENT_CONDITIONS.has(x.name)).map((x) => ({ ...x })),
    criticalWounds: c.criticalWounds ?? 0,
    roundsAtZero: c.roundsAtZero ?? 0,
    dead: c.dead === true,
    outOfRencontre: c.outOfRencontre === true,
    traumas: (c.traumas ?? []).map((t) => ({ ...t })),
  };
}

/** États persistants seuls (pour le carry-in au spawn d'un combat). Copie défensive. */
export function persistentConditions(c: Combatant): ConditionInstance[] {
  return c.conditions.filter((x) => PERSISTENT_CONDITIONS.has(x.name)).map((x) => ({ ...x }));
}
