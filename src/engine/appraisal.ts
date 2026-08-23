import { APPRAISED_AVAILABILITIES, type Availability } from './types';

/** Évaluation (LDB 59 l.41) : « estimer les prix des objets Rares ou Exotiques à ±10 % » ; sinon prix exact. */
export function appraiseEstimate(av: Availability | null, basePrice: number): { min: number; max: number } {
  if (av !== null && (APPRAISED_AVAILABILITIES as readonly Availability[]).includes(av)) {
    return { min: Math.round(basePrice * 0.9), max: Math.round(basePrice * 1.1) };
  }
  return { min: basePrice, max: basePrice };
}
