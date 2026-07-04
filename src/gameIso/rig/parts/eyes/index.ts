/**
 * Registre des YEUX, dérivé des `defs/` (1 œil = 1 fichier). Source unique de l'art d'œil + machinerie
 * de remplacement en place (PURE, plus aucune string SVG inline ici). Les helpers procéduraux
 * `goatEye/emberEye/…` des têtes bestiales vivent ailleurs (`parts/monster/eyes.ts`).
 */
import { EYE_DEFS, type EyeId } from './_registry.generated';

export type { EyeId };
export type { EyeDef } from './types';

/** id → art SVG (source unique). Consommé par les blessures (verre/perdu/cache-oeil). */
export const EYES: Record<string, string> = Object.fromEntries(EYE_DEFS.map((e) => [e.id, e.art]));

/** Catalogue (clé stable → art + libellé FR) — sous-ensemble éditeur, ORDONNÉ par `catalogOrder`. */
export const EYE_OPTIONS: Record<string, { label: string; art: string }> = Object.fromEntries(
  EYE_DEFS.filter((e) => e.catalogOrder != null)
    .sort((a, b) => a.catalogOrder! - b.catalogOrder!)
    .map((e) => [e.id, { label: e.label, art: e.art }]),
);

/** Remplace l'œil `side` du visage par `art` (centré sur l'ancre `data-ec` de l'orbite).
 *  Visage sans marqueur (têtes monstrueuses, races sans tête générée) → no-op. */
export function swapEye(visage: string, side: 'G' | 'D', art: string): string {
  const re = new RegExp(`<g data-eye="${side}" data-ec="(-?[\\d.]+) (-?[\\d.]+)">.*?</g>`);
  return visage.replace(re, (_m, x: string, y: string) =>
    `<g data-eye="${side}" data-ec="${x} ${y}" transform="translate(${x},${y})">${art}</g>`);
}

/** Applique les remplacements d'yeux demandés par l'apparence (G et/ou D). */
export function applyEyes(visage: string, eyes?: { G?: string; D?: string }): string {
  if (!eyes) return visage;
  let out = visage;
  if (eyes.G) out = swapEye(out, 'G', eyes.G);
  if (eyes.D) out = swapEye(out, 'D', eyes.D);
  return out;
}

/** CLÉS du catalogue (donnée éditeur) → ARTS, ou undefined si rien à remplacer. Utilisé par les
 *  tokens d'entité (les combattants passent par riggedAppearance qui résout au spawn). */
export function eyesArtFromKeys(eyes?: { G?: string; D?: string }): { G?: string; D?: string } | undefined {
  if (!eyes) return undefined;
  const G = eyes.G ? EYE_OPTIONS[eyes.G]?.art : undefined;
  const D = eyes.D ? EYE_OPTIONS[eyes.D]?.art : undefined;
  return G || D ? { ...(G ? { G } : {}), ...(D ? { D } : {}) } : undefined;
}
