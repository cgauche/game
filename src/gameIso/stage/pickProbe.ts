/**
 * SONDE DE PICKING (recette, #1411 P2-C) — « que résoudrait un clic à CE pixel ? », sans cliquer.
 *
 * Miroir EXACT de la chaîne que le stage exécute au geste (`stage/useStagePointer` : pixel de
 * l'élément → point de viewBox (`viewBoxPointAt`) → point de projection (`stagePointAt`) → hit-test
 * SPRITE (`cidUnderPointer`) puis surface du SOL) — jamais un second calcul à tenir à jour.
 *
 * Elle vit ICI, dans `gameIso`, et s'ENREGISTRE auprès de l'outillage de recette (`state/devtools`) :
 * `src/state` ne dépend JAMAIS de `src/gameIso` (règle 3, garde `gameiso-purity`). Le sens est donc
 * celui du dépôt — le rendu se déclare au store, le store ne va jamais le chercher.
 */
import { useGame } from '../../state/store';
import { setPickProbe, type PickProbe } from '../../state/devtools';
import { resolveCursorZ } from '../../state/combatCursor';
import { inBattleId } from '../../state/combatants';
import { viewYawDeg } from '../../state/stageYaw';
import type { Dims } from '../../geometry/iso';
import { stagePointAt, viewBoxPointAt } from './stageCam';
import { poseFromDims, screenToTileAtLift } from './projection';
import { cidUnderPointer } from './spritePicker';

/** Ce que le picking résoudrait sous `px` (pixel CLIENT). `null` tant que le stage n'est pas monté. */
export const pickTileAt: PickProbe = (px) => {
  const st = useGame.getState();
  const svg = document.querySelector('svg.iso-stage') as SVGSVGElement | null;
  if (!st.scene || !svg) return null;
  const r = svg.getBoundingClientRect();
  if (!r.width || !r.height) return null;
  // Étage 1 : pixel de l'élément → point de viewBox (recouvrement `slice`), puis caméra du groupe défaite.
  const vb = viewBoxPointAt({ sx: px.x - r.left, sy: px.y - r.top }, { w: r.width, h: r.height });
  const g = stagePointAt(vb, st.camPan, st.zoom);
  // Étage 2 : le SPRITE d'abord (en combat, le picking cible la case du CORPS dessiné), le SOL sinon.
  const cid = st.mode === 'battle' && st.battle ? cidUnderPointer(px.x, px.y) : null;
  const occ = cid && st.battle ? inBattleId(st.battle, cid) : undefined;
  if (occ?.pos) return { tile: { x: occ.pos.x, y: occ.pos.y, z: occ.pos.z ?? 0 }, cid, via: 'sprite' };
  const dims: Dims = { ...st.scene.dimensions, rot: st.camRot, view: st.viewMode, edge: st.camEdge, yawDeg: viewYawDeg(st.camRot, st.camEdge) };
  const pose = poseFromDims(dims);
  for (const z of st.scene.layers.map((l) => l.z).sort((a, b) => b - a)) {
    const t = screenToTileAtLift(pose, { x: g.x, y: g.y }, z);
    if (t.x < 0 || t.y < 0 || t.x >= dims.w || t.y >= dims.h) continue;
    if (resolveCursorZ(st.scene, t.x, t.y) !== z) continue;
    return { tile: { x: t.x, y: t.y, z }, cid: null, via: 'sol' };
  }
  return { tile: null, cid: null, via: 'aucune' };
};

setPickProbe(pickTileAt);
