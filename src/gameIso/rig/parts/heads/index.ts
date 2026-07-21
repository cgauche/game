import { HEAD_DEFS } from './_registry.generated';
import type { HeadDef } from './types';
export type { HeadDef } from './types';

/** Têtes (visage + coiffure défaut + crâne d'espèce optionnel) par clé 'Race:Sexe' — dérivées des
 *  seuls fichiers `defs/`. */
export const HEADS_BY_KEY: Record<string, Pick<HeadDef, 'visage' | 'cheveux' | 'crane'>> = Object.fromEntries(
  HEAD_DEFS.map((d) => [d.key, { visage: d.visage, cheveux: d.cheveux, crane: d.crane }]),
);
