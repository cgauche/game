/**
 * CATALOGUE UNIFIÉ d'éléments d'apparence (convergence B) — vocabulaire UNIQUE des éléments visuels
 * réutilisables, comme `GameOp` côté mécanique. Un PNJ / créature / race = une COMBINAISON de clés.
 * Rien n'est verrouillé à une créature (cf. spec apparence-catalogue-unifie).
 *
 * REGISTRE auto-chargé : 1 élément = 1 fichier `defs/<key>.ts` (gen-registry → `ELEMENT_DEFS`).
 * Ajouter un élément d'apparence custom = déposer un fichier dans `defs/`, comme tous les registres.
 *
 * Les DIFFORMITÉS de mutation (LDB 19, canon) sont des éléments comme les autres (`defs/<slug>.ts`,
 * `category:'mutation'` — calques et/ou morpho `build`/`legs`/`faceFlip`). La SÉLECTION (quelle
 * mutation/trait porte quel visuel) vit en DONNÉE (`mutations.json`/`traits.json` → `appearance`),
 * plus aucun registre keyé par label en code.
 */
import type { AppearanceElement, ElementCategory, ElementOverlay } from './types';
import { ELEMENT_DEFS } from './_registry.generated';
export type { AppearanceElement, ElementCategory, ElementOverlay } from './types';

/** Catalogue clé → élément : registre `defs/` (traits de corps + difformités de mutation). */
export const APPEARANCE_ELEMENTS: Record<string, AppearanceElement> = Object.fromEntries(
  ELEMENT_DEFS.map((e) => [e.key, e]),
);

/** Résout des clés du catalogue en calques (overlays, type complet scale+replace/behind). Clé
 *  inconnue → ignorée. Utilisé par les RaceDef (défaut) et l'apparence d'instance (PNJ sur mesure). */
export function feat(...keys: string[]): ElementOverlay[] {
  return keys.flatMap((k) => APPEARANCE_ELEMENTS[k]?.overlays ?? []);
}

/** Morpho CUMULÉE des éléments sélectionnés (difformités) : delta de carrure (somme), multiplicateur
 *  de jambes (produit), visage retourné (ou). Clé inconnue / sans morpho → ignorée. Source UNIQUE du
 *  mapping clé-de-catalogue → morpho, lue par `combatantAppearance` (les calques passent par `feat`). */
export function featureMorpho(keys: string[]): { dBuild: number; legsMult: number; faceFlip: boolean } {
  let dBuild = 0;
  let legsMult = 1;
  let faceFlip = false;
  for (const k of keys) {
    const e = APPEARANCE_ELEMENTS[k];
    if (!e) continue;
    if (e.build != null) dBuild += e.build;
    if (e.legs != null) legsMult *= e.legs;
    if (e.faceFlip) faceFlip = true;
  }
  return { dBuild, legsMult, faceFlip };
}

/** Clés + libellés d'une catégorie — pour les pickers de l'éditeur. */
export function elementsOf(category: ElementCategory): { key: string; label: string }[] {
  return Object.values(APPEARANCE_ELEMENTS).filter((e) => e.category === category).map((e) => ({ key: e.key, label: e.label }));
}
