/**
 * Registre des traits de Psychologie (LDB 21/85) — DÉRIVÉ du registre `defs/` (gen-registry.mjs).
 * Ajouter un trait psy = déposer `defs/<x>.ts` (`export const psych: PsychTraitDef`) puis `npm run gen`.
 * SOURCE UNIQUE de la lecture des libellés de traits (fin des regex en dur de psychology.ts).
 */
import type { PsychParse } from './types';
import { PSYCH_DEFS } from './_registry.generated';
import { formatTrait } from '../traits/dispatch';
import type { TraitList } from '../statEntry';

export type { PsychParse, PsychTraitDef } from './types';

/** Parse les libellés de traits (creatures.json) en propriétés psy : Peur/Terreur/Immunité +
 *  traits ciblés (Animosité/Haine/Préjugé/Amour/Camaraderie/Phobie/Effrayé). Itère le registre.
 *  Accepte une `TraitList` : la chaîne legacy est lue telle quelle, l'instance structurée formatée
 *  (les défs psy gardent leur propre lecture de libellé — phase « psych structuré » ultérieure). */
export function parsePsychTraits(traits: TraitList): PsychParse {
  const out: PsychParse = {};
  for (const x of traits) {
    const t = typeof x === 'string' ? x : formatTrait(x);
    for (const def of PSYCH_DEFS) def.apply(t, out);
  }
  return out;
}
