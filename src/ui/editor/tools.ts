import type { EntityKind, Terrain } from '../../state/scene';

/** Outil actif de l'éditeur (palette Carte). */
export type Tool =
  | { mode: 'select' }
  | { mode: 'tile'; terrain: Terrain }
  | { mode: 'entity'; kind: EntityKind }
  | { mode: 'building'; type: string }
  | { mode: 'erase' }
  | { mode: 'trigger' }
  | { mode: 'encounter' };

export type Rect = { x: number; y: number; w: number; h: number };

/** Calques masquables du canvas (débloquent le clic dessous). */
export type Layers = { triggers: boolean; spawns: boolean; buildings: boolean };

export const KINDS: EntityKind[] = ['heroStart', 'personnage', 'prop'];
export const KIND_LABEL: Record<EntityKind, string> = {
  heroStart: 'Départ héros',
  personnage: 'Personnage',
  prop: 'Décor',
};

/** Rectangle inclusif englobant deux cases (drag de zone/bâtiment/remplissage). */
export function rectFrom(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
}
