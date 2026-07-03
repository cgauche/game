/**
 * TopoScene — vue TOP-DOWN symbolique d'une scène (plan de niveau / minimap), PURE et sans store
 * (discipline de PortraitTile). N'est PAS un 2ᵉ moteur d'affichage : réutilise le MÊME pipeline que le
 * stage de jeu — builders camera-free (`buildFloors`/`buildWalls`) → couches `floorLayerObjs`/
 * `wallLayerObjs` (celles d'IsoStage) → `sortByDepth`. En `view:'top'` le mur se rend en trait
 * symbolique et le sol en tuile carrée ; LOD 0 = silhouette plate. La minimap sélectionne
 * DÉLIBÉRÉMENT la sous-couche STRUCTURELLE (sols + murs) — pas de toits/props/tokens/fx/highlights
 * (game-only). Un nouveau type d'élément (terrain/mur/structure) apparaît ici automatiquement (rendu
 * partagé) ; une nouvelle COUCHE structurelle à montrer sur le plan s'ajoute à `structuralObjs` (1 ligne).
 * Par-dessus : une couche de MARQUEURS de station + des pastilles de combattants optionnelles.
 */
import { buildFloors } from './builders/floors';
import { buildWalls } from './builders/walls';
import { floorLayerObjs, wallLayerObjs } from './stage/layers';
import { sortByDepth } from './stage/objs';
import { stageSize, tileCenter, type Dims } from './iso';
import { IconG } from '../ui/Icon';
import { MARKER_R, stationMarker, colocationOffsets } from './topoMarkers';
import { relationColor } from './teamColors';
import type { BattleState } from '../state/store';
import type { Scene } from '../state/scene';
import type { Station } from '../state/stations';
import type { Combatant } from '../engine/types';

/** LOD 0 (fills plats, aucun motif) — une minimap veut la silhouette symbolique, pas le détail. */
const LOD0 = { zoom: 0.4 };
/** Contexte de couche NEUTRE : bataille vide → aucun acteur → pas de reveal ; pas d'occlusion (mur plein).
 *  La minimap est un index plat : les vérités de VUE (reveal d'étage, estompe d'occlusion) n'y jouent pas. */
const NEUTRAL_CTX = { mode: 'battle', battle: { combatants: [] } as unknown as BattleState, partyPos: { x: 0, y: 0 } };
const NO_OCCLUDE = () => false;
/** Rayon écran (px) d'une pastille de combattant. */
const DOT_R = 7;
/** Anneau de sélection (px au-delà du disque). */
const RING_GAP = 4;

export interface TopoSceneProps {
  scene: Scene;
  stations: Station[];
  /** Pastilles de repérage (localiser un héros / un servant) — optionnel. */
  combatants?: Combatant[];
  selectedStationId?: string;
  /** Ensemble VISIBLE « x,y,z » (brouillard) ; transmis tel quel comme `visible` aux builders. */
  fog?: ReadonlySet<string>;
  viewport?: { w: number; h: number };
  onSelectStation?: (s: Station) => void;
  onSelectEntity?: (combatantId: string) => void;
}

/** Couche STRUCTURELLE (sols + murs) via les MÊMES fonctions de couche que le stage de jeu
 *  (`floorLayerObjs`/`wallLayerObjs` + `sortByDepth`) : aucune ré-implémentation d'assemblage. Un `fog`
 *  fourni restreint les tuiles construites (RAW : plan de ce qui est vu). Émet les nœuds pré-triés. */
function structuralObjs(scene: Scene, dims: Dims, fog?: ReadonlySet<string>) {
  return sortByDepth(
    floorLayerObjs(buildFloors(scene, fog), scene, dims, NEUTRAL_CTX, 0, LOD0),
    wallLayerObjs(buildWalls(scene, fog), dims, NO_OCCLUDE, 0, LOD0),
  );
}

export function TopoScene({ scene, stations, combatants, selectedStationId, fog, viewport, onSelectStation, onSelectEntity }: TopoSceneProps) {
  const dims: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, view: 'top' };
  const { w, h } = stageSize(dims);
  return (
    <svg
      className="topo-scene"
      viewBox={`0 0 ${w} ${h}`}
      width={viewport?.w ?? '100%'}
      height={viewport?.h}
      preserveAspectRatio="xMidYMid meet"
      // Sans viewport imposé : REMPLIT son conteneur (100 %×100 %) et se letterbox via `meet` → tout le
      // plan tient dans la boîte bornée du consommateur, sans scroll ni effondrement à 0. Le conteneur
      // porte la hauteur définie (cf. `.topo-panel`).
      style={viewport ? { display: 'block' } : { width: '100%', height: '100%', display: 'block' }}
    >
      <g>{structuralObjs(scene, dims, fog).map((o) => o.el)}</g>
      {(() => {
        const offsets = colocationOffsets(stations, dims);
        return stations.map((s) => {
        const m = stationMarker(s, dims, selectedStationId, offsets.get(s.id));
        return (
          <g
            key={s.id}
            className="topo-station"
            role={onSelectStation ? 'button' : undefined}
            onClick={onSelectStation ? () => onSelectStation(s) : undefined}
            style={onSelectStation ? { cursor: 'pointer' } : undefined}
          >
            {m.wedge && <path d={m.wedge} fill={m.tint} opacity={0.45} />}
            {m.ring && <circle cx={m.cx} cy={m.cy} r={MARKER_R + RING_GAP} fill="none" stroke="var(--gold)" strokeWidth={2.5} />}
            <circle cx={m.cx} cy={m.cy} r={MARKER_R} fill={m.tint} stroke="#0009" strokeWidth={1.5} opacity={s.manned ? 1 : 0.55} />
            <g color="#0d0d0d">
              <IconG id={s.icon} x={m.cx - MARKER_R * 0.65} y={m.cy - MARKER_R * 0.65} size={MARKER_R * 1.3} />
            </g>
            {m.badge != null && (
              <>
                <circle cx={m.cx + MARKER_R * 0.8} cy={m.cy - MARKER_R * 0.8} r={7} fill="#111" stroke={m.tint} strokeWidth={1.5} />
                <text x={m.cx + MARKER_R * 0.8} y={m.cy - MARKER_R * 0.8} fill="#fff" fontSize={9} textAnchor="middle" dominantBaseline="central">
                  {m.badge}
                </text>
              </>
            )}
          </g>
        );
        });
      })()}
      {combatants?.map((c) => {
        if (!c.pos) return null;
        const { cx, cy } = tileCenter(c.pos.x, c.pos.y, dims, c.pos.z ?? 0);
        return (
          <circle
            key={c.id}
            className="topo-entity"
            cx={cx}
            cy={cy}
            r={DOT_R}
            fill={relationColor(c.kind)}
            stroke="#000"
            strokeWidth={1.5}
            role={onSelectEntity ? 'button' : undefined}
            onClick={onSelectEntity ? () => onSelectEntity(c.id) : undefined}
            style={onSelectEntity ? { cursor: 'pointer' } : undefined}
          />
        );
      })}
    </svg>
  );
}
