import { useMemo } from 'react';
import { useGame } from '../../state/store';
import { isIndoor } from '../../state/scene';
import { computeStateVisible, sceneLightField } from '../../state/visionState';
import { makeCamera, VW, VH } from './camera';
import { buildPovDrawList } from './geometry';
import { AMBIANCE, povAmbianceDefs } from '../catalog/ambiance';
import { PovBillboards } from './billboards';

/**
 * POV — couche RÉACTIVE (rendu SVG première personne). Ne fait AUCUN calcul : lit l'état, appelle le
 * noyau PUR (`makeCamera` + `buildPovDrawList`) et pose les polygones + les billboards d'entités. La
 * géométrie n'est recalculée qu'au PAS ou au PIVOT (memo sur partyPos/cap/lumière) — pas par frame.
 * Monté par `CampaignView` en exploration quand `povActive` (le combat reste sur `IsoStage`). Le cap =
 * regard du meneur `facing[party[0].id]` (le même que `moveParty`/`pivotParty` écrivent). TOUT vient de
 * la scène PARTAGÉE (terrain, murs, hauteurs, entités) : éditer en iso impacte le POV sans code dédié.
 * L'AMBIANCE (ciel, brumes, vignette) vient de la def partagée (`catalog/ambiance`) — zéro couleur ici.
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
  const bg = indoor ? AMBIANCE.pov.fogIndoor : AMBIANCE.pov.fogOutdoor;
  return (
    <div className="pov-stage" style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: bg }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice">
        {/* Ciel d'extérieur (pov-sky : bleu → brume d'horizon) + vignette — defs d'ambiance PARTAGÉES. */}
        <defs dangerouslySetInnerHTML={{ __html: povAmbianceDefs() }} />
        {/* Fond : ciel dégradé dehors (plafond non dessiné), sombre en intérieur. */}
        <rect x={0} y={0} width={VW} height={VH} fill={indoor ? bg : 'url(#pov-sky)'} />
        {view.draw.map((d) => (
          <polygon key={d.key} points={d.points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill={d.fill} />
        ))}
        <PovBillboards scene={scene} cam={view.cam} visible={view.visible} />
        <rect x={0} y={0} width={VW} height={VH} fill="url(#pov-vignette)" pointerEvents="none" />
      </svg>
    </div>
  );
}
