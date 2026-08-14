/**
 * TopoScene — vue TOP-DOWN symbolique d'une scène (plan de niveau / minimap). N'est PAS un 2ᵉ moteur
 * d'affichage : le monde lui vient du MÊME pipeline que le stage de jeu, sur la voie de rendu en
 * vigueur (`state/stage3d.ts`, interrupteur de chantier #1176) —
 *  - voie AFFINE : builders camera-free (`buildFloors`/`buildWalls`) → couches `floorLayerObjs`/
 *    `wallLayerObjs` (celles d'IsoStage) → `sortByDepth`, en SVG ;
 *  - voie VOLUMIQUE : la MATIÈRE (les sols de l'étage) en instantané volumique posé SOUS le SVG
 *    (`stage/PlanWorldCanvas`), la STRUCTURE (les murs) restant au trait symbolique SVG — la coiffe
 *    d'un mur volumique tombe sous le pixel à l'échelle d'un plan (mesure au JSDoc de
 *    `stage/planSnapshot.ts`), là où le trait affine est invariant d'échelle.
 * En `view:'top'` le mur se rend en trait symbolique et le sol en tuile carrée ; LOD 0 = silhouette
 * plate. La minimap sélectionne DÉLIBÉRÉMENT la sous-couche STRUCTURELLE (sols + murs) — pas de
 * toits/props/tokens/fx/highlights (game-only). Un nouveau type d'élément (terrain/mur/structure)
 * apparaît ici automatiquement (rendu partagé) ; une nouvelle COUCHE structurelle à montrer sur le
 * plan s'ajoute à `structuralObjs` (1 ligne).
 * Par-dessus, dans les DEUX voies : une couche de MARQUEURS de station + des pastilles de combattants
 * optionnelles — affordances cliquables et symboles d'état restent en SVG.
 */
import { useState, useSyncExternalStore } from 'react';
import { buildFloors } from './builders/floors';
import { buildWalls } from './builders/walls';
import { floorLayerObjs, wallLayerObjs } from './stage/layers';
import { sortByDepth } from './stage/objs';
import { PlanWorldCanvas } from './stage/PlanWorldCanvas';
import { getStageBackend, subscribeStageBackend } from '../state/stage3d';
import { stageSize, tileCenter, type Dims } from '../geometry/iso';
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
  /** Étage à PLANIFIER (défaut : le rez). Le plan n'en montre qu'UN — cf. `structuralObjs`. */
  z?: number;
  viewport?: { w: number; h: number };
  onSelectStation?: (s: Station) => void;
  onSelectEntity?: (combatantId: string) => void;
}

/** Couche STRUCTURELLE SVG via les MÊMES fonctions de couche que le stage de jeu (`floorLayerObjs`/
 *  `wallLayerObjs` + `sortByDepth`) : aucune ré-implémentation d'assemblage. Émet les nœuds pré-triés.
 *  `sols` = les sols entrent dans le SVG (voie affine) ; sur la voie volumique ils viennent du canevas
 *  posé dessous, et seuls les murs restent ici.
 *  `z` = l'étage PLANIFIÉ, passé aux builders comme leur `viewZ` (isolement d'un étage) : un plan se lit
 *  à la VERTICALE, un seul plancher à la fois — sans lui, les murs de TOUS les étages se superposent. */
function structuralObjs(scene: Scene, dims: Dims, z: number, sols: boolean) {
  const view = { activeZ: z, viewZ: z };
  return sortByDepth(
    sols ? floorLayerObjs(buildFloors(scene, undefined, view), scene, dims, NEUTRAL_CTX, 0, LOD0) : [],
    wallLayerObjs(buildWalls(scene, undefined, view), dims, NO_OCCLUDE, 0, LOD0),
  );
}

export function TopoScene({ scene, stations, combatants, selectedStationId, z = 0, viewport, onSelectStation, onSelectEntity }: TopoSceneProps) {
  const stageBackend = useSyncExternalStore(subscribeStageBackend, getStageBackend, getStageBackend);
  const webgl = stageBackend === 'webgl';
  // MATIÈRE PEINTE par le canevas volumique ? Un contexte GL refusé (machine sans accélération, budget
  // de contextes épuisé) laisserait sinon des murs flottant sur un fond transparent : les sols
  // REVIENNENT alors au SVG. Vrai tant que rien n'a échoué — la voie affine ne pose jamais la question.
  const [matièreVolumique, setMatièreVolumique] = useState(true);
  const solsSvg = !webgl || !matièreVolumique;
  const dims: Dims = { w: scene.dimensions.w, h: scene.dimensions.h, view: 'top' };
  const { w, h } = stageSize(dims);
  return (
    // Le canevas de matière et le SVG partagent EXACTEMENT la même boîte (100 %×100 % de ce conteneur) :
    // c'est la condition du `meet` commun — deux boîtes différentes se letterboxeraient différemment, et
    // les marqueurs quitteraient leurs cases.
    <div
      style={viewport
        ? { position: 'relative', width: viewport.w, height: viewport.h }
        : { position: 'relative', width: '100%', height: '100%' }}
    >
    {webgl && <PlanWorldCanvas scene={scene} z={z} onMatière={setMatièreVolumique} />}
    <svg
      className="topo-scene"
      viewBox={`0 0 ${w} ${h}`}
      width={viewport?.w ?? '100%'}
      height={viewport?.h}
      preserveAspectRatio="xMidYMid meet"
      // Sans viewport imposé : REMPLIT son conteneur (100 %×100 %) et se letterbox via `meet` → tout le
      // plan tient dans la boîte bornée du consommateur, sans scroll ni effondrement à 0. Le conteneur
      // porte la hauteur définie (cf. `.topo-panel`).
      style={viewport
        ? { display: 'block', position: 'relative' }
        : { width: '100%', height: '100%', display: 'block', position: 'relative' }}
    >
      <g>{structuralObjs(scene, dims, z, solsSvg).map((o) => o.el)}</g>
      {(() => {
        // Les marqueurs suivent l'étage PLANIFIÉ comme la structure : pointer une station d'un autre
        // niveau sur ce plan la placerait dans des murs qui n'y sont pas.
        const here = stations.filter((s) => (s.pos.z ?? 0) === z);
        const offsets = colocationOffsets(here, dims);
        return here.map((s) => {
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
        if (!c.pos || (c.pos.z ?? 0) !== z) return null; // un plan d'étage ne pointe pas les corps d'un autre
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
    </div>
  );
}
