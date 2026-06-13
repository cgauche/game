/**
 * Registre des traits de Psychologie (LDB 21/85) — DÉRIVÉ du registre `defs/` (gen-registry.mjs).
 * Ajouter un trait psy = déposer `defs/<x>.ts` (`export const psych: PsychTraitDef`) puis `npm run gen`.
 * SOURCE UNIQUE de la lecture des libellés de traits (fin des regex en dur de psychology.ts).
 */
import type { PsychParse } from './types';
import { PSYCH_DEFS } from './_registry.generated';

export type { PsychParse, PsychTraitDef } from './types';

/** Parse les libellés de traits (creatures.json) en propriétés psy : Peur/Terreur/Immunité +
 *  traits ciblés (Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie/Effrayé). Itère le registre. */
export function parsePsychTraits(traits: string[]): PsychParse {
  const out: PsychParse = {};
  for (const t of traits) for (const def of PSYCH_DEFS) def.apply(t, out);
  return out;
}
