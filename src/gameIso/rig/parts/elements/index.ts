/**
 * CATALOGUE UNIFIÉ d'éléments d'apparence (convergence B) — vocabulaire UNIQUE des éléments visuels
 * réutilisables, comme `GameOp` côté mécanique. Un PNJ / créature / race = une COMBINAISON de clés.
 * Rien n'est verrouillé à une créature (cf. spec apparence-catalogue-unifie).
 *
 * REGISTRE auto-chargé : 1 élément = 1 fichier `defs/<key>.ts` (gen-registry → `ELEMENT_DEFS`).
 * Ajouter un élément d'apparence = déposer un fichier dans `defs/`, comme tous les registres.
 */
import type { RaceFeature } from '../../races/types';
import type { AppearanceElement, ElementCategory } from './types';
import { ELEMENT_DEFS } from './_registry.generated';
export type { AppearanceElement, ElementCategory, ElementOverlay } from './types';

/** Catalogue clé → élément, dérivé du registre `defs/`. */
export const APPEARANCE_ELEMENTS: Record<string, AppearanceElement> = Object.fromEntries(ELEMENT_DEFS.map((e) => [e.key, e]));

/** Résout des clés du catalogue en calques (overlays). Clé inconnue → ignorée. Utilisé par les
 *  RaceDef (sélection par défaut) et l'apparence d'instance (PNJ qui ajoute des traits). */
export function feat(...keys: string[]): RaceFeature[] {
  return keys.flatMap((k) => APPEARANCE_ELEMENTS[k]?.overlays ?? []);
}

/** Clés + libellés d'une catégorie — pour les pickers de l'éditeur (multi pour 'trait'). */
export function elementsOf(category: ElementCategory): { key: string; label: string }[] {
  return ELEMENT_DEFS.filter((e) => e.category === category).map((e) => ({ key: e.key, label: e.label }));
}
