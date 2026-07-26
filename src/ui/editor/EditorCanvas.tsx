/**
 * Canvas SVG iso de l'éditeur v2 : rendu WYSIWYG (sol, toits, entités, spawns) + calques
 * d'auteur (triggers, zones de repos, points d'entrée) + interactions pointeur — peindre, poser,
 * drag-rectangle, sélection/déplacement et REDIMENSIONNEMENT par poignée (coin SE des zones).
 * Les overlays sont en `pointer-events: none` : tout le picking passe par `hitAt` (les calques
 * masqués laissent cliquer à travers). La logique de mutation vit dans `editorState` (pur).
 */
import { useMemo, useRef, useState } from 'react';
import { Scene, sceneMetresPerTile, heightAt, isDescriptiveZone } from '../../state/scene';
import { Dims, diamondPath, tileCenter, screenToTileAtZ, screenToTileF, stageSize, depth, TH } from '../../geometry/iso';
import { buildProps } from '../../gameIso/builders/props';
import { propLayerObjs, type TokenCtx } from '../../gameIso/stage/tokens';
import { metricToLift } from '../../state/relief';
import { EntityToken } from '../../gameIso/EntityToken';
import { footprintTiles, sizeFootprint } from '../../state/footprint';
import { entitySize } from '../../state/spawn';
import { buildFloors } from '../../gameIso/builders/floors';
import { floorSvg, floorAccentsSvg } from '../../gameIso/backends/affineFloors';
import { buildWalls } from '../../gameIso/builders/walls';
import { wallDepth, wallSvg, wallAccentsSvg } from '../../gameIso/backends/affineWalls';
import { buildRoofs } from '../../gameIso/builders/roofs';
import { roofDepth, roofSvg } from '../../gameIso/backends/affineRoofs';
import { detailPatternDefs, lodOf, LOD_ZOOM } from '../../gameIso/backends/affineDetail';
import { editorLowerLayerFilterCss } from '../../gameIso/catalog/ambiance';
import { ViewControls } from '../ViewControls';
import { IconG } from '../Icon';
import { transformToSvg, nearestNode, type CalibStep, type TraceTransform } from '../../state/traceCalibration';
import type { useEditorView } from './useEditorView';
import {
  Tool, Layers, Sel, Rect, Pt, Edge4, rectFrom, hitAt, selRect, moveSel, resizeSel, paintTiles, fillTerrainRect,
  placeEntity, placeEmplacement, placeEntry, addTrigger, addRestZone, addEffectZone, effectZoneRect, addEnemyMember, eraseAt, entityAt, sameSel,
  toggleEdgeWall, toggleDiagonalWall, paintHeight, paintCrenellated, nearestEdge, canonEdge, pickWallEdge, pickArchitectureEdge, addFacadeSection,
} from './editorState';

/** Jaune d'ACCENT de SÉLECTION de l'éditeur (arêtes/zones/toits/entités sélectionnés) — même teinte que
 *  l'anneau d'unité active en combat, mais concept distinct (édition, pas tour de jeu). */
const SELECT = '#ffe066';
/** Filtre CSS de la couche INFÉRIEURE (pelure d'oignon) — voile ÉDITEUR distinct de celui du jeu
 *  (`editorLowerLayerFilterCss`, catalog/ambiance.ts) : la couche active reste seule éditable en
 *  pleine opacité, celle du dessous sert de gabarit d'alignement dont l'opacité RÉELLE est un
 *  réglage utilisateur (`lowerLayerOpacity` prop) — jamais une constante. */

export function EditorCanvas({
  scene,
  view,
  setScene,
  setSceneNoHistory,
  pushSnapshot,
  tool,
  brush,
  terrainRect,
  encTarget,
  setEncTarget,
  encRef,
  layers,
  sel,
  onSelect,
  onHover,
  currentLayer,
  architectureMode,
  architectureBodyId,
  architectureZ,
  architectureAction,
  onArchitectureActionComplete,
  traceLayer,
  lowerLayerOpacity,
  traceCalibStep,
  onTraceCalibClick,
}: {
  scene: Scene;
  view: ReturnType<typeof useEditorView>;
  setScene: (s: Scene) => void;
  setSceneNoHistory: (s: Scene) => void;
  pushSnapshot: () => void;
  tool: Tool;
  brush: number;
  terrainRect: boolean;
  encTarget: string;
  setEncTarget: (id: string) => void;
  /** Créature à placer (outil de placement d'ennemis) — déjà résolue (défaut bestiaire inclus). */
  encRef: string;
  layers: Layers;
  sel: Sel;
  onSelect: (s: Sel) => void;
  onHover: (p: Pt) => void;
  /** Couche en cours d'édition (z) : les outils de terrain peignent CETTE couche, et le picking la vise. */
  currentLayer: number;
  architectureMode: boolean;
  architectureBodyId: string | null;
  architectureZ: number | null;
  architectureAction: 'select' | 'facade';
  onArchitectureActionComplete: () => void;
  /** Calque de référence (planche décalquée) — `position` bascule SOUS/AU-DESSUS de la scène (jamais
   *  dans la Scène/un export) ; `pointerEvents: none` TOUJOURS (le calage capte le clic en amont). */
  traceLayer: {
    imageDataUrl: string;
    naturalWidth: number;
    naturalHeight: number;
    opacity: number;
    visible: boolean;
    position: 'above' | 'below';
    transform: TraceTransform;
  } | null;
  /** Opacité RÉELLE (0..1, réglage utilisateur) du gabarit de couche inférieure. */
  lowerLayerOpacity: number;
  /** Étape de calage 2 points en cours (`'idle'` = aucune) : capte le clic AVANT tout outil d'édition. */
  traceCalibStep: CalibStep;
  onTraceCalibClick: (pt: { x: number; y: number }) => void;
}) {
  const { rot, setRot, viewMode, setViewMode, view: vb, setView, zoomAt, spaceRef, panRef, canvasRef, stageRef } = view;
  const dims: Dims = { ...scene.dimensions, rot, view: viewMode };
  // MÊME `liftAt` que le jeu (IsoStage) — un décor levé (ornement de toit) lit le relief IDENTIQUEMENT.
  const liftAt = (x: number, y: number, z = 0) => metricToLift(heightAt(scene, Math.round(x), Math.round(y), z));
  const stage = stageSize(dims);
  stageRef.current = stage; // le zoom centré (molette/boutons) lit la taille à jour
  const LOWER_LAYER_FILTER = useMemo(() => editorLowerLayerFilterCss(lowerLayerOpacity), [lowerLayerOpacity]);

  // MATÉRIAUX v2 : palier de LOD dérivé du zoom de l'éditeur (WYSIWYG avec le jeu) — les memos
  // dépendent du PALIER (pas du zoom continu), l'expansion des ACCENTS reste un thunk paresseux
  // exécuté au rendu (sols : après le culling `inView`) puis mis en cache.
  const lod = lodOf(vb.zoom);
  const mpt = sceneMetresPerTile(scene);
  const detailOpts = useMemo(() => ({ zoom: LOD_ZOOM[lod], mpt }), [lod, mpt]);
  // `dims` dérive de (scene.dimensions, rot, viewMode) — deps couvertes.
  const patternDefs = useMemo(() => (lod >= 1 ? detailPatternDefs(dims, mpt) : ''), [scene, lod, rot, viewMode, mpt]);

  // SOLS par le pipeline pivot : bâtis 1× par SCÈNE (builder camera-free), dessinés 1× par CAMÉRA
  // (backend affine) — un déplacement de pointeur (re-rendus fréquents de l'éditeur) ne rebâtit plus
  // aucune chaîne SVG. COUCHE ACTIVE (`currentLayer`) = seule couche pleinement peinte ; le DESSOUS
  // (z < currentLayer) est émis en gabarit d'alignement (voile `LOWER_LAYER_FILTER` posé au rendu) et
  // le DESSUS masqué (`buildFloors` n'émet, au-delà de `activeZ`, que les surplombs fantômes — écartés
  // ICI : l'éditeur ne montre PAS un tablier flottant qu'on ne peut pas éditer).
  const floorEls = useMemo(
    () => buildFloors(scene, undefined, { activeZ: currentLayer }).filter((el) => el.cell.z <= currentLayer),
    [scene, currentLayer],
  );
  const floorRows = useMemo(
    () =>
      floorEls.map((el) => {
        const { cx, cy } = tileCenter(el.cell.x, el.cell.y, dims);
        let accCache: string | null = null;
        const acc = lod === 2 ? () => (accCache ??= floorAccentsSvg(el, dims, detailOpts)) : undefined;
        return { key: el.key, cx, cy, z: el.cell.z, html: floorSvg(el, dims, detailOpts), acc };
      }),
    // `dims` dérive de (scene.dimensions, rot, viewMode) : dimensions couvertes par floorEls (⊂ scene).
    [floorEls, rot, viewMode, lod, detailOpts],
  );
  // MURS par le pipeline pivot, memoïsés eux aussi (le IIFE de rendu les ré-insère dans le tri global) :
  // un déplacement de pointeur ne rebâtit plus les chaînes SVG des cloisons. MÊME cadrage de couche que
  // les sols (`activeZ`) — `buildWalls` n'émet alors QUE z ≤ currentLayer (pas de ghost à filtrer ici).
  const wallRows = useMemo(
    () =>
      buildWalls(scene, undefined, { activeZ: currentLayer }).map((el) => {
        let accCache: string | null = null;
        const acc = lod === 2 ? () => (accCache ??= wallAccentsSvg(el, dims, detailOpts)) : undefined;
        return { key: el.key, d: wallDepth(el, dims), z: el.cell.z, html: wallSvg(el, dims, detailOpts), acc };
      }),
    // `dims` dérive de (scene.dimensions, rot, viewMode) — deps couvertes.
    [scene, currentLayer, rot, viewMode, lod, detailOpts],
  );
  // CULLING au viewport : ne rend que les tuiles dont le centre écran tombe dans le viewBox courant
  // (+ marge pour les parois de relief hautes/basses) — fini de rastériser TOUTE la carte à chaque frame.
  const CULL_M = 220;
  const cullW = stage.w / vb.zoom, cullH = stage.h / vb.zoom;
  const inView = (r: { cx: number; cy: number }) =>
    r.cx >= vb.x - CULL_M && r.cx <= vb.x + cullW + CULL_M && r.cy >= vb.y - CULL_M && r.cy <= vb.y + cullH + CULL_M;

  const dragStartRef = useRef<Pt | null>(null);
  const [dragRect, setDragRect] = useState<Rect | null>(null);
  const [painting, setPainting] = useState(false);
  const [hoverEdge, setHoverEdge] = useState<{ x: number; y: number; side: 'N' | 'E' } | null>(null); // aperçu de l'arête sous le curseur (outil murs)
  const [calibNode, setCalibNode] = useState<{ x: number; y: number } | null>(null); // nœud de grille accroché pendant le calage 2 points (étapes tile1/tile2)
  const moveRef = useRef<{ from: Pt; moved: boolean } | null>(null);
  const resizeRef = useRef<{ moved: boolean } | null>(null);

  /** Coordonnées écran locales (viewBox) d'un événement pointeur. */
  function localXY(ev: React.PointerEvent): { x: number; y: number } {
    const svg = canvasRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: loc.x, y: loc.y };
  }

  /** Point écran → tuile (projection iso, comme le jeu). */
  function isoTile(ev: React.PointerEvent): Pt {
    const { x, y } = localXY(ev);
    return screenToTileAtZ(x, y, dims, currentLayer); // picking vers la couche en cours d'édition
  }

  /** Point écran → case + ARÊTE la plus proche (outil murs) : offset fractionnaire au centre → nearestEdge. */
  function wallHit(ev: React.PointerEvent): { p: Pt; side: Edge4 } {
    const { x, y } = localXY(ev);
    const f = screenToTileF(x, y, dims, currentLayer);
    const px = Math.round(f.x), py = Math.round(f.y);
    return { p: { x: px, y: py }, side: nearestEdge(f.x - px, f.y - py) };
  }

  function pointerDown(e: React.PointerEvent) {
    // Calage 2 points du calque de référence : capte le clic AVANT tout outil d'édition (paint,
    // sélection…) — le calage n'est jamais une opération de scène.
    if (traceCalibStep !== 'idle') {
      onTraceCalibClick(localXY(e));
      setCalibNode(null); // évite un repère fantôme le temps d'un prochain pointerMove
      return;
    }
    // Pan : clic du milieu OU Espace maintenu → on déplace le viewBox (pas d'édition).
    if (e.button === 1 || spaceRef.current) {
      e.preventDefault();
      panRef.current = { sx: e.clientX, sy: e.clientY, vx: vb.x, vy: vb.y };
      canvasRef.current?.setPointerCapture?.(e.pointerId);
      return;
    }
    const p = isoTile(e);
    const { w, h } = scene.dimensions;
    if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return;
    switch (tool.mode) {
      case 'select': {
        if (architectureMode) {
          const { x: lx, y: ly } = localXY(e);
          const z = architectureZ ?? currentLayer;
          const f = screenToTileF(lx, ly, dims, z);
          const facade = pickArchitectureEdge(scene, f.x, f.y, z);
          if (facade) {
            onSelect(facade);
            onArchitectureActionComplete();
            return;
          }
          if (architectureAction === 'facade' && architectureBodyId) {
            const px = Math.round(f.x), py = Math.round(f.y);
            const edge = canonEdge(px, py, nearestEdge(f.x - px, f.y - py));
            const out = addFacadeSection(
              scene,
              architectureBodyId,
              { ...edge, ...(z ? { z } : {}) },
              'mur-a-ossature-en-bois',
            );
            if (out) {
              setScene(out.scene);
              onSelect({ type: 'facadeSection', bodyId: architectureBodyId, id: out.id });
            }
            onArchitectureActionComplete();
            return;
          }
          const hit = hitAt(scene, p, layers, currentLayer, architectureBodyId ?? undefined);
          onSelect(hit);
          if (hit) moveRef.current = { from: p, moved: false };
          return;
        }
        // Une arête-mur proche du curseur prime sur la tuile (sélection de cloison/porte → fold structure).
        const { x: lx, y: ly } = localXY(e);
        const f = screenToTileF(lx, ly, dims, currentLayer);
        const we = pickWallEdge(scene, f.x, f.y, currentLayer);
        if (we) { onSelect({ type: 'wall', x: we.x, y: we.y, side: we.side, z: currentLayer }); return; }
        const hit = hitAt(scene, p, layers, currentLayer);
        onSelect(hit);
        if (hit) moveRef.current = { from: p, moved: false };
        return;
      }
      case 'tile':
        if (terrainRect) {
          dragStartRef.current = p;
          setDragRect({ x: p.x, y: p.y, w: 1, h: 1 });
        } else {
          pushSnapshot(); // 1 cran d'undo pour tout le trait
          setPainting(true);
          setSceneNoHistory(paintTiles(scene, p, tool.terrain, brush, currentLayer));
        }
        return;
      case 'entity': {
        const existing = entityAt(scene, p, currentLayer);
        if (existing) return onSelect({ type: 'entity', id: existing.id });
        const out = placeEntity(scene, tool.kind, tool.ref, p, currentLayer);
        setScene(out.scene);
        onSelect({ type: 'entity', id: out.id });
        return;
      }
      case 'zone':
        dragStartRef.current = p;
        setDragRect({ x: p.x, y: p.y, w: 1, h: 1 });
        return;
      case 'entry': {
        const out = placeEntry(scene, p, currentLayer);
        setScene(out.scene);
        onSelect({ type: 'entry', id: out.id });
        return;
      }
      case 'emplacement': {
        const existing = entityAt(scene, p, currentLayer);
        if (existing) return onSelect({ type: 'entity', id: existing.id });
        const out = placeEmplacement(scene, tool.trappingId, p, currentLayer);
        if (out) {
          setScene(out.scene);
          onSelect({ type: 'entity', id: out.id }); // édition immédiate (engin / arc / équipage) dans l'inspecteur
        }
        return;
      }
      case 'encounter': {
        const out = addEnemyMember(scene, encTarget, encRef, p, currentLayer);
        setScene(out.scene);
        if (out.encId !== encTarget) setEncTarget(out.encId);
        onSelect({ type: 'entity', id: out.entityId }); // sélectionne l'ennemi posé (édition immédiate)
        return;
      }
      case 'wall': {
        const wh = wallHit(e);
        if (wh.p.x < 0 || wh.p.y < 0 || wh.p.x >= w || wh.p.y >= h) return;
        if (tool.paint === 'diagBack') setScene(toggleDiagonalWall(scene, wh.p.x, wh.p.y, '\\', currentLayer));
        else if (tool.paint === 'diagFwd') setScene(toggleDiagonalWall(scene, wh.p.x, wh.p.y, '/', currentLayer));
        else setScene(toggleEdgeWall(scene, wh.p.x, wh.p.y, wh.side, currentLayer, tool.paint === 'door' ? 'door' : 'wall', tool.structure));
        return;
      }
      case 'height':
        pushSnapshot(); // 1 cran d'undo pour tout le trait
        setPainting(true);
        setSceneNoHistory(paintHeight(scene, p, tool.metres, brush, currentLayer));
        return;
      case 'crenellated':
        pushSnapshot(); // 1 cran d'undo pour tout le trait
        setPainting(true);
        setSceneNoHistory(paintCrenellated(scene, p, tool.structure, brush, currentLayer));
        return;
      case 'erase':
        setPainting(true);
        setScene(eraseAt(scene, p, currentLayer));
        return;
    }
  }

  function pointerMove(e: React.PointerEvent) {
    // Repère visuel du NŒUD accroché pendant le calage 2 points (étapes de clic « grille », pas
    // « image ») — l'utilisateur voit ce qu'il vise avant de cliquer (retour user 2026-07-25).
    if (traceCalibStep === 'tile1' || traceCalibStep === 'tile2') {
      const { x, y } = localXY(e);
      setCalibNode(nearestNode(screenToTileF(x, y, dims, currentLayer)));
    } else if (calibNode) {
      setCalibNode(null);
    }
    // `pan` capturé en variable LOCALE avant tout `set*` : `panRef.current` est remis à `null` par
    // `pointerUp` de façon IMPÉRATIVE (pas via `setState`), et l'updater passé à `setView` peut
    // s'exécuter APRÈS ce remise à `null` (React 18 diffère le flush du `setState` en file — un
    // `pointerUp` natif tiré juste après le `pointerMove` s'exécute AVANT que React ait rejoué cet
    // updater). Le déréférencer DANS le callback (`panRef.current!.vx`) plantait alors sur
    // `null` — capturer ICI, jamais dans le callback différé (même classe de bug que MapCanvas.tsx).
    const pan = panRef.current;
    if (pan) {
      const r = canvasRef.current!.getBoundingClientRect();
      const vw = stage.w / vb.zoom,
        vh = stage.h / vb.zoom;
      const dx = (e.clientX - pan.sx) * (vw / r.width);
      const dy = (e.clientY - pan.sy) * (vh / r.height);
      setView((v) => ({ ...v, x: pan.vx - dx, y: pan.vy - dy }));
      return;
    }
    const p = isoTile(e);
    onHover(p);
    // Aperçu de l'arête ciblée (outil murs, sous-modes cloison/porte).
    if (tool.mode === 'wall' && (tool.paint === 'wall' || tool.paint === 'door')) {
      const wh = wallHit(e);
      setHoverEdge(canonEdge(wh.p.x, wh.p.y, wh.side));
    } else if (hoverEdge) setHoverEdge(null);
    if (resizeRef.current) {
      if (!resizeRef.current.moved) {
        pushSnapshot(); // 1 cran d'undo pour tout le geste de resize
        resizeRef.current.moved = true;
      }
      setSceneNoHistory(resizeSel(scene, sel, p));
      return;
    }
    if (moveRef.current) {
      const m = moveRef.current;
      if (!m.moved && p.x === m.from.x && p.y === m.from.y) return; // clic simple = sélection, pas de déplacement
      if (!m.moved) {
        pushSnapshot(); // 1 cran d'undo au 1er déplacement réel
        m.moved = true;
      }
      setSceneNoHistory(moveSel(scene, sel, p));
      return;
    }
    if ((tool.mode === 'zone' || (tool.mode === 'tile' && terrainRect)) && dragStartRef.current)
      setDragRect(rectFrom(dragStartRef.current, p));
    else if (painting && tool.mode === 'tile') setSceneNoHistory(paintTiles(scene, p, tool.terrain, brush, currentLayer));
    else if (painting && tool.mode === 'height') setSceneNoHistory(paintHeight(scene, p, tool.metres, brush, currentLayer));
    else if (painting && tool.mode === 'crenellated') setSceneNoHistory(paintCrenellated(scene, p, tool.structure, brush, currentLayer));
    else if (painting && tool.mode === 'erase') setScene(eraseAt(scene, p, currentLayer));
  }

  function pointerUp(e: React.PointerEvent) {
    if (panRef.current) {
      panRef.current = null;
      return;
    }
    if (dragStartRef.current) {
      const rect = rectFrom(dragStartRef.current, isoTile(e));
      if (tool.mode === 'zone' && tool.zone === 'trigger') {
        const out = addTrigger(scene, rect, currentLayer);
        setScene(out.scene);
        onSelect({ type: 'trigger', id: out.id }); // Editor ouvre le dock Logique dessus
      } else if (tool.mode === 'zone' && tool.zone === 'rest') {
        const out = addRestZone(scene, rect, currentLayer);
        setScene(out.scene);
        onSelect({ type: 'restZone', idx: out.idx });
      } else if (tool.mode === 'zone' && tool.zone === 'effect') {
        const out = addEffectZone(scene, rect, currentLayer);
        setScene(out.scene);
        onSelect({ type: 'effectZone', idx: out.idx });
      } else if (tool.mode === 'tile' && terrainRect) {
        setScene(fillTerrainRect(scene, rect, tool.terrain, currentLayer));
      }
    }
    dragStartRef.current = null;
    setDragRect(null);
    setPainting(false);
    moveRef.current = null;
    resizeRef.current = null;
  }

  // Surlignage de la sélection : empreinte (entité), empreinte du toit, rect (zones).
  const selEnt = sel?.type === 'entity' ? scene.entities.find((en) => en.id === sel.id) ?? null : null;
  const zoneRect = sel?.type === 'trigger' || sel?.type === 'restZone' || sel?.type === 'effectZone' ? selRect(scene, sel) : null;
  // Arête-mur sélectionnée (N/E uniquement) sur la couche courante → segment doré (même tracé que hoverEdge).
  const selWall = sel?.type === 'wall' && sel.z === currentLayer && (sel.side === 'N' || sel.side === 'E') ? sel : null;
  // Groupe SVG du calque (image seule) — calculé UNE fois, posé SOUS (avant le sol) ou AU-DESSUS
  // (dernier enfant du SVG) selon `traceLayer.position` ; jamais les deux à la fois.
  const traceLayerImg = traceLayer?.visible ? (
    <g opacity={traceLayer.opacity} pointerEvents="none" transform={transformToSvg(traceLayer.transform)}>
      <image href={traceLayer.imageDataUrl} width={traceLayer.naturalWidth} height={traceLayer.naturalHeight} />
    </g>
  ) : null;

  return (
    <main className="editor-canvas-wrap">
      <div className="editor-iso-wrap">
        <svg
          ref={canvasRef}
          className="editor-iso"
          viewBox={`${vb.x} ${vb.y} ${stage.w / vb.zoom} ${stage.h / vb.zoom}`}
          width={stage.w}
          height={stage.h}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerLeave={() => {
            panRef.current = null;
            dragStartRef.current = null;
            setDragRect(null);
            setPainting(false);
            setHoverEdge(null);
            moveRef.current = null;
            resizeRef.current = null;
          }}
        >
          <defs dangerouslySetInnerHTML={{ __html: patternDefs }} />
          {/* Calque de RÉFÉRENCE (décalquage, #830) : `position` bascule SOUS (dessiner sur du vide,
              carte neuve) / AU-DESSUS (décalquer/comparer, défaut — le terrain est OPAQUE, « en
              dessous » y est invisible partout où il y a du sol) — jamais dans la Scène/l'export.
              `pointerEvents="none"` TOUJOURS : le calage capte le clic EN AMONT (`pointerDown`), la
              sélection/les outils doivent traverser le calque quand il est au-dessus. */}
          {traceLayer?.visible && traceLayer.position === 'below' && traceLayerImg}
          <g>
            {floorRows.filter(inView).map((r) =>
              r.acc ? (
                // Accents matériaux v2 (LOD 2) : étendus APRÈS le culling `inView`, puis servis du cache.
                <g key={r.key} style={r.z < currentLayer ? { filter: LOWER_LAYER_FILTER } : undefined}>
                  <g dangerouslySetInnerHTML={{ __html: r.html }} />
                  <g dangerouslySetInnerHTML={{ __html: r.acc() }} />
                </g>
              ) : (
                <g
                  key={r.key}
                  style={r.z < currentLayer ? { filter: LOWER_LAYER_FILTER } : undefined}
                  dangerouslySetInnerHTML={{ __html: r.html }}
                />
              ),
            )}
          </g>
          <g pointerEvents="none">
            {(() => {
              const objs: { d: number; el: JSX.Element }[] = [];
              // Décor (props de scène `kind:'prop'`, overlays de terrain bois→arbre, ornements de toit,
              // features de façade) — rendu par le MÊME pipeline que le jeu (`buildProps` → `propLayerObjs`,
              // cf. IsoStage) : jamais par `pickBackend`/`resolveRender` (registre créature/véhicule), qui
              // collisionne sur un id de décor homonyme d'un véhicule/créature (ex. `chaise` meuble vs
              // chaise à porteurs de `vehicles.json`). Un décor s'authore comme un décor.
              const propTokenCtx: TokenCtx = { dims, view: viewMode, liftAt };
              const propEls = buildProps(scene, undefined, { activeZ: currentLayer });
              propLayerObjs(propEls, propTokenCtx).forEach((po, i) => {
                const el = propEls[i];
                const dimmed = el.cell.z < currentLayer;
                objs.push({
                  d: po.d,
                  el: dimmed ? <g key={el.key} style={{ filter: LOWER_LAYER_FILTER }}>{po.el}</g> : po.el,
                });
              });
              // Toits des bâtiments COMPOSÉS : le pipeline pivot (`buildRoofs` + backend affine) en mode
              // PLAN étiqueté — couverture semi-transparente teintée par le matériau + libellé, posée
              // dans le tri global. Les MURS sont rendus par `buildWalls` ci-dessous — un toit n'est que
              // la couverture, on voit/édite les murs au travers.
              if (layers.roofs)
                for (const el of buildRoofs(scene))
                  objs.push({
                    d: roofDepth(el, dims),
                    el: <g key={el.key} pointerEvents="none" dangerouslySetInnerHTML={{ __html: roofSvg(el, dims, { plan: true }) }} />,
                  });
              // Entités de COMBAT : celles enrôlées dans une rencontre (teinte rouge + empreinte).
              const memberIds = new Set(scene.encounters.flatMap((e) => (e.members ?? []).map((m) => m.entityId)));
              for (const en of scene.entities) {
                if (en.kind === 'prop') continue; // rendu par le pipeline décor unifié ci-dessus (buildProps → propLayerObjs)
                const ez = en.z ?? 0;
                if (ez > currentLayer) continue; // couche AU-DESSUS de l'active → masquée (#pelure d'oignon)
                const dimStyle = ez < currentLayer ? { filter: LOWER_LAYER_FILTER } : undefined;
                if (en.kind === 'heroStart') {
                  const { cx, cy } = tileCenter(en.pos.x, en.pos.y, dims, ez);
                  objs.push({
                    d: depth(en.pos.x, en.pos.y, dims, ez) + 0.4,
                    el: (
                      <g key={en.id} style={dimStyle}>
                        <path d={diamondPath(en.pos.x, en.pos.y, dims, ez)} fill="#2ecc71" opacity={0.55} />
                        <text x={cx} y={cy + TH / 4} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#0a2a14">
                          H
                        </text>
                      </g>
                    ),
                  });
                  continue;
                }
                const hidden = !!en.combat?.hiddenUntilCombat;
                if (hidden && !layers.spawns) continue; // calque « Ennemis » masqué → cacher les embusqueurs
                const isCombat = memberIds.has(en.id);
                const isSel = sameSel(sel, { type: 'entity', id: en.id });
                if (isCombat) {
                  objs.push({
                    d: depth(en.pos.x, en.pos.y, dims, ez) + 0.45,
                    el: (
                      <g key={en.id} style={dimStyle} opacity={hidden ? 0.6 : 1}>
                        {footprintTiles(en.pos, sizeFootprint(entitySize(en))).map((t) => (
                          <path
                            key={`fp-${t.x}-${t.y}`}
                            d={diamondPath(t.x, t.y, dims, ez)}
                            fill="rgba(192,57,43,0.32)"
                            stroke={isSel ? SELECT : '#c0392b'}
                            strokeWidth={isSel ? 2.5 : 1.5}
                            strokeDasharray={hidden ? '4 3' : undefined}
                          />
                        ))}
                        <EntityToken ent={en} dims={dims} enrolled />
                      </g>
                    ),
                  });
                } else {
                  objs.push({
                    d: depth(en.pos.x, en.pos.y, dims, ez) + 0.5,
                    el: dimStyle ? (
                      <g key={en.id} style={dimStyle}>
                        <EntityToken ent={en} dims={dims} />
                      </g>
                    ) : (
                      <EntityToken key={en.id} ent={en} dims={dims} />
                    ),
                  });
                }
              }
              // Cloisons (murs/portes/diagonales) — mêmes faces pivot que le jeu, memoïsées (wallRows) sur la
              // couche active + gabarit du dessous (`currentLayer`, cf. `buildWalls`) ; accents matériaux v2
              // (thunk en cache) par-dessus leur mur ; voile `LOWER_LAYER_FILTER` sous la couche active.
              wallRows.forEach((r) => {
                const dimStyle = r.z < currentLayer ? { filter: LOWER_LAYER_FILTER } : undefined;
                objs.push({
                  d: r.d,
                  el: r.acc ? (
                    <g key={r.key} style={dimStyle}>
                      <g dangerouslySetInnerHTML={{ __html: r.html }} />
                      <g dangerouslySetInnerHTML={{ __html: r.acc() }} />
                    </g>
                  ) : (
                    <g key={r.key} style={dimStyle} dangerouslySetInnerHTML={{ __html: r.html }} />
                  ),
                });
              });
              objs.sort((a, b) => a.d - b.d);
              return objs.map((o) => o.el);
            })()}
          </g>
          {hoverEdge && (() => {
            // Arête candidate sous le curseur (outil murs) : segment doré entre les deux coins de grille.
            const gc = (gx: number, gy: number) => tileCenter(gx - 0.5, gy - 0.5, dims, currentLayer);
            const [a, b] = hoverEdge.side === 'N' ? [gc(hoverEdge.x, hoverEdge.y), gc(hoverEdge.x + 1, hoverEdge.y)] : [gc(hoverEdge.x + 1, hoverEdge.y), gc(hoverEdge.x + 1, hoverEdge.y + 1)];
            return <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={SELECT} strokeWidth={4} strokeLinecap="round" opacity={0.9} pointerEvents="none" />;
          })()}
          {selWall && (() => {
            const gc = (gx: number, gy: number) => tileCenter(gx - 0.5, gy - 0.5, dims, currentLayer);
            const [a, b] = selWall.side === 'N' ? [gc(selWall.x, selWall.y), gc(selWall.x + 1, selWall.y)] : [gc(selWall.x + 1, selWall.y), gc(selWall.x + 1, selWall.y + 1)];
            return <line x1={a.cx} y1={a.cy} x2={b.cx} y2={b.cy} stroke={SELECT} strokeWidth={5} strokeLinecap="round" pointerEvents="none" />;
          })()}
          {layers.triggers && (
            <g pointerEvents="none">
              {scene.triggers.map((t) => {
                const tz = t.rect.z ?? 0;
                if (tz > currentLayer) return null; // couche AU-DESSUS de l'active → masquée (#835 FU-1)
                const dim = tz < currentLayer;
                const isSel = sel?.type === 'trigger' && sel.id === t.id;
                return (
                  <g key={`tr-${t.id}`} style={dim ? { filter: LOWER_LAYER_FILTER } : undefined}>
                    {Array.from({ length: Math.max(0, t.rect.w * t.rect.h) }, (_, i) => {
                      const x = t.rect.x + (i % t.rect.w);
                      const y = t.rect.y + Math.floor(i / t.rect.w);
                      return (
                        <path
                          key={i}
                          d={diamondPath(x, y, dims, tz)}
                          fill={isSel ? 'rgba(231,76,60,0.3)' : 'rgba(231,76,60,0.12)'}
                          stroke={isSel ? SELECT : 'rgba(231,76,60,0.9)'}
                          strokeWidth={isSel ? 2.5 : 1.5}
                          strokeDasharray="4 3"
                        />
                      );
                    })}
                  </g>
                );
              })}
            </g>
          )}
          {layers.rest && (
            <g pointerEvents="none">
              {(scene.restZones ?? []).map((z, zi) => {
                const rz = z.rect.z ?? 0;
                if (rz > currentLayer) return null;
                const dim = rz < currentLayer;
                const isSel = sel?.type === 'restZone' && sel.idx === zi;
                const { cx, cy } = tileCenter(z.rect.x, z.rect.y, dims, rz);
                return (
                  <g key={`rz-${zi}`} style={dim ? { filter: LOWER_LAYER_FILTER } : undefined}>
                    {Array.from({ length: Math.max(0, z.rect.w * z.rect.h) }, (_, i) => {
                      const x = z.rect.x + (i % z.rect.w);
                      const y = z.rect.y + Math.floor(i / z.rect.w);
                      return (
                        <path
                          key={i}
                          d={diamondPath(x, y, dims, rz)}
                          fill={isSel ? 'rgba(46,204,113,0.3)' : 'rgba(46,204,113,0.12)'}
                          stroke={isSel ? SELECT : 'rgba(46,204,113,0.9)'}
                          strokeWidth={isSel ? 2.5 : 1.5}
                          strokeDasharray="4 3"
                        />
                      );
                    })}
                    <IconG id="rest/camp" x={cx - 6} y={cy - 6} size={12} />
                  </g>
                );
              })}
            </g>
          )}
          {/* Zones MÉCANIQUES seulement (piège/barrière : `onCross`/`perRound`/`barrier`/`blocksLoS`) — les
              zones DESCRIPTIVES (nom de pièce, `isDescriptiveZone`) rendent sous le calque `zones` ci-dessous,
              jamais ici : le même remplissage plein « piège » peint sur un nom de pièce a rendu la carte
              illisible (#826 — 1215 losanges orange mesurés sur La Diligence, plus que la carte entière). */}
          {layers.effects && (
            <g pointerEvents="none">
              {(scene.effectZones ?? []).map((z, zi) => {
                if (isDescriptiveZone(z)) return null;
                const ez = z.z ?? 0;
                if (ez > currentLayer) return null;
                const dim = ez < currentLayer;
                const isSel = sel?.type === 'effectZone' && sel.idx === zi;
                const r = effectZoneRect(z.area);
                const { cx, cy } = tileCenter(r.x, r.y, dims, ez);
                const bar = !!z.barrier; // barrière = trait plein (mur), piège = pointillés (hasard)
                return (
                  <g key={`ez-${z.id}`} style={dim ? { filter: LOWER_LAYER_FILTER } : undefined}>
                    {Array.from({ length: Math.max(0, r.w * r.h) }, (_, i) => {
                      const x = r.x + (i % r.w);
                      const y = r.y + Math.floor(i / r.w);
                      return (
                        <path
                          key={i}
                          d={diamondPath(x, y, dims, ez)}
                          fill={isSel ? (bar ? 'rgba(120,140,200,0.4)' : 'rgba(226,100,30,0.35)') : (bar ? 'rgba(120,140,200,0.18)' : 'rgba(226,100,30,0.15)')}
                          stroke={isSel ? SELECT : bar ? 'rgba(120,140,200,0.95)' : 'rgba(226,100,30,0.9)'}
                          strokeWidth={isSel ? 2.5 : bar ? 2 : 1.5}
                          strokeDasharray={bar ? undefined : '3 2'}
                        />
                      );
                    })}
                    {bar ? (
                      <IconG id="map-tool/wall" x={cx - 6} y={cy - 6} size={12} />
                    ) : (
                      <IconG id="ui/warning" x={cx - 6} y={cy - 6} size={12} />
                    )}
                  </g>
                );
              })}
            </g>
          )}
          {/* Zones DESCRIPTIVES (nom de pièce, `isDescriptiveZone`) : liseré discret + libellé — jamais le
              remplissage plein d'un piège (#826). Calque séparé (`zones`, désactivé par défaut) de celui des
              zones mécaniques (`effects`/« Pièges »). Pas de `roofHidden` (cutaway de jeu) : l'éditeur montre
              toujours ses zones authored, quel que soit un allié — cohérent avec le rendu `plan` des toits. */}
          {layers.zones && (
            <g pointerEvents="none">
              {(scene.effectZones ?? []).map((z, zi) => {
                if (!isDescriptiveZone(z)) return null;
                const ez = z.z ?? 0;
                if (ez > currentLayer) return null;
                const dim = ez < currentLayer;
                const isSel = sel?.type === 'effectZone' && sel.idx === zi;
                const r = effectZoneRect(z.area);
                const { cx, cy } = tileCenter(r.x + (r.w - 1) / 2, r.y + (r.h - 1) / 2, dims, ez);
                return (
                  <g key={`ez-${z.id}`} style={dim ? { filter: LOWER_LAYER_FILTER } : undefined}>
                    {Array.from({ length: Math.max(0, r.w * r.h) }, (_, i) => {
                      const x = r.x + (i % r.w);
                      const y = r.y + Math.floor(i / r.w);
                      return (
                        <path
                          key={i}
                          d={diamondPath(x, y, dims, ez)}
                          fill={isSel ? 'rgba(255,224,102,0.16)' : 'none'}
                          stroke={isSel ? SELECT : 'rgba(150,150,220,0.55)'}
                          strokeWidth={isSel ? 2 : 1}
                          strokeDasharray="2 3"
                        />
                      );
                    })}
                    <text x={cx} y={cy + TH / 4} textAnchor="middle" fontSize="11" fontWeight="bold" fill="#cfd6ff" stroke="#06222b" strokeWidth={0.4}>
                      {z.label}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
          {layers.entries && (
            <g pointerEvents="none">
              {Object.entries(scene.entryPoints ?? {}).map(([name, pos]) => {
                const pz = pos.z ?? 0;
                if (pz > currentLayer) return null; // couche AU-DESSUS de l'active → masquée (#835 FU-1)
                const dim = pz < currentLayer;
                const isSel = sel?.type === 'entry' && sel.id === name;
                const { cx, cy } = tileCenter(pos.x, pos.y, dims);
                return (
                  <g key={`en-${name}`} style={dim ? { filter: LOWER_LAYER_FILTER } : undefined}>
                    <path d={diamondPath(pos.x, pos.y, dims)} fill="rgba(78,195,224,0.5)" stroke={isSel ? SELECT : '#4ec3e0'} strokeWidth={isSel ? 2.5 : 1.5} />
                    {/* Icône du registre en contexte SVG (IconG, ancrée coin haut-gauche) — centrée sur la case, teinte sombre lisible sur le losange. */}
                    <g color="#06222b">
                      <IconG id="nav/entry-point" x={cx - 6.5} y={cy - 6.5} size={13} />
                    </g>
                    <text x={cx} y={cy - TH / 2} textAnchor="middle" fontSize="10" fill="#bfe9f5" stroke="#06222b" strokeWidth={0.4}>
                      {name}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
          {selEnt &&
            footprintTiles(selEnt.pos, sizeFootprint(entitySize(selEnt))).map((t) => (
              <path key={`fp-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims, selEnt.z ?? 0)} fill="none" stroke={SELECT} strokeWidth={3} pointerEvents="none" />
            ))}
          {zoneRect && (
            // Poignée de REDIMENSIONNEMENT (coin SE) — manque du POC comblé.
            <path
              d={diamondPath(zoneRect.x + zoneRect.w - 1, zoneRect.y + zoneRect.h - 1, dims)}
              fill="rgba(255,224,102,0.45)"
              stroke={SELECT}
              strokeWidth={2}
              cursor="nwse-resize"
              onPointerDown={(e) => {
                e.stopPropagation();
                resizeRef.current = { moved: false };
                canvasRef.current?.setPointerCapture?.(e.pointerId);
              }}
            />
          )}
          {dragRect && (
            <g pointerEvents="none">
              {Array.from({ length: dragRect.w * dragRect.h }, (_, i) => {
                const x = dragRect.x + (i % dragRect.w);
                const y = dragRect.y + Math.floor(i / dragRect.w);
                return <path key={`dr-${i}`} d={diamondPath(x, y, dims)} fill="rgba(78,195,224,0.35)" stroke="#4ec3e0" strokeWidth={1.5} />;
              })}
            </g>
          )}
          {traceLayer?.visible && traceLayer.position === 'above' && traceLayerImg}
          {calibNode && (() => {
            const { cx, cy } = tileCenter(calibNode.x, calibNode.y, dims, currentLayer);
            const s = 9;
            return (
              <g pointerEvents="none">
                <circle cx={cx} cy={cy} r={4} fill="none" stroke={SELECT} strokeWidth={2} />
                <line x1={cx - s} y1={cy} x2={cx + s} y2={cy} stroke={SELECT} strokeWidth={2} />
                <line x1={cx} y1={cy - s} x2={cx} y2={cy + s} stroke={SELECT} strokeWidth={2} />
              </g>
            );
          })()}
        </svg>
        <ViewControls
          zoom={vb.zoom}
          onZoomIn={() => zoomAt(1.2)}
          onZoomOut={() => zoomAt(1 / 1.2)}
          onZoomReset={() => setView({ zoom: 1, x: 0, y: 0 })}
          onRotateLeft={() => setRot((r) => (((r + 3) % 4) as 0 | 1 | 2 | 3))}
          onRotateRight={() => setRot((r) => (((r + 1) % 4) as 0 | 1 | 2 | 3))}
          view={viewMode}
          onToggleView={() => setViewMode((v) => (v === 'iso' ? 'top' : 'iso'))}
        />
      </div>
    </main>
  );
}
