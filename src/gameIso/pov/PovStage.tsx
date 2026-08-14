import { useEffect, useMemo } from 'react';
import { useGame } from '../../state/store';
import { partyLeaderOf } from '../../state/combatants';
import { isIndoor, sceneMetresPerTile } from '../../state/scene';
import { computeStateVisible, sceneLightSources } from '../../state/visionState';
import { VW, VH } from './camera';
import { AMBIANCE, povAmbianceDefs } from '../catalog/ambiance';
import { buildTokens } from '../builders/tokens';
import { buildProps } from '../builders/props';
import { tintFor } from '../backends/webgl/visibilityTint';
import type { KeepEl, TintAt } from '../backends/webgl/sceneMeshes';
import { useWalkAnim } from '../fx/useWalkAnim';
import { VolumetricWorld } from '../stage/VolumetricWorld';

/** À HAUTEUR D'ŒIL, TOUT SE DESSINE (#1176, P3-1a) : le dégagement d'architecture est une loi de la vue
 *  de PLATEAU (retirer ce qui coiffe le groupe pour voir dedans depuis le dessus). Appliqué en première
 *  personne, il ouvrirait le ciel au-dessus de la tête du groupe dès qu'il entre sous un toit. */
const TOUT_SE_DESSINE: KeepEl = () => true;

/** Aucune case visible : référence STABLE des rendus sans scène (rien à mémoïser dessus). */
const AUCUNE_CASE: ReadonlySet<string> = new Set<string>();

/**
 * POV — couche RÉACTIVE de la vue première personne : le MÊME monde que le stage isométrique
 * (`stage/VolumetricWorld`), regardé par une caméra PERSPECTIVE à hauteur d'homme (`StageFrame` en mode
 * `pov`). Cet écran n'en fournit que les vérités de scène — les mêmes builders que l'iso, jamais une
 * seconde dérivation. « Pov » nomme la VUE, pas une voie de rendu : il n'y en a plus qu'une (#1176,
 * P3-4 C5b — le peintre SVG de première personne est mort avec sa géométrie et ses billboards).
 *
 * Monté par `CampaignView` en exploration quand `povActive` (le combat reste sur `IsoStage`). Le cap =
 * `facing[party[0].id]`, la case du roster sur laquelle `moveParty`/`pivotParty` écrivent le regard du
 * groupe ; le MARCHEUR, lui, est le meneur VALIDE (`partyLeaderOf`) — c'est son glissement que suit
 * l'œil, comme le jeton de groupe et les lampes portées. TOUT vient de la scène PARTAGÉE (terrain,
 * murs, hauteurs, entités) : éditer en iso impacte le POV sans code dédié. L'AMBIANCE (ciel, brumes,
 * vignette) vient de la def partagée (`catalog/ambiance`) — zéro couleur ici.
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

  const dir = (party[0] && facing[party[0].id]) || 'S';
  const exploredSet = useMemo(() => new Set(explored[scene?.id ?? ''] ?? []), [explored, scene?.id]);

  const vues = useMemo(() => {
    if (!scene) return null;
    return computeStateVisible({ scene, battle: null, party, partyPos, gameTime, lightLevel });
  }, [scene, party, partyPos, gameTime, lightLevel]);

  // Accumulation persistante de l'exploré — la MÊME couture que l'iso (`IsoStage`) : explorer en
  // première personne nourrit la mémoire de carte, et un déjà-vu hors champ se rend en souvenir au
  // lieu de retomber au cran de l'inconnu (no-op si rien de neuf → pas de boucle de rendu).
  useEffect(() => {
    if (vues?.size) markExplored([...vues]);
  }, [vues, markExplored]);

  // Les vérités de scène que le monde partagé attend, par les MÊMES builders que `IsoStage` (aucune
  // seconde dérivation), à l'étage du groupe et sans isolement de couche.
  const visible = vues ?? AUCUNE_CASE;
  const activeZ = partyPos.z ?? 0;
  const walksRef = useWalkAnim(false); // la voie volumique lit la marche dans SA boucle de rendu (P2-4)
  const tintAt = useMemo<TintAt>(() => (key: string) => tintFor(key, visible, exploredSet), [visible, exploredSet]);
  const tokenEls = useMemo(
    () => (scene ? buildTokens(scene, visible, null, { activeZ, viewZ: null, top: false }) : []),
    [scene, visible, activeZ],
  );
  const propEls = useMemo(
    () => (scene ? buildProps(scene, visible, { activeZ, viewZ: null }) : []),
    [scene, visible, activeZ],
  );
  const lights = useMemo(
    () => (scene ? sceneLightSources({ scene, battle: null, party, partyPos }) : []),
    [scene, party, partyPos],
  );

  if (!scene || !vues) return null;
  const indoor = isIndoor(scene);
  const bg = indoor ? AMBIANCE.pov.fogIndoor : AMBIANCE.pov.fogOutdoor;
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
      {/* VOILES D'ÉCRAN (#1176, P3-1c) : voile chaud d'extérieur et vignette, les defs d'ambiance
          partagées — ils se peignent PAR-DESSUS le canevas, jamais dans le volume (une vignette est une
          décoration de vue, pas une propriété du monde). Le voile de NUIT n'y est pas : le monde porte
          son palier dans le VOLUME — ses lampes (`stageLights`) pour les surfaces, `ambianceLum` pour le
          ciel et les brumes (`povBackground`/`povFog`) — et un second propriétaire en peindrait deux
          l'un sur l'autre. */}
      <svg data-pov-veils width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid slice" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} aria-hidden="true">
        <defs dangerouslySetInnerHTML={{ __html: povAmbianceDefs() }} />
        {!indoor && <rect x={0} y={0} width={VW} height={VH} fill="url(#pov-warm)" />}
        <rect x={0} y={0} width={VW} height={VH} fill="url(#pov-vignette)" />
      </svg>
    </div>
  );
}
