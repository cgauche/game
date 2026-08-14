import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useGame } from '../../state/store';
import { partyLeaderOf } from '../../state/combatants';
import { isIndoor, sceneMetresPerTile } from '../../state/scene';
import { sceneIsDark } from '../../state/sceneRules';
import { computeStateVisible, sceneLightField, sceneLightSources } from '../../state/visionState';
import { ambientScalar } from '../../state/vision';
import { getStageBackend, subscribeStageBackend } from '../../state/stage3d';
import { makeCamera, VW, VH } from './camera';
import { buildPovDrawList } from './geometry';
import { AMBIANCE, nightVeilAlpha, povAmbianceDefs } from '../catalog/ambiance';
import { DEFS } from '../sprites';
import { buildPovBillboards, paintOrder, type Painted } from './billboards';
import { buildTokens } from '../builders/tokens';
import { buildProps } from '../builders/props';
import { tintFor } from '../backends/webgl/visibilityTint';
import type { KeepEl, TintAt } from '../backends/webgl/sceneMeshes';
import { useWalkAnim } from '../fx/useWalkAnim';
import { VolumetricWorld } from '../stage/VolumetricWorld';
import type { DrawItem } from './geometry';

/** Nœud SVG d'une pièce de géométrie (tracé LOD matériaux OU polygone plein) — sa clé stable = `d.key`. */
function drawNode(d: DrawItem): JSX.Element {
  return d.path ? (
    <path key={d.key} className={d.cls} d={d.path} fill={d.fill ?? 'none'} stroke={d.stroke} strokeWidth={d.strokeW} strokeLinecap="round" opacity={d.opacity} />
  ) : (
    <polygon key={d.key} className={d.cls} points={d.points!.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')} fill={d.fill} opacity={d.opacity} />
  );
}

/** À HAUTEUR D'ŒIL, TOUT SE DESSINE (#1176, P3-1a) : le dégagement d'architecture est une loi de la vue
 *  de PLATEAU (retirer ce qui coiffe le groupe pour voir dedans depuis le dessus). Appliqué en première
 *  personne, il ouvrirait le ciel au-dessus de la tête du groupe dès qu'il entre sous un toit.
 *
 *  ÉCART RÉSIDUEL — le CRAN de retrait d'une masse jamais explorée diffère entre les deux voies. La voie
 *  volumique la teinte par le facteur de couleur de sommet partagé (`tintFor` → `AMBIANCE.fogTint.unknown`
 *  = 0,15) ; la voie SVG la peint elle aussi (`buildPovDrawList(…, exploredSet)` rend TOUTES les couches,
 *  l'inconnu compris) mais en LUMIÈRE D'AMBIANCE (`geometry.ts` `POV_AMBIENT.unknown` =
 *  `ambientUnseen × fogTint.unknown ÷ fogTint.explored` = 0,214), une échelle qui n'est pas celle d'une
 *  teinte de couleur. Aucune des deux ne filtre l'inconnu : la lisibilité de ce cran est une décision de
 *  GOÛT, à trancher à la recette, pas un correctif de câblage. */
const TOUT_SE_DESSINE: KeepEl = () => true;

/** Aucune case visible : référence STABLE des rendus sans scène (rien à mémoïser dessus). */
const AUCUNE_CASE: ReadonlySet<string> = new Set<string>();

/**
 * POV — couche RÉACTIVE de la vue première personne. Deux VOIES de rendu du monde, une seule intention :
 *  - AFFINE (SVG) : ne fait AUCUN calcul — lit l'état, appelle le noyau PUR (`makeCamera` +
 *    `buildPovDrawList`) et pose la géométrie ET les billboards d'entités dans UN SEUL peintre fusionné
 *    (`paintOrder`, loin→près) → un mur cache une créature qui est derrière lui, et une créature devant
 *    lui le recouvre. La géométrie n'est recalculée qu'au PAS ou au PIVOT (memo sur partyPos/cap/lumière) ;
 *    l'idle des billboards s'anime dans son propre rAF isolé (`usePovIdle`), clés stables.
 *  - VOLUMIQUE (#1176, P3-1a) : le MÊME monde que le stage isométrique (`stage/VolumetricWorld`),
 *    regardé par une caméra PERSPECTIVE à hauteur d'homme (`StageFrame` en mode `pov`). Cet écran n'en
 *    fournit que les vérités de scène — les mêmes builders que l'iso, jamais une seconde dérivation.
 * Monté par `CampaignView` en exploration quand `povActive` (le combat reste sur `IsoStage`). Le cap =
 * `facing[party[0].id]`, la case du roster sur laquelle `moveParty`/`pivotParty` écrivent le regard du
 * groupe ; le MARCHEUR, lui, est le meneur VALIDE (`partyLeaderOf`) — c'est son glissement que suit
 * l'œil, comme le jeton de groupe et les lampes portées. TOUT vient de
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
  const explored = useGame((s) => s.explored);
  const markExplored = useGame((s) => s.markExplored);
  // VOIE DE RENDU du monde (#1176) — hors store : elle décrit le chantier, pas le monde. Même
  // couture que `IsoStage`, donc UN interrupteur pour les deux hôtes.
  const stageBackend = useSyncExternalStore(subscribeStageBackend, getStageBackend, getStageBackend);
  const webgl = stageBackend === 'webgl';

  const dir = (party[0] && facing[party[0].id]) || 'S';
  const exploredSet = useMemo(() => new Set(explored[scene?.id ?? ''] ?? []), [explored, scene?.id]);

  const view = useMemo(() => {
    if (!scene) return null;
    const input = { scene, battle: null, party, partyPos, gameTime, lightLevel };
    const visible = computeStateVisible(input);
    const { light } = sceneLightField(input);
    // Nuit = mise en scène `lightLevel` (≤ 0.5) sinon l'obscurité d'horloge (`sceneIsDark`) → vitres allumées.
    const night = lightLevel != null ? lightLevel <= 0.5 : sceneIsDark(scene, gameTime);
    // La liste de dessin SVG est la sortie de la voie AFFINE seule : en volumique, la bâtir coûterait un
    // balayage de scène par pas pour un tableau que personne ne peint.
    if (webgl) return { visible, cam: null, draw: null };
    const cam = makeCamera(scene, partyPos, dir);
    return { visible, cam, draw: buildPovDrawList(scene, cam, visible, light, night, exploredSet) };
  }, [scene, partyPos, dir, party, gameTime, lightLevel, exploredSet, webgl]);

  // Accumulation persistante de l'exploré — la MÊME couture que l'iso (`IsoStage`) : explorer en
  // première personne nourrit la mémoire de carte, et un déjà-vu hors champ se rend en souvenir au
  // lieu de retomber au cran de l'inconnu (no-op si rien de neuf → pas de boucle de rendu).
  useEffect(() => {
    if (view?.visible.size) markExplored([...view.visible]);
  }, [view?.visible, markExplored]);

  // ── VOIE VOLUMIQUE : les vérités de scène que le monde partagé attend, par les MÊMES builders que
  // `IsoStage` (aucune seconde dérivation), à l'étage du groupe et sans isolement de couche.
  const visible = view?.visible ?? AUCUNE_CASE;
  const activeZ = partyPos.z ?? 0;
  const walksRef = useWalkAnim(false); // la voie volumique lit la marche dans SA boucle de rendu (P2-4)
  const tintAt = useMemo<TintAt>(() => (key: string) => tintFor(key, visible, exploredSet), [visible, exploredSet]);
  const tokenEls = useMemo(
    () => (scene && webgl ? buildTokens(scene, visible, null, { activeZ, viewZ: null, top: false }) : []),
    [scene, webgl, visible, activeZ],
  );
  const propEls = useMemo(
    () => (scene && webgl ? buildProps(scene, visible, { activeZ, viewZ: null }) : []),
    [scene, webgl, visible, activeZ],
  );
  const lights = useMemo(
    () => (scene && webgl ? sceneLightSources({ scene, battle: null, party, partyPos }) : []),
    [scene, webgl, party, partyPos],
  );

  if (!scene || !view) return null;
  const indoor = isIndoor(scene);
  const bg = indoor ? AMBIANCE.pov.fogIndoor : AMBIANCE.pov.fogOutdoor;
  if (webgl) {
    // Le meneur ne porte AUCUN billboard (`partyToken` nul) : on regarde par ses yeux. C'est en
    // revanche SON glissement de marche que la caméra suit (`cid`) — l'œil avance donc en continu.
    return (
      <div className="pov-stage" style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: bg }}>
        <VolumetricWorld
          scene={scene}
          mpt={sceneMetresPerTile(scene)}
          frame={{ mode: 'pov', partyPos, facing: dir, indoor, cid: partyLeaderOf(party)?.id ?? null }}
          tintAt={tintAt}
          keepEl={TOUT_SE_DESSINE}
          tokenEls={tokenEls}
          propEls={propEls}
          walksRef={walksRef}
          partyToken={null}
          gameTime={gameTime}
          lightLevel={lightLevel}
          lights={lights}
          battle={null}
        />
        {/* VOILES D'ÉCRAN (#1176, P3-1c) : voile chaud d'extérieur et vignette, les MÊMES defs
            d'ambiance que la voie affine — ils se peignent PAR-DESSUS le canevas, jamais dans le
            volume (une vignette est une décoration de vue, pas une propriété du monde). Le voile de
            NUIT n'y est pas : la voie volumique porte son palier dans le VOLUME — ses lampes
            (`stageLights`) pour les surfaces, `ambianceLum` pour le ciel et les brumes
            (`povBackground`/`povFog`) — et un second propriétaire en peindrait deux l'un sur
            l'autre. */}
        <svg data-pov-veils width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
          <defs dangerouslySetInnerHTML={{ __html: povAmbianceDefs() }} />
          {!indoor && <rect x={0} y={0} width={VW} height={VH} fill="url(#pov-warm)" />}
          <rect x={0} y={0} width={VW} height={VH} fill="url(#pov-vignette)" />
        </svg>
      </div>
    );
  }
  // Voile de nuit IDENTIQUE à l'iso (`AmbianceVeils`) : la MÊME luminosité de scène (`ambientScalar` →
  // honore `scene.ambientLight`) assombrit les deux vues d'un cran égal → ISO et POV suivent le niveau
  // ensemble (le POV, jusqu'ici, gardait son ciel clair même de nuit / à bas niveau).
  const povVeil = nightVeilAlpha(ambientScalar(scene, gameTime, lightLevel ?? null));
  // PEINTRE UNIQUE : la géométrie (`view.draw` → un polygone/tracé chacun) ET les billboards (créatures,
  // props) fusionnés dans UN tableau trié loin→près. Deux profondeurs dans le MÊME espace mètres-caméra
  // (DrawItem.depth ⇄ footAnchor.depth) → un mur à 5 m se peint après une créature à 8 m et avant une à 3 m.
  const painted: Painted[] = paintOrder([
    ...view.draw!.map((d): Painted => ({ key: d.key, depth: d.depth, node: drawNode(d) })),
    ...buildPovBillboards(scene, view.cam!, view.visible),
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
