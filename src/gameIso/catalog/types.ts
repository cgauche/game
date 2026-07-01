import type { Dims } from '../iso';
import type { RoofParams, Facing } from '../../state/scene';
import type { Dir8 } from '../../state/dir8';

export type ParamField =
  | { key: string; label: string; type: 'number'; min?: number; max?: number; step?: number }
  | { key: string; label: string; type: 'select'; options: { value: string; label: string }[] }
  | { key: string; label: string; type: 'color' };

export interface RenderCtx {
  dims: Dims;
  /** Orientation du bâtiment (place la porte visible côté façade) — modèle 4 directions. */
  facing?: Facing;
  /** Orientation MONDE d'une entité/prop (Dir8, même repère que le rig). Le décor directionnel
   *  (sièges) la projette dans le repère caméra via `project(dir, dims.rot)` → il PIVOTE avec la vue. */
  dir?: Dir8;
  /** Scène nocturne → fenêtres éclairées. */
  night?: boolean;
}
export type Rect = { x: number; y: number; w: number; h: number };

/** Preset de TOIT d'un bâtiment composé : la skin du `render` d'un def, dont le pipeline relief-unifié ne
 *  consomme que `roof` (rendu par `RoofSprite.roofObj`). Les murs réels sont des `WallSeg` (`wallObjs`) et
 *  le sol du terrain (`floorObjs`) → `walls`/`interior`, encore produits par les defs (skin historique du
 *  bâtiment), restent TOLÉRÉS mais inutilisés par le rendu : à retirer quand les defs seront réduits au
 *  toit seul. */
export interface RoofStyle {
  walls?: string;
  interior?: string;
  roof: string;
}

export interface BuildingViz {
  id: string;
  paramsSchema?: ParamField[];
  render(foot: Rect, params: RoofParams, ctx: RenderCtx): RoofStyle;
}

/** Bâtiment composable UNIFIÉ (registre defs/) : méta sémantique (id/label/empreinte par défaut) +
 *  présentation (schéma de params + render du TOIT). `BUILDINGS` (viz) et `BUILDINGS_META` (méta) en
 *  dérivent. Un fichier `buildings/defs/<id>.ts` = un `export const building: BuildingDef`. */
export interface BuildingDef {
  id: string;
  label: string;
  defaultFoot: { w: number; h: number };
  paramsSchema?: ParamField[];
  render: BuildingViz['render'];
}

export interface PropViz {
  id: string;
  label: string;
  /** Décor « naturellement fouillable/ramassable » : l'éditeur pré-arme `interact` à la pose (SP2↔SP1). */
  searchable?: boolean;
  /** Empreinte par DÉFAUT en cases (tente 2×2, tribune 3×1…) : appliquée à la pose dans l'éditeur
   *  (modifiable par entité via `SceneEntity.foot`), bloque la marche et dimensionne le rendu. */
  foot?: { w: number; h: number };
  paramsSchema?: ParamField[];
  render(params: Record<string, unknown>, ctx: RenderCtx): string;
}
