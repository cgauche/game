/**
 * Registre des qualités d'objet (arme/armure/artisanat) — DÉRIVÉ de la DONNÉE (`src/data/qualities.json`,
 * via `data.qualities`). Plus de `defs/` mécaniques : toute la mécanique (passive/effects/capabilities)
 * vit dans `qualities.json`, lue PAR ID. `QUALITIES` ne porte plus que le libellé d'affichage (`{ key }`).
 * Sa clé reste le LIBELLÉ FR canonique (porté par chaque entrée de données) — `normalize`/`describe`
 * indexent par libellé et par id. Les helpers de `dispatch.ts` lisent la mécanique dans `qualities.json`.
 */
import type { QualityDef } from './types';
import { qualities } from '../../data';

export type { QualityDef } from './types';

/** Table des qualités. Clé = label FR canonique. Dérivée 1:1 de `qualities.json` (`{ key: label }`). */
export const QUALITIES: Record<string, QualityDef> = Object.fromEntries(qualities.map((q) => [q.label, { key: q.label }]));
