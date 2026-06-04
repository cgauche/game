import type { View } from '../facing';

/** Fragment SVG dessiné dans le repère LOCAL de l'os porteur (origine au pivot). */
export interface Part { svg: string; }

/** Art d'une part : soit un seul SVG (= front pour toutes les vues), soit une vue par direction. */
export type PartArt = string | { front: string; back?: string; profile?: string };

/** Choisit le SVG d'une vue, avec fallback sur front (jamais vide si front existe). */
export function pickView(art: PartArt | undefined | null, view: View): string {
  if (art == null) return '';
  if (typeof art === 'string') return art;
  return art[view] ?? art.front;
}
