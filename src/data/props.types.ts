/**
 * Contrats NEUTRES du décor : type de prop app-owned (`props.json`), recette VOLUMIQUE locale, matériaux
 * et places assises. Vivent hors de `src/data/index.ts` pour rester importables par `src/state` comme par
 * `src/gameIso` sans traverser le chargeur app-owned. PUR — aucune donnée, aucune caméra, aucun rendu.
 *
 * Repère LOCAL d'une recette : origine au CENTRE de la case d'ancrage (coin NO de l'empreinte), `x`/`y`
 * en cases, `h` en mètres depuis le sol de la case. L'orientation vient de `SceneEntity.facing`.
 */
import type { Dir8 } from '../state/dir8';

/** Id d'un matériau de `propMaterials.json`. */
export type PropMaterialId = string;

/** Point du repère local d'une recette (cases en x/y, mètres en h). */
export interface PropPoint3 { x: number; y: number; h: number }
/** Dimensions dans le repère local d'une recette (cases en x/y, mètres en h). */
export interface PropSize3 { x: number; y: number; h: number }

/** Volume élémentaire d'une recette : caisse droite, cylindre à N faces, ou prisme en pente. */
export type PropPrimitive =
  | { kind: 'box'; center: PropPoint3; size: PropSize3; material: PropMaterialId }
  | { kind: 'cylinder'; center: PropPoint3; radius: number; heightM: number; sides: 8 | 12 | 16; material: PropMaterialId }
  | { kind: 'prism'; center: PropPoint3; size: PropSize3; slope: 'x+' | 'x-' | 'y+' | 'y-'; material: PropMaterialId };

/** Recette volumique d'un prop : la liste de ses primitives, dans le repère local. */
export interface PropVolumeRecipe { primitives: PropPrimitive[] }

/** Place assise offerte par un prop : ancre du corps, cap du corps assis, et case d'ABORD (relative à
 *  l'ancre de l'empreinte) depuis laquelle on rejoint la place. */
export interface PropSeatSlot { id: string; anchor: PropPoint3; facing: Dir8; approach: { x: number; y: number } }

/** Matériau de rendu d'une primitive : couleur de base + réponse à la lumière. Aucune émission — une
 *  source lumineuse est un `light` de prop/d'instance, jamais un matériau. */
export interface PropMaterialData { id: string; color: string; roughness: number; metalness: number }

/**
 * Type de PROP/décor app-owned : couche SÉMANTIQUE (physique `solid`, opacité `opaque`, classe de
 * `cover`, émission de lumière `light`, empreinte `foot`) ET géométrie locale (`volume`, `seatSlots`) —
 * le rendu SVG de vignette et le label restent au catalogue gameIso. Vérité UNIQUE des dimensions d'un
 * décor : une instance de scène ne redéclare aucune empreinte. Lu par la walkability (`sceneRules`), la
 * Ligne de Vue/couvert (`lineOfSight`), la lumière (`vision`) et le monde volumique. Édité au Codex.
 * Un prop ABSENT du dataset = passable, transparent, sans couvert, sans lumière et sans empreinte.
 */
export interface PropData {
  id: string;
  solid?: boolean;
  opaque?: boolean;
  cover?: 'imparfaite' | 'moyenne' | 'totale';
  light?: { radiusTiles: number; tone?: string };
  foot?: { w: number; h: number };
  volume?: PropVolumeRecipe;
  seatSlots?: PropSeatSlot[];
}

/** Empreinte EFFECTIVE d'un type de prop — défaut 1×1. Source unique de la dérivation par les consommateurs. */
export const propFootOf = (prop: PropData | undefined): { w: number; h: number } => prop?.foot ?? { w: 1, h: 1 };

/**
 * Invariants de CATALOGUE que le schéma seul ne peut pas voir (référence croisée aux matériaux, cohérence
 * géométrique, unicité des places). Renvoie la liste des anomalies en français, `[]` = catalogue intègre.
 */
export function validatePropCatalog(entries: readonly PropData[], materials: readonly PropMaterialData[]): string[] {
  const known = new Set(materials.map((m) => m.id));
  const errors: string[] = [];
  for (const prop of entries) {
    const slots = new Set<string>();
    const approaches = new Set<string>();
    for (const primitive of prop.volume?.primitives ?? []) {
      if (!known.has(primitive.material)) errors.push(`${prop.id}: matériau inconnu « ${primitive.material} »`);
      const centre = [primitive.center.x, primitive.center.y, primitive.center.h];
      const dimensions = primitive.kind === 'cylinder'
        ? [primitive.radius, primitive.heightM]
        : [primitive.size.x, primitive.size.y, primitive.size.h];
      if ([...centre, ...dimensions].some((n) => !Number.isFinite(n))) errors.push(`${prop.id}: coordonnée non finie`);
      if (dimensions.some((n) => Number.isFinite(n) && n <= 0)) errors.push(`${prop.id}: dimension non positive`);
    }
    const { w, h } = propFootOf(prop);
    for (const slot of prop.seatSlots ?? []) {
      if (!slot.id.trim()) errors.push(`${prop.id}: slot sans id`);
      else if (slots.has(slot.id)) errors.push(`${prop.id}: slot dupliqué « ${slot.id} »`);
      slots.add(slot.id);
      const key = `${slot.approach.x},${slot.approach.y}`;
      if (approaches.has(key)) errors.push(`${prop.id}: approche dupliquée (${key})`);
      approaches.add(key);
      const dansEmpreinte = slot.approach.x >= -0.5 && slot.approach.x <= w - 0.5
        && slot.approach.y >= -0.5 && slot.approach.y <= h - 0.5;
      if (prop.solid && dansEmpreinte) errors.push(`${prop.id}: approche « ${slot.id} » dans l’empreinte (${key})`);
    }
  }
  return errors;
}
