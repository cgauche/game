/**
 * Registre des créatures — SOURCE UNIQUE dérivée des fichiers `defs/<Nom>.ts` (auto-collectés
 * par le générateur). Tout le routage par nom (plan, espèce quad/ailée) et les tables de props
 * en découlent : plus aucun tableau central à re-maintenir.
 */
import type { QuadProps } from '../quadruped/quadSkeleton';
import type { CreatureDef } from './types';
import { norm } from '../../../lib/normalize';
import { CREATURES } from './_registry.generated';

export { CREATURES };
export type { CreatureDef, CreatureBodyPlan } from './types';

/** Définition dont la CLÉ (nom) ou un ALIAS matche le nom donné (limite de mot). PUR. */
function matchIn(defs: CreatureDef[], name: string): CreatureDef | undefined {
  const n = norm(name);
  for (const d of defs) {
    for (const pat of [norm(d.name), ...(d.aliases ?? [])]) {
      if (new RegExp(`\\b${pat}\\b`).test(n)) return d;
    }
  }
  return undefined;
}

const QUAD = CREATURES.filter((c) => c.plan === 'quadruped');
const WING = CREATURES.filter((c) => c.plan === 'winged');

/** Tables de props de rendu par espèce — dérivées des fichiers defs. */
export const QUAD_SPECIES: Record<string, QuadProps> = Object.fromEntries(QUAD.map((c) => [c.name, c.quad!]));
export const WINGED_SPECIES: Record<string, QuadProps> = Object.fromEntries(WING.map((c) => [c.name, c.quad!]));

export const quadSpeciesNames = (): string[] => QUAD.map((c) => c.name);
export const wingedSpeciesNames = (): string[] => WING.map((c) => c.name);

/** Nom de créature → espèce quadrupède (clé/alias), ou undefined si aucun quad ne matche. */
export function quadSpeciesMatch(name: string): string | undefined { return matchIn(QUAD, name)?.name; }
/** Nom de créature → espèce ailée (clé/alias), ou undefined si aucun ailé ne matche. */
export function wingSpeciesMatch(name: string): string | undefined { return matchIn(WING, name)?.name; }
