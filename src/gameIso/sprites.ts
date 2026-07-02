/**
 * Bibliothèque de sprites SVG (style validé) pour le rendu iso du jeu.
 * Chaque sprite est dessiné dans une boîte locale 120×150, pieds en (60,150).
 * placeSprite() le positionne sur une tuile. DEFS regroupe tous les dégradés.
 */
import type { Rot } from './iso';
import { propSvg } from './catalog/decor';
import type { Dir8 } from '../state/dir8';
import { TERRAIN_DEFS } from '../state/terrain';
import { P } from './catalog/decorPalette';
import { rigFxGradients } from './rig/fxGradients';

const e = (cx: number, cy: number, r = 2) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${r + 1}" fill="url(#g_eye)"/><circle cx="${cx}" cy="${cy}" r="${r * 0.55 + 0.4}" fill="${P.villageoisPupille}"/>`;

// Le DÉCOR en billboard (arbre du terrain `bois`, tonneaux…) passe désormais par `propSvg` (catalogue),
// et le MUR PLEIN par le relief data-driven de `buildFloors` (`TerrainDef.solidHeightM`) — plus aucun
// overlay codé en dur ici. Ce module ne fournit que les sprites de PNJ/props et les DEFS de dégradés.

// --- PNJ / props / objets --------------------------------------------------
function villager() {
  return `<g class="bob"><path d="M44 80 Q60 70 76 80 L82 150 L38 150 Z" fill="${P.villageoisEtoffe}"/>
    <path d="M44 78 Q60 70 76 78 L80 110 Q60 118 40 110 Z" fill="${P.villageoisEtoffeClaire}"/>
    <path d="M44 82 Q32 92 34 112" stroke="${P.villageoisEtoffe}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <path d="M76 82 Q88 92 86 112" stroke="${P.villageoisEtoffe}" stroke-width="8" fill="none" stroke-linecap="round"/>
    <circle cx="60" cy="56" r="14" fill="${P.villageoisPeau}"/>
    <path d="M46 52 Q60 36 74 52 Q70 44 60 44 Q50 44 46 52 Z" fill="${P.villageoisCheveux}"/>${e(55, 56, 1.6)}${e(65, 56, 1.6)}
    <path d="M54 64 q6 4 12 0" stroke="${P.villageoisBouche}" stroke-width="1.5" fill="none"/></g>`;
}

export function pnjSprite(): string {
  return villager();
}

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
 * Sprite d'une entité de scène pour le backend SPRITE (pickBackend). Après le passage de tout le
 * bestiaire ET des PNJ au rig, ce backend ne sert plus que le DÉCOR (props → propSprite) ; tout autre
 * kind est routé vers le rig EN AMONT et n'arrive jamais ici → chaîne vide. Partagé par IsoStage (jeu)
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
export function propSprite(ref?: string, facing?: Dir8, camRot: Rot = 0): string {
  return propSvg(ref ?? 'tonneau', facing, camRot);
}

// --- Définitions partagées (dégradés) -------------------------------------
/** Dégradés de TERRAIN assemblés depuis le registre (`TerrainDef.stops`) — source unique avec
 *  chaque `defs/<id>.ts`. Plusieurs terrains peuvent partager un `gradient` id → on ne l'émet
 *  qu'une fois (dédup). Tous verticaux (x1=0 y1=0 x2=0 y2=1). */
const terrainGradients = (() => {
  const seen = new Set<string>();
  let out = '';
  for (const t of TERRAIN_DEFS) {
    if (seen.has(t.gradient)) continue;
    seen.add(t.gradient);
    const stops = t.stops.map((s) => `<stop offset="${s.off}" stop-color="${s.color}"/>`).join('');
    out += `\n  <linearGradient id="${t.gradient}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;
  }
  return out;
})();

/** DEFS globaux = dégradés de TERRAIN (données) + dégradés RIG/FX (`rig/fxGradients`, verbatim). */
export const DEFS = terrainGradients + rigFxGradients;
