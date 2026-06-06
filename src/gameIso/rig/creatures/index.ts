/**
 * Registre des créatures — SOURCE UNIQUE dérivée des fichiers `defs/<Nom>.ts` (auto-collectés
 * par le générateur). Tout le routage par nom (plan, espèce quad/ailée) et les tables de props
 * en découlent : plus aucun tableau central à re-maintenir.
 */
import type { QuadProps } from '../quadruped/quadSkeleton';
import type { CreatureDef, BipedConfig } from './types';
import { norm } from '../../../lib/normalize';
import { CREATURES } from './_registry.generated';

export { CREATURES };
export type { CreatureDef, CreatureBodyPlan, BipedConfig } from './types';

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
const BIPED = CREATURES.filter((c) => c.plan === 'biped');

/** Config d'espèce bipède (career/monster/sex/parts/colors) par NOM d'espèce — dérivée des
 *  fichiers defs. Remplace les tables SPECIES_* d'enemyProfile. */
const BIPED_BY_NAME: Record<string, CreatureDef> = Object.fromEntries(BIPED.map((c) => [c.name, c]));
export function bipedConfig(species: string): BipedConfig | undefined { return BIPED_BY_NAME[species]?.biped; }

// Matchers bipèdes triés par PRIORITÉ (plus bas = testé d'abord) — chaque def porte sa regex
// EXACTE `match` (reprise de l'ancien detectSpecies). L'ordre désambiguïse les chevauchements
// (« rat ogre » → Skaven avant Ogre ; « elfe sylvain » avant l'elfe générique).
const BIPED_MATCHERS = BIPED
  .filter((c) => c.match)
  .map((c) => ({ name: c.name, re: new RegExp(c.match!), pr: c.matchPriority ?? 100 }))
  .sort((a, b) => a.pr - b.pr);
/** Nom → espèce bipède (regex+priorité), ou undefined (→ Humain par défaut chez l'appelant). */
export function bipedSpeciesMatch(name: string): string | undefined {
  const n = norm(name);
  for (const m of BIPED_MATCHERS) if (m.re.test(n)) return m.name;
  return undefined;
}

/** Tables de props de rendu par espèce — dérivées des fichiers defs. */
export const QUAD_SPECIES: Record<string, QuadProps> = Object.fromEntries(QUAD.map((c) => [c.name, c.quad!]));
export const WINGED_SPECIES: Record<string, QuadProps> = Object.fromEntries(WING.map((c) => [c.name, c.quad!]));

export const quadSpeciesNames = (): string[] => QUAD.map((c) => c.name);
export const wingedSpeciesNames = (): string[] => WING.map((c) => c.name);

/** Nom de créature → espèce quadrupède (clé/alias), ou undefined si aucun quad ne matche. */
export function quadSpeciesMatch(name: string): string | undefined { return matchIn(QUAD, name)?.name; }
/** Nom de créature → espèce ailée (clé/alias), ou undefined si aucun ailé ne matche. */
export function wingSpeciesMatch(name: string): string | undefined { return matchIn(WING, name)?.name; }
