/**
 * CATALOGUE UNIFIÉ d'éléments d'apparence (convergence B) — vocabulaire UNIQUE des éléments visuels
 * réutilisables, comme `GameOp` côté mécanique. Un PNJ / créature / race = une COMBINAISON de clés.
 * Rien n'est verrouillé à une créature (cf. spec apparence-catalogue-unifie).
 *
 * REGISTRE auto-chargé : 1 élément = 1 fichier `defs/<key>.ts` (gen-registry → `ELEMENT_DEFS`).
 * Ajouter un élément d'apparence custom = déposer un fichier dans `defs/`, comme tous les registres.
 *
 * Les VISUELS DE MUTATION (LDB 19, canon — `MUTATION_VISUALS`) sont AGRÉGÉS ici comme éléments
 * « difformité » → posables en APPARENCE PURE (`appearance.features`), SANS le trait/mécanique
 * Mutation : on construit un PNJ sur mesure (tentacule, bouche, écailles…) sans toucher aux traits.
 */
import type { AppearanceElement, ElementCategory, ElementOverlay } from './types';
import { ELEMENT_DEFS } from './_registry.generated';
import { MUTATION_VISUALS, mutKey } from '../mutations';
import { LABELS_PHYSIQUES } from '../../../../data/mutations';
export type { AppearanceElement, ElementCategory, ElementOverlay } from './types';

/** Visuels de mutation (canon LDB 19) → éléments de catalogue « difformité ». Seuls ceux à CALQUES
 *  sont posables comme apparence (les pures morpho Corpulent/Émacié passent par build ; la peau par
 *  les couleurs). `eyeG` (Œil énorme) exposé en `eye`. */
/** Clé de catalogue HYPHÉNÉE (cohérente avec les traits : 'cornes-demon', 'tentacule-epais') —
 *  dérivée du label, apostrophe retirée, espaces → tirets (== le slug `data-mut` du SVG). */
const slug = (label: string) => mutKey(label).replace(/'/g, '').replace(/\s+/g, '-');

function mutationElements(): Record<string, AppearanceElement> {
  const out: Record<string, AppearanceElement> = {};
  for (const label of LABELS_PHYSIQUES) {
    const v = MUTATION_VISUALS[mutKey(label)];
    if (!v?.overlays?.length) continue; // morpho/peau pures (Corpulent/Peau d'acier) : via build/couleurs ; œil → catalogue d'yeux
    out[slug(label)] = {
      key: slug(label), label, category: 'mutation',
      ...(v.overlays ? { overlays: v.overlays as ElementOverlay[] } : {}),
      ...(v.eyeG ? { eye: { G: v.eyeG } } : {}),
      ...(v.build != null ? { build: v.build } : {}),
      ...(v.legs != null ? { legs: v.legs } : {}),
      ...(v.skin ? { skin: v.skin } : {}),
      ...(v.faceFlip ? { faceFlip: v.faceFlip } : {}),
    };
  }
  return out;
}

/** Catalogue clé → élément : registre `defs/` (traits custom) + visuels de mutation canon (difformités). */
export const APPEARANCE_ELEMENTS: Record<string, AppearanceElement> = {
  ...Object.fromEntries(ELEMENT_DEFS.map((e) => [e.key, e])),
  ...mutationElements(),
};

/** Résout des clés du catalogue en calques (overlays, type complet scale+replace/behind). Clé
 *  inconnue → ignorée. Utilisé par les RaceDef (défaut) et l'apparence d'instance (PNJ sur mesure). */
export function feat(...keys: string[]): ElementOverlay[] {
  return keys.flatMap((k) => APPEARANCE_ELEMENTS[k]?.overlays ?? []);
}

/** Clés + libellés d'une catégorie — pour les pickers de l'éditeur. */
export function elementsOf(category: ElementCategory): { key: string; label: string }[] {
  return Object.values(APPEARANCE_ELEMENTS).filter((e) => e.category === category).map((e) => ({ key: e.key, label: e.label }));
}
