/**
 * Contrats NEUTRES du décor : type de prop app-owned (`props.json`), recette VOLUMIQUE locale, matériaux
 * et places assises. Vivent hors de `src/data/index.ts` pour rester importables par `src/state` comme par
 * `src/gameIso` sans traverser le chargeur app-owned. PUR — aucune donnée, aucune caméra, aucun rendu.
 *
 * Repère LOCAL d'une recette : origine au CENTRE de la case d'ancrage (coin NO de l'empreinte), `x`/`y`
 * en cases, `h` en mètres depuis le sol de la case. L'orientation vient de `SceneEntity.facing`.
 *
 * CAP D'IDENTITÉ = `N` — contrat de DONNÉE, à connaître pour authorer : une recette (et les
 * `seatSlots` qui l'accompagnent) s'écrit FACE AU NORD, front vers `y` négatif, et c'est à ce cap
 * seul qu'elle sort telle qu'authorée. Les sept autres caps la tournent de 45° par cran, en sens
 * horaire (l'ordre de `DIR8_ORDER`).
 *
 * PIÈGE QUI EN DÉCOULE : une instance de scène SANS `facing` vaut `S` (le défaut canonique du monde),
 * donc un DEMI-TOUR par rapport à la recette. Un meuble à dos (comptoir, âtre, lit) placé sans cap
 * explicite présente donc son dos là où l'auteur a dessiné sa face : l'auteur pose le cap, il ne le
 * laisse pas au défaut. Matérialisé par `builders/propVolumes.test.ts`.
 */
import { DIR8_ORDER, type Dir8 } from '../state/dir8';

/**
 * Rotation d'un point du repère LOCAL d'une recette vers le repère de la scène, au cap d'auteur —
 * l'UNIQUE définition de ce que `SceneEntity.facing` fait subir à une géométrie de décor (volumes,
 * ancres de place, cases d'abord). Vit ici, à l'étage NEUTRE, pour être servie aussi bien au
 * builder volumique (`gameIso`) qu'à la résolution d'assise (`state`) : deux copies divergeraient.
 * `N` (index 0 de `DIR8_ORDER`) est l'identité ; chaque cran vaut 45° horaires. PURE.
 */
export function rotatePropLocal(x: number, y: number, facing: Dir8): [number, number] {
  const a = DIR8_ORDER.indexOf(facing) * Math.PI / 4;
  return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
}

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
 *  l'ancre de l'empreinte) depuis laquelle on rejoint la place.
 *  `id` : préfixé `place-` — il entre dans l'index GLOBAL des ids de la donnée authorée
 *  (`scripts/docs/lib/structures-scan.mts`), où un mot commun (`nord`) résoudrait depuis un autre
 *  dataset. Il reste keyé sous son meuble dans `Scene.seatAssignments` (`propId → slotId`). */
export interface PropSeatSlot { id: string; anchor: PropPoint3; facing: Dir8; approach: { x: number; y: number } }

/** Matériau de rendu d'une primitive : couleur de base + réponse à la lumière. Aucune émission — une
 *  source lumineuse est un `light` de prop/d'instance, jamais un matériau. */
export interface PropMaterialData { id: string; type: 'propMaterials'; label: string; color: string; roughness: number; metalness: number }

/**
 * Type de PROP/décor app-owned : couche SÉMANTIQUE (physique `solid`, opacité `opaque`, classe de
 * `cover`, émission de lumière `light`, empreinte `foot`) ET géométrie locale (`volume`, `seatSlots`) —
 * le rendu SVG de vignette reste au catalogue gameIso. Vérité UNIQUE des dimensions d'un
 * décor : une instance de scène ne redéclare aucune empreinte. Lu par la walkability (`sceneRules`), la
 * Ligne de Vue/couvert (`lineOfSight`), la lumière (`vision`) et le monde volumique. Édité au Codex.
 * Un prop ABSENT du dataset = passable, transparent, sans couvert, sans lumière et sans empreinte.
 */
export interface PropData {
  id: string;
  type: 'props';
  /** Nom d'auteur du décor. Miroir du `label` de la def d'ART du même id
   *  (`src/gameIso/catalog/decor/defs/<id>.ts`) — parité gardée par `src/data/props-label-parite.test.ts`. */
  label: string;
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
