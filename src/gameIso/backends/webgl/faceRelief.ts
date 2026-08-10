/**
 * PROFONDEUR d'une `Face` du pivot — UNE résolution matériau → épaisseur MONDE (m), depuis les MÊMES
 * catalogues que la couleur (`faceColors.ts`) : structures (`wallPartDepthM`, par apparence × partie),
 * toiture (`roofFasciaThickM`). Pendant GÉOMÉTRIQUE de `faceSurface` : aucune épaisseur n'est écrite
 * ici, elles vivent toutes en DONNÉE d'apparence.
 *
 * `worldTris.ts` reste PUR et Node-safe (aucun catalogue) : il reçoit cette profondeur en paramètre et
 * ne décide que de la FORME du volume (boîte centrée sur le plan médian).
 */
import { facadeStructureAppearance } from '../../catalog/facades';
import { wallPartDepthM, type WallPart } from '../../catalog/structures';
import { roofFasciaThickM, roofMaterial } from '../../catalog/roofs';
import { wallThicknessM, type FaceDepth } from './worldTris';
import type { Face } from '../../builders/types';

/** Épaisseur MONDE (m) du volume d'une face, ou `undefined` quand la face reste un PLAN.
 *
 *  Restent PLATS, et c'est leur morphologie qui le dit — pas une dette :
 *  — `roof:soffite` (`builders/roofs.ts`) : plan OBLIQUE **coplanaire au pan** qu'il prolonge ; lui
 *    donner une épaisseur le décollerait de la couverture qu'il continue ;
 *  — `terrain:wedge` (`builders/floors.ts`) : plan HORIZONTAL de raccord entre deux nappes — aucun
 *    chant à éclairer, et `faceQuadsOriented` ne volumise que les plans VERTICAUX ;
 *  — les PANS de toit (`N`/`E`/`S`/`O`) et les nappes de sol, pour la même raison.
 *  Seule la planche de rive (`roof:fascia`), verticale et de morphologie de plinthe, prend un volume. */
export function faceDepthM(face: Face, mpt: number): number | undefined {
  const { domain, id, part } = face.material;
  if (!part) return undefined;
  if (domain === 'structure')
    return wallPartDepthM(facadeStructureAppearance(id), part as WallPart, wallThicknessM(mpt));
  if (domain === 'roof' && part === 'fascia') return roofFasciaThickM(roofMaterial(id));
  return undefined;
}

/** Le résolveur de profondeur d'une scène à l'échelle `mpt` — la forme qu'attend `facesGeometry`. */
export function faceDepthOf(mpt: number): FaceDepth {
  return (face) => faceDepthM(face, mpt);
}
