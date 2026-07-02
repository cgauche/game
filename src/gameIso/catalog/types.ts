import type { Dims } from '../iso';
import type { Facing } from '../../state/scene';
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
/** Bâtiment composable UNIFIÉ (registre defs/) : pure méta sémantique (id/label/empreinte par défaut +
 *  matériau de toit). Un bâtiment réel = des murs d'arête (`WallSeg`) sur un sol de terrain ; sa nappe de
 *  toit est rendue par le pivot `builders/roofs` + backend `affineRoofs` (le `roofMaterial` ci-dessous est
 *  le défaut). `BUILDINGS_META` en dérive. Un fichier `buildings/defs/<id>.ts` = un `export const building: BuildingDef`. */
export interface BuildingDef {
  id: string;
  label: string;
  defaultFoot: { w: number; h: number };
  /** Matériau de couverture par DÉFAUT du toit (id `RoofMaterialDef` : 'tuile'/'chaume'/'ardoise') —
   *  méta portée par la donnée du bâtiment, lue par `styleRoofMaterial` (fin de la table `STYLE_MATERIAL`). */
  roofMaterial: string;
  /** Ornements d'IDENTITÉ VISUELLE du type (clocheton d'une chapelle, cheminée d'une forge, enseigne
   *  d'une taverne, étal d'une échoppe) — posés en billboard sur/devant le bâtiment par `builders/props`,
   *  dérivés 100 % de la donnée. Absent = bâtiment sobre (maison/manoir/tour). Lu via `buildingFeatures`
   *  (accesseur SÉPARÉ — hors `BuildingMeta`, qui reste la méta éditeur). */
  features?: BuildingFeature[];
}

/** Un ornement d'identité d'un bâtiment : un prop du catalogue décor posé à un ancrage du bâtiment. */
export interface BuildingFeature {
  /** Id de prop du catalogue décor posé comme ornement (clocheton, cheminee, enseigne, etal-marche…). */
  prop: string;
  /** Où sur le bâtiment : 'ridge' = faîte (surélevé au toit) ; 'facade' = au-dessus de la porte (mur,
   *  orienté vers l'extérieur) ; 'front' = au sol juste DEVANT la porte (orienté vers l'extérieur). */
  anchor: 'ridge' | 'facade' | 'front';
  /** Classe d'anim CSS d'ambiance passée à PropEl.fx (ex. 'warm' pour la fumée de forge). */
  fx?: string;
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
