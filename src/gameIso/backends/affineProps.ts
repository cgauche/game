/**
 * BACKEND ÉCRAN-AFFINE des props (iso losange · edge-on · vue du dessus) : PROFONDEUR de tri d'un prop
 * (empreinte au coin caméra-proche). Les props — décor de scène ET décor de terrain (`overlayProp`) —
 * se rendent TOUS en billboard React (BodyToken, stage/tokens) ; ce module ne fournit que leur profondeur.
 */
import { footprintDepth, type Dims } from '../../geometry/iso';
import type { PropEl } from '../builders/types';

/** Profondeur de tri d'un prop : empreinte au coin caméra-proche (comme les bâtiments). */
export function propDepth(el: PropEl, dims: Dims): number {
  return footprintDepth(el.cell.x, el.cell.y, el.span?.w ?? 1, el.span?.h ?? 1, dims, el.cell.z);
}
