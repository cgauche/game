/** Helpers PURS des bâtiments (sémantique : empreinte, porte, cutaway) + le TYPE `BuildingMeta`.
 *  Le registre unifié vit dans `src/gameIso/catalog/buildings/defs/` ; `BUILDINGS_META` (méta
 *  éditeur) en DÉRIVE dans `catalog/buildings/index.ts`. Ce module reste PUR (aucun rendu). */
import type { Scene, BuildingFeature, Facing } from './scene';

export interface BuildingMeta {
  id: string;
  label: string;
  category: 'petit' | 'monument';
  defaultFoot: { w: number; h: number };
  defaultReveal: 'cutaway' | 'door';
}

function inFoot(b: BuildingFeature, x: number, y: number): boolean {
  return x >= b.foot.x && x < b.foot.x + b.foot.w && y >= b.foot.y && y < b.foot.y + b.foot.h;
}
function isPerimeter(b: BuildingFeature, x: number, y: number): boolean {
  return x === b.foot.x || x === b.foot.x + b.foot.w - 1 || y === b.foot.y || y === b.foot.y + b.foot.h - 1;
}
function isDoor(b: BuildingFeature, x: number, y: number): boolean {
  return !!b.door && b.door.x === x && b.door.y === y;
}

export function buildingAt(scene: Scene, x: number, y: number): BuildingFeature | undefined {
  return (scene.buildings ?? []).find((b) => inFoot(b, x, y));
}
export function doorAt(scene: Scene, x: number, y: number): BuildingFeature | undefined {
  return (scene.buildings ?? []).find((b) => isDoor(b, x, y));
}

/** Une tuile est-elle bloquée par un bâtiment ? */
export function buildingBlockedAt(scene: Scene, x: number, y: number): boolean {
  for (const b of scene.buildings ?? []) {
    if (!inFoot(b, x, y)) continue;
    if (isDoor(b, x, y)) return false; // la porte est toujours franchissable
    if (isPerimeter(b, x, y)) return true; // murs périmétriques
    if (b.reveal === 'door') return true; // intérieur inaccessible (transition only)
    return false; // intérieur cutaway → walkable
  }
  return false;
}

/** Le toit doit-il être masqué (cutaway) ? */
export function roofHidden(b: BuildingFeature, allies: { x: number; y: number }[]): boolean {
  if (b.reveal !== 'cutaway') return false;
  return allies.some((a) => inFoot(b, a.x, a.y));
}

/** Porte par défaut : milieu du mur du côté `facing` (défaut = Sud, vers la caméra). */
export function defaultDoor(foot: { x: number; y: number; w: number; h: number }, facing: Facing = 'S'): { x: number; y: number } {
  const midX = foot.x + Math.floor(foot.w / 2);
  const midY = foot.y + Math.floor(foot.h / 2);
  switch (facing) {
    case 'N':
      return { x: midX, y: foot.y };
    case 'E':
      return { x: foot.x + foot.w - 1, y: midY };
    case 'O':
      return { x: foot.x, y: midY };
    case 'S':
    default:
      return { x: midX, y: foot.y + foot.h - 1 };
  }
}

/** Tuiles du périmètre de l'empreinte (candidates pour la porte). */
export function perimeterTiles(b: BuildingFeature): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (let y = b.foot.y; y < b.foot.y + b.foot.h; y++)
    for (let x = b.foot.x; x < b.foot.x + b.foot.w; x++) if (isPerimeter(b, x, y)) out.push({ x, y });
  return out;
}
