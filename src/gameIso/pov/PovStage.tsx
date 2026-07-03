import { useMemo } from 'react';
import { useGame } from '../../state/store';
import { isIndoor } from '../../state/scene';
import { sceneIsDark } from '../../state/sceneRules';
import { computeStateVisible, sceneLightField } from '../../state/visionState';
import { ambientScalar } from '../../state/vision';
import { makeCamera, VW, VH } from './camera';
import { buildPovDrawList } from './geometry';
import { AMBIANCE, povAmbianceDefs } from '../catalog/ambiance';
import { DEFS } from '../sprites';
import { buildPovBillboards, paintOrder, type Painted } from './billboards';
import type { DrawItem } from './geometry';

/** Nœud SVG d'une pièce de géométrie (tracé LOD matériaux OU polygone plein) — sa clé stable = `d.key`. */
function drawNode(d: DrawItem): JSX.Element {
  return d.path ? (
    <path key={d.key} className={d.cls} d={d.path} fill={d.fill ?? 'none'} stroke={d.stroke} strokeWidth={d.strokeW} strokeLinecap="round" opacity={d.opacity} />
  ) : (
    <polygon key={d.key} className={d.cls} points={d.points!.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill={d.fill} opacity={d.opacity} />
  );
}

/**
 * POV — couche RÉACTIVE (rendu SVG première personne). Ne fait AUCUN calcul : lit l'état, appelle le
 * noyau PUR (`makeCamera` + `buildPovDrawList`) et pose la géométrie ET les billboards d'entités dans UN
 * SEUL peintre fusionné (`paintOrder`, loin→près) → un mur cache une créature qui est derrière lui, et
 * une créature devant lui le recouvre (plus de billboards toujours au-dessus des murs). La géométrie
 * n'est recalculée qu'au PAS ou au PIVOT (memo sur partyPos/cap/lumière) — pas par frame ; l'idle des
 * billboards s'anime dans son propre rAF isolé (`usePovIdle`), clés stables → aucun remontage au tri.
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
    // Nuit = mise en scène `lightLevel` (≤ 0.5) sinon l'obscurité d'horloge (`sceneIsDark`) → vitres allumées.
    const night = lightLevel != null ? lightLevel <= 0.5 : sceneIsDark(scene, gameTime);
    return { cam, visible, draw: buildPovDrawList(scene, cam, visible, light, night) };
  }, [scene, partyPos, dir, party, gameTime, lightLevel]);

  if (!scene || !view) return null;
  const indoor = isIndoor(scene);
  const bg = indoor ? AMBIANCE.pov.fogIndoor : AMBIANCE.pov.fogOutdoor;
  // Voile de nuit IDENTIQUE à l'iso (`AmbianceVeils`) : la MÊME luminosité de scène (`ambientScalar` →
  // honore `scene.ambientLight`) assombrit les deux vues d'un cran égal → ISO et POV suivent le niveau
  // ensemble (le POV, jusqu'ici, gardait son ciel clair même de nuit / à bas niveau).
  const povVeil = (1 - ambientScalar(scene, gameTime, lightLevel ?? null)) * AMBIANCE.iso.nightVeilMax;
  // PEINTRE UNIQUE : la géométrie (`view.draw` → un polygone/tracé chacun) ET les billboards (créatures,
  // props) fusionnés dans UN tableau trié loin→près. Deux profondeurs dans le MÊME espace mètres-caméra
  // (DrawItem.depth ⇄ footAnchor.depth) → un mur à 5 m se peint après une créature à 8 m et avant une à 3 m.
  const painted: Painted[] = paintOrder([
    ...view.draw.map((d): Painted => ({ key: d.key, depth: d.depth, node: drawNode(d) })),
    ...buildPovBillboards(scene, view.cam, view.visible),
  ]);
  return (
    <div className="pov-stage" style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: bg }}>
      <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice">
        {/* Ciel d'extérieur (pov-sky : bleu → brume d'horizon) + vignette — defs d'ambiance PARTAGÉES,
            + gradients des sprites (les billboards de props les référencent). */}
        <defs dangerouslySetInnerHTML={{ __html: povAmbianceDefs() + DEFS }} />
        {/* Fond : ciel dégradé dehors (plafond non dessiné), sombre en intérieur. */}
        <rect x={0} y={0} width={VW} height={VH} fill={indoor ? bg : 'url(#pov-sky)'} />
        {painted.map((p) => p.node)}
        {/* Voile CHAUD (miroir de l'iso `g_warm`) — réconcilie la température des matériaux ; sous la nuit/vignette. */}
        {!indoor && <rect x={0} y={0} width={VW} height={VH} fill="url(#pov-warm)" pointerEvents="none" />}
        {povVeil > 0.001 && <rect x={0} y={0} width={VW} height={VH} fill={AMBIANCE.iso.nightVeil} opacity={povVeil} pointerEvents="none" />}
        <rect x={0} y={0} width={VW} height={VH} fill="url(#pov-vignette)" pointerEvents="none" />
      </svg>
    </div>
  );
}
