/**
 * BACKEND ÉCRAN-AFFINE des props (iso losange · edge-on · vue du dessus) : profondeur de tri et dessin
 * des OVERLAYS de terrain en relief (registre `terrainOverlay`, la caméra vit ici). Les props de SCÈNE
 * (`source:'entity'`), eux, se rendent en billboard React (BodyToken, stage/tokens) — ce module ne
 * fournit que leur profondeur d'empreinte, partagée jeu/éditeur.
 */
import { footprintDepth, type Dims } from '../iso';
import { terrainOverlay } from '../sprites';
import type { PropEl } from '../builders/types';

/** Profondeur de tri d'un prop de SCÈNE : empreinte au coin caméra-proche (comme les bâtiments). */
export function propDepth(el: PropEl, dims: Dims): number {
  return footprintDepth(el.cell.x, el.cell.y, el.span?.w ?? 1, el.span?.h ?? 1, dims, el.cell.z);
}

/** Overlay de TERRAIN en relief (mur plein / arbre) projeté par le registre : {profondeur biaisée, SVG}. */
export function terrainOverlayOf(el: PropEl, dims: Dims): { d: number; html: string } | null {
  return terrainOverlay(el.ref, el.cell.x, el.cell.y, dims);
}
