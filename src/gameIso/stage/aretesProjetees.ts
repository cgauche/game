/**
 * ARÊTES PROJETÉES — le pont entre le dériveur d'arêtes (`state/aretes.ts`, PUR et sans écran) et la
 * chaîne de picking (`stage/pickResolve.ts`, qui raisonne en pixels de stage).
 *
 * L'hôte de rendu (`stage/MondeDeCampagne.tsx`) FOURNIT les arêtes déjà filtrées par le contexte
 * (brouillard, contrôleur, couche active) — exactement comme il fournit `vise` au picking — et ce
 * module ne fait qu'une chose : les poser à l'écran par `tileEdge`, la MÊME géométrie que le peintre
 * (`stage/AreteOverlay.tsx`), au lift que le peintre reçoit.
 *
 * MÉMOÏSATION : la géométrie se rebâtit à chaque `pointermove` sans elle, et la chaîne la relit à
 * chaque pixel. `memoByRefDeps` la retient par identité de la LISTE d'arêtes plus les dépendances de
 * projection (`dims`, `lift`) — le patron de `pickResolve.sceneLifts`, jamais un cache à invalider.
 */
import { tileEdge, type Dims, type EdgeSide } from '../../geometry/iso';
import { memoByRefDeps } from '../../state/sceneMemo';
import type { AreteUtilisable } from '../../state/aretes';
import type { WallSide } from '../../state/scene';
import type { Pt } from '../../state/path';

/** Point du repère de PROJECTION du stage (celui où `tileCenter`/`tileEdge` dessinent). */
export interface PointEcran {
  cx: number;
  cy: number;
}

/** Une arête utilisable ET le segment qu'elle occupe à l'écran — les deux bouts que `tileEdge` rend. */
export interface AreteProjetee {
  arete: AreteUtilisable;
  a: PointEcran;
  b: PointEcran;
}

const memo = memoByRefDeps<readonly AreteUtilisable[], readonly AreteProjetee[]>();

/** Une arête de GRILLE, seule forme que `tileEdge` sait poser : les côtés DIAGONAUX d'un mur
 *  (`WallSide` `\` et `/`) n'occupent aucun segment de grille. Aucun des quatre dériveurs n'en rend,
 *  et pas de la même façon : escalade, chute et structure filtrent `N`/`E` au site
 *  (`state/aretes.ts`), les PORTES le tiennent du TYPE — `RoomPortal.edge.side` vaut `'N' | 'E'`
 *  (`state/roomPortals.ts:19`), une diagonale n'y compile pas. */
const estCardinale = (side: WallSide): side is EdgeSide & WallSide => side === 'N' || side === 'E';

/**
 * Les arêtes du contexte, posées à l'écran. `lift` est l'ÉLÉVATION d'affichage de la case d'où le
 * geste part — la fonction que l'hôte passe déjà au peintre (`SurcoucheIso.liftOf`), pas une seconde
 * hauteur bâtie ici. Une arête sans ancrage n'est pas projetée : sa case de départ est ce que le lift
 * lit (les structures sans contrôleur en main entrent au lot 1b-4).
 */
export function projeterAretes(
  aretes: readonly AreteUtilisable[],
  dims: Dims,
  lift: (p: Pt) => number,
): readonly AreteProjetee[] {
  return memo(aretes, [dims, lift], () => aretes.flatMap((arete) => {
    // CE QUE CE REFUS COUVRE, et pourquoi il est muet : une seule forme le déclenche aujourd'hui —
    // la structure sans contrôleur en main, dont l'ancrage est `null` par contrat (divergence (b) de
    // `state/aretes.ts`) et qui n'entre au picking qu'au lot 1b-4. Ce n'est donc pas une anomalie de
    // donnée à signaler, c'est un état nommé du dériveur : `aretesProjetees.test.ts` verrouille qu'AUCUNE
    // autre arête ne tombe ici (pas de diagonale, pas d'ancrage manquant ailleurs). Le jour où une
    // capacité y tombe pour une autre raison, c'est le banc qui rougit, pas un journal que nul ne lit.
    if (!arete.ancrage || !estCardinale(arete.side)) return [];
    const [a, b] = tileEdge(arete.x, arete.y, arete.side, dims, lift(arete.ancrage));
    return [{ arete, a, b }];
  }));
}

/** Distance du point `p` au SEGMENT [a,b], en pixels de projection. */
export function distanceAuSegment(p: { x: number; y: number }, a: PointEcran, b: PointEcran): number {
  const dx = b.cx - a.cx;
  const dy = b.cy - a.cy;
  const len2 = dx * dx + dy * dy;
  const s = len2 ? Math.max(0, Math.min(1, ((p.x - a.cx) * dx + (p.y - a.cy) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.cx + s * dx), p.y - (a.cy + s * dy));
}
