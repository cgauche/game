/**
 * Bibliothèque de sprites SVG (style validé) pour le rendu iso du jeu.
 * Chaque sprite est dessiné dans une boîte locale 120×150, pieds en (60,150).
 * entitySprite()/propSprite() résolvent l'art d'un décor depuis le registre. DEFS regroupe tous les dégradés.
 */
import type { Rot } from '../geometry/iso';
import { propSvg } from './catalog/decor';
import { MISSING_GRADIENT, terrainGradientId, terrainStopsOrdonnes } from './catalog/terrain';
import { MISSING_TONE, MISSING_TONE_DARK } from './catalog/missing';
import type { Dir8 } from '../state/dir8';
import { tousLesTerrains, type TerrainDef } from '../state/terrain';
import { rigFxGradients } from './rig/fxGradients';

// Le DÉCOR en billboard (arbre du terrain `bois`, tonneaux…) passe par `propSvg` (catalogue), et le
// MUR PLEIN par le relief data-driven de `buildFloors` (`TerrainDef.solidHeightM`) — aucun overlay codé
// en dur ici. Ce module ne fournit que les sprites de props/décor et les DEFS de dégradés.
// (Le jeton de groupe affiche le RIG réel du meneur, jamais un sprite « villageois » générique.)

/** Vue minimale d'une entité pour le rendu (type structurel : pas d'import scene). */
export interface EntityViz {
  kind: string;
  id: string;
  ref?: string;
  appearance?: { seed?: number };
  /** Orientation MONDE (Dir8, même repère que `SceneEntity.facing`) — un prop directionnel (sièges)
   *  la projette avec la caméra via `project()` ; les props symétriques l'ignorent. */
  facing?: Dir8;
}

/**
 * Sprite d'une entité de scène pour le backend SPRITE (tokenBodyKind). Après le passage de tout le
 * bestiaire ET des PNJ au rig, ce backend ne sert plus que le DÉCOR (props → propSprite) ; tout autre
 * kind est routé vers le rig EN AMONT et n'arrive jamais ici → chaîne vide. Partagé par l'hôte du monde de campagne (jeu)
 * et l'éditeur (WYSIWYG) — source unique.
 */
export function entitySprite(ent: EntityViz, camRot: Rot = 0): string {
  switch (ent.kind) {
    case 'prop':
      return propSprite(ent.ref, ent.facing, camRot);
    default:
      return '';
  }
}
/** Sprite d'un décor. `ref` ABSENT = aucun art demandé (point d'interaction authoré nu) → rien à
 *  dessiner, même frontière que `structureAppearance(undefined)`. `ref` PRÉSENT hors registre = donnée
 *  fautive → repli VISIBLE d'erreur dans `propSvg` (#877), jamais l'art d'un AUTRE décor. */
export function propSprite(ref?: string, facing?: Dir8, camRot: Rot = 0): string {
  return ref ? propSvg(ref, facing, camRot) : '';
}

// --- Définitions partagées (dégradés) -------------------------------------
/** Émetteur PUR des dégradés de TERRAIN (`TerrainDef.stops`) — UN dégradé par terrain, son id DÉRIVÉ
 *  de l'id du terrain (`terrainGradientId`), donc aucun partage possible ; arrêts émis dans l'ordre
 *  croissant (`terrainStopsOrdonnes`, source unique). Tous verticaux (x1=0 y1=0 x2=0 y2=1).
 *  `DEFS` le compose sur le dataset `src/data/terrains.json` via `tousLesTerrains()`. */
export const degradesDeTerrains = (terrains: readonly TerrainDef[]): string =>
  terrains
    .map((t) => {
      const stops = terrainStopsOrdonnes(t.stops)
        .map(([off, color]) => `<stop offset="${off}" stop-color="${color}"/>`)
        .join('');
      return `\n  <linearGradient id="${terrainGradientId(t.id)}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;
    })
    .join('');

/** Dégradé d'ALARME du repli visible (#877) : peint la case d'un terrain absent du registre. */
const degradeAlarme =
  `\n  <linearGradient id="${MISSING_GRADIENT}" x1="0" y1="0" x2="0" y2="1">`
  + `<stop offset="0%" stop-color="${MISSING_TONE}"/><stop offset="100%" stop-color="${MISSING_TONE_DARK}"/></linearGradient>`;

/** DEFS globaux = dégradés de TERRAIN (données) + dégradés RIG/FX (`rig/fxGradients`, verbatim). */
export const DEFS = degradesDeTerrains(tousLesTerrains()) + degradeAlarme + rigFxGradients;
