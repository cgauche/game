/**
 * SPIKE WebGL — COULEUR d'une `Face` du pivot, résolue par DOMAINE depuis les MÊMES catalogues que les
 * deux backends existants : structures (`wallPartColor`, partagé avec le POV), relief (`reliefMaterial`),
 * toiture (`roofMaterial`), terrain (`swatch` du registre `TERRAIN_DEFS`). Aucun littéral de couleur ici.
 *
 * Les DEUX modes d'usage du renderer (unlit = couleur cuite au sommet ; lit = matériau éclairé) partent
 * de CETTE couleur de base : le mode est un choix de MATÉRIAU, pas de couleur, et ne se paramètre donc
 * pas ici. Aucun ombrage d'écran pré-calculé n'y est cuit — la lumière du renderer le remplace.
 */
import { reliefMaterial } from '../../catalog/relief';
import { roofMaterial } from '../../catalog/roofs';
import { facadeStructureAppearance } from '../../catalog/facades';
import { wallPartColor, type WallPart } from '../../catalog/structures';
import { TERRAIN_DEFS } from '../../../state/terrain';
import type { Face } from '../../builders/types';

/** Modes de rendu d'une face — deux MATÉRIAUX du renderer, une seule couleur de base (`faceColor`). */
export type ColorMode = 'unlit' | 'lit';

const TERRAIN_BY_ID = new Map(TERRAIN_DEFS.map((t) => [t.id, t]));
/** Sol sans terrain connu — même repli que le POV (`pov/geometry.ts:95`). */
const FLOOR_FALLBACK = reliefMaterial('sol-inconnu').face;

function reliefColor(id: string, part: string | undefined): string {
  const m = reliefMaterial(id);
  return (part === 'ramp' ? m.slopeTop : undefined) ?? m.face;
}

function roofColor(id: string, part: string | undefined): string {
  const sh = roofMaterial(id);
  if (part === 'soffite') return sh.soffite ?? sh.S ?? sh.N ?? FLOOR_FALLBACK;
  if (part === 'fascia') return sh.fascia ?? sh.line ?? sh.S ?? sh.N ?? FLOOR_FALLBACK;
  return sh[part as 'N' | 'E' | 'S' | 'O'] ?? sh.N ?? FLOOR_FALLBACK;
}

/** Couleur de base (`#rrggbb` ou toute couleur CSS des defs) d'une face, dans les deux modes. */
export function faceColor(face: Face): string {
  const { domain, id, part } = face.material;
  switch (domain) {
    case 'structure':
      return wallPartColor(facadeStructureAppearance(id), part as WallPart);
    case 'relief':
      return reliefColor(id, part);
    case 'roof':
      return roofColor(id, part);
    case 'terrain':
      return TERRAIN_BY_ID.get(id)?.swatch ?? FLOOR_FALLBACK;
  }
}
