/**
 * BUILDER des marques DYNAMIQUES de combat (#1176, P3-0d) — celles qui SUIVENT le jeton qui glisse :
 * lien d'ENGAGEMENT entre deux combattants en mêlée, contour de l'unité ACTIVE, repère de position du
 * GROUPE hors combat. Pendant de `builders/highlights`, et même frontière : PUR et camera-free.
 *
 * Ce que cette dérivation rend, ce sont des cases LOGIQUES et des IDENTITÉS — jamais une position à
 * l'écran ni dans le monde. La position de l'INSTANT appartient à chaque voie de rendu, et les deux la
 * prennent au même canal de glissement : la voie affine à son rendu React (`stage/tokens`,
 * `WalkPos`), la voie volumique à sa boucle de frame (`stage/dynamicMarkPose`, `walkGlideM`).
 *
 * Pourquoi ces trois-là ne sont PAS dans `builders/highlights` : une marque de case s'y mesure à
 * l'ÉTAT (une portée, une zone, un anneau ne bougent pas entre deux états) ; celles-ci se posent à la
 * FRAME, entre deux états.
 */
import { isOutOfAction } from '../../engine/conditions';
import { projectStep } from '../../geometry/iso';
import { inBattleId } from '../../state/combatants';
import { footprintN } from '../../state/footprint';
import { mountOf } from '../../state/mount';
import type { Pt } from '../../state/path';
import type { BattleState } from '../../state/store';

/** GABARIT du lien d'engagement tel que la voie AFFINE le trace : épaisseur de trait et pointillés, en
 *  PIXELS de la projection SVG (`strokeWidth`, `strokeDasharray`). */
export const TETHER_STROKE_PX = 2;
export const TETHER_DASH_PX = 4;
export const TETHER_GAP_PX = 3;

/** Longueur ÉCRAN d'un PAS DE CASE dans la cadence LOSANGE : la projection du pas de grille `(1, 0)`,
 *  soit `hypot(TW/2, TH/2)` ≈ 35,78 px (`geometry/iso.projectStep`, branche losange). C'est l'échelle
 *  que la voie volumique reproduit — un pas de case y vaut `mpt` mètres et retombe sur les mêmes 35,78
 *  px à l'écran (`backends/webgl/cameras.affineScales`, vue `iso`). */
const PAS_DE_CASE_PX = Math.hypot(projectStep(null, { x: 1, y: 0 }).dx, projectStep(null, { x: 1, y: 0 }).dy);

/** Le MÊME gabarit en fractions de CASE : un pas de case vaut `PAS_DE_CASE_PX` pixels à l'écran et
 *  `mpt` mètres dans le monde volumique, donc `K · mpt` mètres se peignent aux pixels du gabarit affine
 *  LE LONG DES AXES DE LA GRILLE. Hors de ces axes les deux voies divergent par nature : l'affine mètre
 *  son pointillé à l'ÉCRAN, le volumique le sien dans le MONDE, et la projection isométrique n'a pas la
 *  même échelle dans toutes les directions. Un lien de mêlée relie des cases au CONTACT (#1176) :
 *  l'écart y reste sous le tiret. */
export const TETHER_WIDTH_K = TETHER_STROKE_PX / PAS_DE_CASE_PX;
export const TETHER_DASH_K = TETHER_DASH_PX / PAS_DE_CASE_PX;
export const TETHER_GAP_K = TETHER_GAP_PX / PAS_DE_CASE_PX;

/** Case LOGIQUE d'une marque dynamique (l'étage compris). */
export interface MarkCell {
  x: number;
  y: number;
  z: number;
}

/** Lien de mêlée entre DEUX combattants Engagés — une seule entrée par paire. */
export interface EngageTether {
  a: { id: string; cell: MarkCell };
  b: { id: string; cell: MarkCell };
}

/** L'unité ACTIVE et son EMPREINTE : un cavalier est représenté par sa MONTURE (`mountOf`). */
export interface ActiveFootprint {
  id: string;
  cell: MarkCell;
  /** Côté de l'empreinte, en cases. */
  n: number;
}

/** Les marques dynamiques d'une frame, dans l'ordre d'ÉMISSION historique de la voie affine. En LECTURE
 *  SEULE : une frame se dérive, elle ne se retouche pas — les deux voies lisent le MÊME relevé. */
export interface DynamicMarks {
  readonly tethers: readonly EngageTether[];
  readonly active: ActiveFootprint | null;
  /** Repère de position du GROUPE hors combat — sa case, sans glissement (cf. `dynamicHighlightObjs`). */
  readonly party: MarkCell | null;
}

/** Aucune marque dynamique — la valeur d'une voie qui n'en reçoit pas. GELÉE : elle est partagée par
 *  toutes les voies et toutes les frames, un appelant qui pousserait dedans la salirait pour tous. */
export const NO_DYNAMIC_MARKS: DynamicMarks = Object.freeze({ tethers: Object.freeze([]), active: null, party: null });

/**
 * Les marques dynamiques de l'instant. `battle` = le combat en cours (ou `null` hors combat), `party` =
 * la case du groupe quand le contexte l'affiche (le contexte — mode, dialogue ouvert — est tranché par
 * l'appelant, une seule fois, et les DEUX voies consomment le même verdict).
 */
export function dynamicMarks(battle: BattleState | null, party: Pt | null): DynamicMarks {
  const tethers: EngageTether[] = [];
  let active: ActiveFootprint | null = null;
  if (battle) {
    for (const c of battle.combatants) {
      if (!c.pos || isOutOfAction(c)) continue;
      for (const oid of c.engagedWith ?? []) {
        if (c.id >= oid) continue; // une seule ligne par paire
        const o = inBattleId(battle, oid);
        if (!o?.pos || isOutOfAction(o)) continue;
        tethers.push({
          a: { id: c.id, cell: { x: c.pos.x, y: c.pos.y, z: c.pos.z ?? 0 } },
          b: { id: o.id, cell: { x: o.pos.x, y: o.pos.y, z: o.pos.z ?? 0 } },
        });
      }
    }
    const actif = inBattleId(battle, battle.order[battle.turn]);
    const unité = actif ? mountOf(battle, actif) ?? actif : undefined;
    // C'est l'UNITÉ REPRÉSENTÉE qui doit être posée, pas le combattant actif : une monture posée porte
    // le contour même si son cavalier n'a pas de `pos` (il en est le passager, cf. `state/mount`).
    if (unité?.pos)
      active = {
        id: unité.id,
        cell: { x: unité.pos.x, y: unité.pos.y, z: unité.pos.z ?? 0 },
        n: footprintN(unité),
      };
  }
  return { tethers, active, party: party ? { x: party.x, y: party.y, z: party.z ?? 0 } : null };
}
