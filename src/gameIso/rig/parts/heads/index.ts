import { HEAD_DEFS } from './_registry.generated';
export type { HeadDef } from './types';

/** Têtes (visage + coiffure défaut) par clé 'Race:Sexe' — dérivées des seuls fichiers `defs/`. */
export const HEADS_BY_KEY: Record<string, { visage?: string; cheveux?: string }> = Object.fromEntries(
  HEAD_DEFS.map((d) => [d.key, { visage: d.visage, cheveux: d.cheveux }]),
);
