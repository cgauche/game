/**
 * Registre des qualités d'objet (arme/armure/artisanat) — DÉRIVÉ du registre `defs/` (gen-registry.mjs).
 * Ajouter une qualité = déposer `defs/<slug>.ts` (`export const quality: QualityDef = { key, … }`, la clé
 * étant le label FR canonique) puis `npm run gen` (auto en dev). Plus de table à éditer à la main.
 * Les helpers de `dispatch.ts` lisent `QUALITIES` ; combat.ts/items.ts l'appellent aux moments de jeu.
 */
import type { QualityDef } from './types';
import { QUALITY_DEFS } from './_registry.generated';

export type { QualityCtx, QualityDef } from './types';

/** Table des qualités. Clé = label FR canonique (porté par chaque def). */
export const QUALITIES: Record<string, QualityDef> = Object.fromEntries(QUALITY_DEFS.map((q) => [q.key, q]));
