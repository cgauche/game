/**
 * Registre des Traits de créature (LDB 85) — DÉRIVÉ du registre `defs/` (gen-registry.mjs).
 * Ajouter un trait = déposer `defs/<slug>.ts` (`export const trait: TraitDef = { key, … }`, la clé
 * étant le libellé FR canonique) puis `npm run gen` (auto en dev).
 * Les helpers de `dispatch.ts` lisent `TRAITS` ; spawn/combat/IA les appellent aux moments de jeu.
 */
import type { TraitDef } from './types';
import { TRAIT_DEFS } from './_registry.generated';

export type { TraitDef } from './types';

/** Table des traits. Clé = libellé FR canonique (porté par chaque def). */
export const TRAITS: Record<string, TraitDef> = Object.fromEntries(TRAIT_DEFS.map((t) => [t.key, t]));
