import type { View } from '../facing';

/** Fragment SVG dessiné dans le repère LOCAL de l'os porteur (origine au pivot). */
export interface Part { svg: string; }

/** Art d'une part : soit un seul SVG (= front pour toutes les vues), soit une vue par direction.
 *  Format des registres à repli DÉCLARÉ (armes/boucliers/appendices/têtes/monstre) — front-only y est
 *  plaqué sur les autres vues via `pickView` ci-dessous. N'est PLUS la porte de sortie des slots de
 *  CORPS (tete/torse/jambes/bras) : ceux-ci résolvent en `ViewSet` TOTAL (accès `art[view]`). */
export type PartArt = string | { front: string; back?: string; profile?: string };

/** Choisit le SVG d'une vue, avec fallback sur front (jamais vide si front existe). Sert les registres
 *  à repli DÉCLARÉ (`PartArt`) — jamais les slots de corps (cf. `ViewSet`/`pickBodyView`). */
export function pickView(art: PartArt | undefined | null, view: View): string {
  if (art == null) return '';
  if (typeof art === 'string') return art;
  return art[view] ?? art.front;
}

/** Art TOTAL d'un slot de CORPS : les trois vues sont GARANTIES (aucun repli silencieux possible —
 *  une vue manquante est une erreur de compile). Produit à l'ingestion par le shim `toViewSet`
 *  (`derive.ts`) à partir de l'art `PartArt` des registres (tenue/armure/générique/override). */
export interface ViewSet { front: string; back: string; profile: string }

/** Accès TOTAL d'une vue de corps — `art[view]`, sans repli (le repli est matérialisé en amont). */
export function pickBodyView(art: ViewSet, view: View): string {
  return art[view];
}

/** Une part `PartArt` fournit-elle sa vue de PROFIL / de DOS ? Discriminant du FORMAT de part :
 *  `string` = front-only (le shim `toViewSet` DÉRIVE alors la vue absente). Consommé par la garde de
 *  format (`tenues/part-view-format.test.ts` via `partViewAudit`), qui mesure le format des DEFS bruts. */
export const hasProfileView = (p: PartArt | null | undefined): boolean => typeof p === 'object' && p != null && !!p.profile;
export const hasBackView = (p: PartArt | null | undefined): boolean => typeof p === 'object' && p != null && !!p.back;

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
