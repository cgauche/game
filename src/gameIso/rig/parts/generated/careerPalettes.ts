/**
 * Palettes par DÉFAUT des tenues de carrière — GÉNÉRÉ (workflow de classification couleur).
 * NE PAS éditer à la main : régénéré par `scripts/_tokenize-tenues.mjs` à partir de la
 * classification `careerColorMap.ts`.
 *
 * Pour chaque carrière, les hex EXACTS d'origine par token (`vet1`, `vet1O`, `vet1H`,
 * `cuir`, `metal`, `peau`…). Fusionnés SOUS les surcharges utilisateur dans `composeRig`
 * → rendu par défaut identique à l'art dessiné, recoloriage cohérent quand l'utilisateur
 * choisit une couleur. Une carrière absente → palette globale par défaut (DEFAULT_PALETTE).
 */
import type { StoredPalette } from '../../palette';

export const CAREER_PALETTES: Record<string, StoredPalette> = {};
