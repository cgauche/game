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

/** Base COMMUNE d'un def « équipement TENU » (silhouette sur un os de main) : armes ET boucliers.
 *  1 fichier = 1 def (registre auto-chargé `defs/`) ; les deux sont routés par SLUG (`shape`), jamais par libellé. */
export interface RigHeldDef {
  /** Clé de forme stable — ce par quoi l'art est routé (`shape`). */
  slug: string;
  /** Libellé d'affichage (= label du trapping ; sert aussi à la jointure label→slug à l'AUTHORING). PAS au routage runtime. */
  label: string;
  /** Cible silhouette-first (FR) — sert les workflows d'art. */
  target: string;
  /** Art dans le repère local de l'os porteur (arme : manche en (0,0), lame vers -y ; bouclier : centré ~cy6).
   *  String = même art toutes vues ; objet `{front,back?,profile?}` pour un art DIRECTIONNEL (ex. l'épée). */
  art: PartArt;
}
