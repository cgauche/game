/**
 * BACKEND ÉCRAN-AFFINE des surbrillances de combat : projette un élément sémantique du builder
 * (`builders/highlights`) en losange/anneau SVG — la caméra ET les couleurs (catalogue `highlightTints`,
 * teintes d'équipe) vivent ici. Profondeur = sa case (+0.25 : juste au-dessus du sol −0.5, sous les jetons
 * +0.5), interclassée par sa vraie position écran, jamais en bande par étage.
 */
import { depth, diamondPath, type Dims } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';
import { tileTint } from '../teamColors';
import { WALK_TINT, RUN_TINT, ZONE_SMOKE_TINT, ZONE_FIRE_TINT, RING_CROWD_TINT, RING_ALLY_TINT, RING_TARGET_TINT, RANGE_BAND_TINT } from '../highlightTints';
import type { HighlightEl } from '../builders/highlights';

export function highlightDepth(el: HighlightEl, dims: Dims): number {
  return depth(el.cell.x, el.cell.y, dims, el.cell.z) + 0.25;
}

/** JSX d'une surbrillance — mêmes attributs que l'historique, par nature. NB : les grilles de Marche/
 *  Course n'ont volontairement PAS `pointerEvents:none` (parité picking `elementFromPoint`). */
export function highlightJsx(el: HighlightEl, dims: Dims): JSX.Element {
  const d = diamondPath(el.cell.x, el.cell.y, dims, el.h ? metricToLift(el.h) : 0);
  switch (el.kind) {
    // `data-tile="x,y"` (#198) : adressabilité DOM BORNÉE à l'ensemble déjà surligné (Marche/Course —
    // déplacement normal ET modes-case Pousser/Téléportation qui réutilisent la MÊME grille via
    // `displayedReach`/`battle.reachable`), jamais toute la carte — recette Playwright + clic testable.
    case 'walk':
      return <path key={el.key} data-tile={`${el.cell.x},${el.cell.y}`} d={d} fill={WALK_TINT} opacity={0.32} />;
    case 'run':
      return <path key={el.key} data-tile={`${el.cell.x},${el.cell.y}`} d={d} fill={RUN_TINT} opacity={0.24} />;
    case 'team':
      return <path key={el.key} d={d} fill={tileTint(el.hero, el.active)} opacity={el.active ? 0.3 : 0.2} pointerEvents="none" />;
    case 'zone':
      return (
        <path key={el.key} d={d} fill={el.smoke ? ZONE_SMOKE_TINT : ZONE_FIRE_TINT} opacity={el.smoke ? 0.5 : 0.35} pointerEvents="none" />
      );
    case 'ring':
      return el.tone === 'crowd' ? (
        <path key={el.key} d={d} fill={RING_CROWD_TINT} opacity={0.34} stroke={RING_CROWD_TINT} strokeWidth={2} pointerEvents="none" />
      ) : (
        <path key={el.key} d={d} fill="none" stroke={el.tone === 'ally' ? RING_ALLY_TINT : RING_TARGET_TINT} strokeWidth={2.5} opacity={0.9} pointerEvents="none" />
      );
    case 'rangeBand':
      return <path key={el.key} d={d} fill={RANGE_BAND_TINT[el.tone]} opacity={0.26} pointerEvents="none" />;
  }
}
