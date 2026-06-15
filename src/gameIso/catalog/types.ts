import type { Dims } from '../iso';
import type { BuildingParams, Facing } from '../../state/scene';
import type { Dir8 } from '../../state/dir8';
import type { BuildingMeta } from '../../state/buildings';

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

/** 3 calques distincts → permet de masquer le toit seul (cutaway). */
export interface BuildingLayers {
  walls: string;
  interior: string;
  roof: string;
}

export interface BuildingViz {
  id: string;
  paramsSchema?: ParamField[];
  render(foot: Rect, params: BuildingParams, ctx: RenderCtx): BuildingLayers;
}

/** Bâtiment UNIFIÉ (registre defs/) : méta sémantique (label/catégorie/empreinte/reveal, côté
 *  state) + présentation (schéma de params + render). `BUILDINGS` (viz) et `BUILDINGS_META` (pur)
 *  en dérivent. Un fichier `buildings/defs/<id>.ts` = un `export const building: BuildingDef`. */
export interface BuildingDef extends BuildingMeta {
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
