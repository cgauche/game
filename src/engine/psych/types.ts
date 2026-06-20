import type { PsychTrait } from '../psychology';

/** Propriétés psy extraites des traits de données par `parsePsychTraits` (LDB 21/85). */
export interface PsychParse {
  causesPeur?: number;
  causesTerreur?: number;
  psychImmune?: boolean;
  psychTraits?: PsychTrait[];
}
