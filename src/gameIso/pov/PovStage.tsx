import { useMemo } from 'react';
import { useGame } from '../../state/store';
import { isIndoor } from '../../state/scene';
import { computeStateVisible, sceneLightField } from '../../state/visionState';
import { makeCamera, VW, VH, FOG_COLOR } from './camera';
import { buildPovDrawList, FOG_OUTDOOR } from './geometry';
import { PovBillboards } from './billboards';

/**
 * POV — couche RÉACTIVE (rendu SVG première personne). Ne fait AUCUN calcul : lit l'état, appelle le
 * noyau PUR (`makeCamera` + `buildPovDrawList`) et pose les polygones + les billboards d'entités. La
 * géométrie n'est recalculée qu'au PAS ou au PIVOT (memo sur partyPos/cap/lumière) — pas par frame.
 * Monté par `CampaignView` en exploration quand `povActive` (le combat reste sur `IsoStage`). Le cap =
 * regard du meneur `facing[party[0].id]` (le même que `moveParty`/`pivotParty` écrivent). TOUT vient de
 * la scène PARTAGÉE (terrain, murs, hauteurs, entités) : éditer en iso impacte le POV sans code dédié.
 */
export function PovStage() {
  const scene = useGame((s) => s.scene);
  const partyPos = useGame((s) => s.partyPos);
  const party = useGame((s) => s.party);
  const facing = useGame((s) => s.facing);
  const gameTime = useGame((s) => s.gameTime);
  const lightLevel = useGame((s) => s.lightLevel);

  const dir = (party[0] && facing[party[0].id]) || 'S';

  const view = useMemo(() => {
    if (!scene) return null;
    const cam = makeCamera(scene, partyPos, dir);
    const input = { scene, battle: null, party, partyPos, gameTime, lightLevel };
    const visible = computeStateVisible(input);
    const { light } = sceneLightField(input);
    return { cam, visible, draw: buildPovDrawList(scene, cam, visible, light) };
  }, [scene, partyPos, dir, party, gameTime, lightLevel]);

  if (!scene || !view) return null;
  const indoor = isIndoor(scene);
  return (
    <div className="pov-stage" style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: indoor ? FOG_COLOR : FOG_OUTDOOR }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice">
        <defs>
          {/* Ciel d'extérieur : bleu en haut → brume d'horizon (= FOG_OUTDOOR, où se fond le lointain). */}
          <linearGradient id="pov-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5b83ac" />
            <stop offset="100%" stopColor={FOG_OUTDOOR} />
          </linearGradient>
          <radialGradient id="pov-vignette" cx="50%" cy="52%" r="72%">
            <stop offset="58%" stopColor="#000" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
          </radialGradient>
        </defs>
        {/* Fond : ciel dégradé dehors (plafond non dessiné), sombre en intérieur. */}
        <rect x={0} y={0} width={VW} height={VH} fill={indoor ? FOG_COLOR : 'url(#pov-sky)'} />
        {view.draw.map((d) => (
          <polygon key={d.key} points={d.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill={d.fill} />
        ))}
        <PovBillboards scene={scene} cam={view.cam} visible={view.visible} />
        <rect x={0} y={0} width={VW} height={VH} fill="url(#pov-vignette)" pointerEvents="none" />
      </svg>
    </div>
  );
}
