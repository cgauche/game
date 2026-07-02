/**
 * BACKEND ÉCRAN-AFFINE des surbrillances de combat : projette un élément sémantique du builder
 * (`builders/highlights`) en losange/anneau SVG — la caméra ET les couleurs (tokens :root / teintes
 * d'équipe) vivent ici. Profondeur = sa case (+0.25 : juste au-dessus du sol −0.5, sous les jetons
 * +0.5), interclassée par sa vraie position écran, jamais en bande par étage.
 */
import { depth, diamondPath, type Dims } from '../iso';
import { metricToLift } from '../../state/relief';
import { tileTint } from '../teamColors';
import type { HighlightEl } from '../builders/highlights';

export function highlightDepth(el: HighlightEl, dims: Dims): number {
  return depth(el.cell.x, el.cell.y, dims, el.cell.z) + 0.25;
}

/** JSX d'une surbrillance — mêmes attributs que l'historique, par nature. NB : les grilles de Marche/
 *  Course n'ont volontairement PAS `pointerEvents:none` (parité picking `elementFromPoint`). */
export function highlightJsx(el: HighlightEl, dims: Dims): JSX.Element {
  const d = diamondPath(el.cell.x, el.cell.y, dims, el.h ? metricToLift(el.h) : 0);
  switch (el.kind) {
    case 'walk':
      return <path key={el.key} d={d} fill="var(--combat-walk)" opacity={0.32} />;
    case 'run':
      return <path key={el.key} d={d} fill="var(--combat-run)" opacity={0.24} />;
    case 'team':
      return <path key={el.key} d={d} fill={tileTint(el.hero, el.active)} opacity={el.active ? 0.3 : 0.2} pointerEvents="none" />;
    case 'zone':
      return (
        <path key={el.key} d={d} fill={el.smoke ? 'var(--iso-zone-smoke)' : 'var(--iso-zone-fire)'} opacity={el.smoke ? 0.5 : 0.35} pointerEvents="none" />
      );
    case 'ring':
      return el.tone === 'crowd' ? (
        <path key={el.key} d={d} fill="var(--combat-crowd)" opacity={0.34} stroke="var(--combat-crowd)" strokeWidth={2} pointerEvents="none" />
      ) : (
        <path key={el.key} d={d} fill="none" stroke={el.tone === 'ally' ? 'var(--combat-ally)' : 'var(--combat-target)'} strokeWidth={2.5} opacity={0.9} pointerEvents="none" />
      );
  }
}
