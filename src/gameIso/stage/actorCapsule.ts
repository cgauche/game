/**
 * CAPSULE ÉCRAN d'un acteur — le volume pieds→tête qu'il occupe une fois projeté, PARTAGÉ par les
 * deux voies : la caméra (visée du sujet, `IsoStage`), la géométrie d'occlusion de la voie affine et
 * la loi de dégagement du monde volumique (`cleared`, `VolumetricWorld`). Rien ici ne connaît le
 * peintre : c'est de la géométrie de scène, pas un backend.
 */
import { Dims, tileCenter, depth, TW, type ActorCapsule } from '../../geometry/iso';
import { metricToLift } from '../../state/relief';

/** Demi-largeur ÉCRAN du jeton — rayon de la capsule de l'acteur (`actorCapsuleOf`, visée caméra et
 *  géométrie d'occlusion). Calée sur le CORPS DESSINÉ : elle couvre la carrure la PLUS LARGE qu'un
 *  héros de Taille Moyenne ou moindre puisse présenter (gabarit `courtaud` du Nain, `build` au
 *  maximum), à l'échelle de token d'un combattant (`combatantObjs`). Sous-couvrir manquerait les
 *  occulteurs posés sur les épaules — le défaut d'origine. Le contrat (couvrir le corps MESURÉ sans
 *  le doubler) est tenu par `CulledScene.test.tsx`, qui remesure le rig au lieu de figer un nombre. */
const TOKEN_HALF_WIDTH = TW * 0.37;

export function actorCapsuleOf(
  actor: { x: number; y: number; h: number },
  dims: Dims,
): ActorCapsule {
  const base = metricToLift(actor.h);
  const top = base + 1;
  const foot = tileCenter(actor.x, actor.y, dims, base);
  const head = tileCenter(actor.x, actor.y, dims, top);
  return {
    segment: [{ x: foot.cx, y: foot.cy }, { x: head.cx, y: head.cy }],
    radius: TOKEN_HALF_WIDTH,
    depth: depth(actor.x, actor.y, dims, base),
    vertical: [base, top],
  };
}
