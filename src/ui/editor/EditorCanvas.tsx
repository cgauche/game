/**
 * Canvas SVG iso de l'éditeur v2 : rendu WYSIWYG (sol, toits, entités, spawns) + calques
 * d'auteur (triggers, zones de repos, points d'entrée) + interactions pointeur — peindre, poser,
 * drag-rectangle, sélection/déplacement et REDIMENSIONNEMENT par poignée (coin SE des zones).
 * Les overlays sont en `pointer-events: none` : tout le picking passe par `hitAt` (les calques
 * masqués laissent cliquer à travers). La logique de mutation vit dans `editorState` (pur).
 */
import { useMemo, useRef, useState } from 'react';
import { Scene, sceneMetresPerTile, Roof, type SceneEntity } from '../../state/scene';
import { Dims, diamondPath, tileCenter, screenToTileAtZ, screenToTileF, stageSize, depth, TH } from '../../gameIso/iso';
import { buildProps } from '../../gameIso/builders/props';
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
import { ViewControls } from '../ViewControls';
import { IconG } from '../Icon';
import type { useEditorView } from './useEditorView';
import {
  Tool, Layers, Sel, Rect, Pt, Edge4, rectFrom, hitAt, selRect, moveSel, resizeSel, paintTiles, fillTerrainRect,
  placeEntity, placeEmplacement, placeEntry, addTrigger, addRestZone, addEffectZone, effectZoneRect, addRoof, addEnemyMember, eraseAt, sameSel,
  toggleEdgeWall, toggleDiagonalWall, paintHeight, nearestEdge, canonEdge, pickWallEdge,
} from './editorState';

/** Jaune d'ACCENT de SÉLECTION de l'éditeur (arêtes/zones/toits/entités sélectionnés) — même teinte que
 *  l'anneau d'unité active en combat, mais concept distinct (édition, pas tour de jeu). */
const SELECT = '#ffe066';

/** Cases de l'empreinte d'un toit (footprint plat) — base du surlignage de sélection. */
const footCells = (foot: Roof['foot']): Pt[] => {
  const out: Pt[] = [];
  for (let y = foot.y; y < foot.y + foot.h; y++) for (let x = foot.x; x < foot.x + foot.w; x++) out.push({ x, y });
  return out;
};

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
  /** Créature à placer (outil ⚔️) — déjà résolue (défaut bestiaire inclus). */
  encRef: string;
  layers: Layers;
  sel: Sel;
  onSelect: (s: Sel) => void;
  onHover: (p: Pt) => void;
  /** Couche en cours d'édition (z) : les outils de terrain peignent CETTE couche, et le picking la vise. */
  currentLayer: number;
}) {
  const { rot, setRot, viewMode, setViewMode, view: vb, setView, zoomAt, spaceRef, panRef, canvasRef, stageRef } = view;
  const dims: Dims = { ...scene.dimensions, rot, view: viewMode };
  const stage = stageSize(dims);
  stageRef.current = stage; // le zoom centré (molette/boutons) lit la taille à jour

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
  // aucune chaîne SVG. L'éditeur voit TOUT (pas de brouillard) et dessine la couche de base (viewZ 0).
  const floorEls = useMemo(() => buildFloors(scene, undefined, { viewZ: 0 }), [scene]);
  const floorRows = useMemo(
    () =>
      floorEls.map((el) => {
        const { cx, cy } = tileCenter(el.cell.x, el.cell.y, dims);
        let accCache: string | null = null;
        const acc = lod === 2 ? () => (accCache ??= floorAccentsSvg(el, dims, detailOpts)) : undefined;
        return { key: el.key, cx, cy, html: floorSvg(el, dims, detailOpts), acc };
      }),
    // `dims` dérive de (scene.dimensions, rot, viewMode) : dimensions couvertes par floorEls (⊂ scene).
    [floorEls, rot, viewMode, lod, detailOpts],
  );
  // MURS par le pipeline pivot, memoïsés eux aussi (le IIFE de rendu les ré-insère dans le tri global) :
  // un déplacement de pointeur ne rebâtit plus les chaînes SVG des cloisons.
  const wallRows = useMemo(
    () =>
      buildWalls(scene).map((el) => {
        let accCache: string | null = null;
        const acc = lod === 2 ? () => (accCache ??= wallAccentsSvg(el, dims, detailOpts)) : undefined;
        return { key: el.key, d: wallDepth(el, dims), html: wallSvg(el, dims, detailOpts), acc };
      }),
    // `dims` dérive de (scene.dimensions, rot, viewMode) — deps couvertes.
    [scene, rot, viewMode, lod, detailOpts],
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
        // Une arête-mur proche du curseur prime sur la tuile (sélection de cloison/porte → fold structure).
        const { x: lx, y: ly } = localXY(e);
        const f = screenToTileF(lx, ly, dims, currentLayer);
        const we = pickWallEdge(scene, f.x, f.y, currentLayer);
        if (we) { onSelect({ type: 'wall', x: we.x, y: we.y, side: we.side, z: currentLayer }); return; }
        const hit = hitAt(scene, p, layers);
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
        const existing = scene.entities.find((en) => en.pos.x === p.x && en.pos.y === p.y && (en.z ?? 0) === currentLayer);
        if (existing) return onSelect({ type: 'entity', id: existing.id });
        const out = placeEntity(scene, tool.kind, tool.ref, p, currentLayer);
        setScene(out.scene);
        onSelect({ type: 'entity', id: out.id });
        return;
      }
      case 'roof':
      case 'zone':
        dragStartRef.current = p;
        setDragRect({ x: p.x, y: p.y, w: 1, h: 1 });
        return;
      case 'entry': {
        const out = placeEntry(scene, p);
        setScene(out.scene);
        onSelect({ type: 'entry', id: out.name });
        return;
      }
      case 'emplacement': {
        const existing = scene.entities.find((en) => en.pos.x === p.x && en.pos.y === p.y && (en.z ?? 0) === currentLayer);
        if (existing) return onSelect({ type: 'entity', id: existing.id });
        const out = placeEmplacement(scene, tool.trappingId, p, currentLayer);
        if (out) {
          setScene(out.scene);
          onSelect({ type: 'entity', id: out.id }); // édition immédiate (engin / arc / équipage) dans l'inspecteur
        }
        return;
      }
      case 'encounter': {
        const out = addEnemyMember(scene, encTarget, encRef, p);
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
        else setScene(toggleEdgeWall(scene, wh.p.x, wh.p.y, wh.side, currentLayer, tool.paint === 'door' ? 'door' : 'wall'));
        return;
      }
      case 'height':
        pushSnapshot(); // 1 cran d'undo pour tout le trait
        setPainting(true);
        setSceneNoHistory(paintHeight(scene, p, tool.metres, brush, currentLayer));
        return;
      case 'erase':
        setPainting(true);
        setScene(eraseAt(scene, p));
        return;
    }
  }

  function pointerMove(e: React.PointerEvent) {
    if (panRef.current) {
      const r = canvasRef.current!.getBoundingClientRect();
      const vw = stage.w / vb.zoom,
        vh = stage.h / vb.zoom;
      const dx = (e.clientX - panRef.current.sx) * (vw / r.width);
      const dy = (e.clientY - panRef.current.sy) * (vh / r.height);
      setView((v) => ({ ...v, x: panRef.current!.vx - dx, y: panRef.current!.vy - dy }));
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
    if ((tool.mode === 'roof' || tool.mode === 'zone' || (tool.mode === 'tile' && terrainRect)) && dragStartRef.current)
      setDragRect(rectFrom(dragStartRef.current, p));
    else if (painting && tool.mode === 'tile') setSceneNoHistory(paintTiles(scene, p, tool.terrain, brush, currentLayer));
    else if (painting && tool.mode === 'height') setSceneNoHistory(paintHeight(scene, p, tool.metres, brush, currentLayer));
    else if (painting && tool.mode === 'erase') setScene(eraseAt(scene, p));
  }

  function pointerUp(e: React.PointerEvent) {
    if (panRef.current) {
      panRef.current = null;
      return;
    }
    if (dragStartRef.current) {
      const rect = rectFrom(dragStartRef.current, isoTile(e));
      if (tool.mode === 'zone' && tool.zone === 'trigger') {
        const out = addTrigger(scene, rect);
        setScene(out.scene);
        onSelect({ type: 'trigger', id: out.id }); // Editor ouvre le dock Logique dessus
      } else if (tool.mode === 'zone' && tool.zone === 'rest') {
        const out = addRestZone(scene, rect);
        setScene(out.scene);
        onSelect({ type: 'restZone', idx: out.idx });
      } else if (tool.mode === 'zone' && tool.zone === 'effect') {
        const out = addEffectZone(scene, rect);
        setScene(out.scene);
        onSelect({ type: 'effectZone', idx: out.idx });
      } else if (tool.mode === 'roof') {
        const out = addRoof(scene, tool.style, rect);
        setScene(out.scene);
        onSelect({ type: 'roof', id: out.id });
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
  const selRoof = sel?.type === 'roof' ? (scene.roofs ?? []).find((r) => r.id === sel.id) ?? null : null;
  const zoneRect = sel?.type === 'trigger' || sel?.type === 'restZone' || sel?.type === 'effectZone' ? selRect(scene, sel) : null;
  // Arête-mur sélectionnée (N/E uniquement) sur la couche courante → segment doré (même tracé que hoverEdge).
  const selWall = sel?.type === 'wall' && sel.z === currentLayer && (sel.side === 'N' || sel.side === 'E') ? sel : null;

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
          <g>
            {floorRows.filter(inView).map((r) =>
              r.acc ? (
                // Accents matériaux v2 (LOD 2) : étendus APRÈS le culling `inView`, puis servis du cache.
                <g key={r.key}>
                  <g dangerouslySetInnerHTML={{ __html: r.html }} />
                  <g dangerouslySetInnerHTML={{ __html: r.acc() }} />
                </g>
              ) : (
                <g key={r.key} dangerouslySetInnerHTML={{ __html: r.html }} />
              ),
            )}
          </g>
          <g pointerEvents="none">
            {(() => {
              const objs: { d: number; el: JSX.Element }[] = [];
              // Overlays de terrain à DÉCOR (bois → arbre) — MÊME billboard que les props de scène : les
              // éléments `prop` du builder (source 'terrain') rendus par `EntityToken` (source unique de
              // rendu). Le mur PLEIN, lui, naît du relief de `buildFloors` (faces + dessus), pas ici.
              for (const p of buildProps(scene)) {
                if (p.source !== 'terrain') continue;
                const ent = { id: p.key, kind: 'prop', pos: { x: p.cell.x, y: p.cell.y }, ref: p.ref } as SceneEntity;
                objs.push({ d: depth(p.cell.x, p.cell.y, dims) + 0.4, el: <EntityToken key={p.key} ent={ent} dims={dims} /> });
              }
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
                if (en.kind === 'heroStart') {
                  const { cx, cy } = tileCenter(en.pos.x, en.pos.y, dims);
                  objs.push({
                    d: depth(en.pos.x, en.pos.y, dims) + 0.4,
                    el: (
                      <g key={en.id}>
                        <path d={diamondPath(en.pos.x, en.pos.y, dims)} fill="#2ecc71" opacity={0.55} />
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
                    d: depth(en.pos.x, en.pos.y, dims) + 0.45,
                    el: (
                      <g key={en.id} opacity={hidden ? 0.6 : 1}>
                        {footprintTiles(en.pos, sizeFootprint(entitySize(en))).map((t) => (
                          <path
                            key={`fp-${t.x}-${t.y}`}
                            d={diamondPath(t.x, t.y, dims)}
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
                  objs.push({ d: depth(en.pos.x, en.pos.y, dims) + 0.5, el: <EntityToken key={en.id} ent={en} dims={dims} /> });
                }
              }
              // Cloisons (murs/portes/diagonales) — mêmes faces pivot que le jeu (toutes couches), memoïsées
              // (wallRows), dans le tri global ; accents matériaux v2 (thunk en cache) par-dessus leur mur.
              wallRows.forEach((r) =>
                objs.push({
                  d: r.d,
                  el: r.acc ? (
                    <g key={r.key}>
                      <g dangerouslySetInnerHTML={{ __html: r.html }} />
                      <g dangerouslySetInnerHTML={{ __html: r.acc() }} />
                    </g>
                  ) : (
                    <g key={r.key} dangerouslySetInnerHTML={{ __html: r.html }} />
                  ),
                }),
              );
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
                const isSel = sel?.type === 'trigger' && sel.id === t.id;
                return (
                  <g key={`tr-${t.id}`}>
                    {Array.from({ length: Math.max(0, t.rect.w * t.rect.h) }, (_, i) => {
                      const x = t.rect.x + (i % t.rect.w);
                      const y = t.rect.y + Math.floor(i / t.rect.w);
                      return (
                        <path
                          key={i}
                          d={diamondPath(x, y, dims)}
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
                const isSel = sel?.type === 'restZone' && sel.idx === zi;
                const { cx, cy } = tileCenter(z.rect.x, z.rect.y, dims);
                return (
                  <g key={`rz-${zi}`}>
                    {Array.from({ length: Math.max(0, z.rect.w * z.rect.h) }, (_, i) => {
                      const x = z.rect.x + (i % z.rect.w);
                      const y = z.rect.y + Math.floor(i / z.rect.w);
                      return (
                        <path
                          key={i}
                          d={diamondPath(x, y, dims)}
                          fill={isSel ? 'rgba(46,204,113,0.3)' : 'rgba(46,204,113,0.12)'}
                          stroke={isSel ? SELECT : 'rgba(46,204,113,0.9)'}
                          strokeWidth={isSel ? 2.5 : 1.5}
                          strokeDasharray="4 3"
                        />
                      );
                    })}
                    <text x={cx} y={cy + TH / 4} textAnchor="middle" fontSize="12" pointerEvents="none">
                      ⛺
                    </text>
                  </g>
                );
              })}
            </g>
          )}
          {layers.effects && (
            <g pointerEvents="none">
              {(scene.effectZones ?? []).map((z, zi) => {
                const isSel = sel?.type === 'effectZone' && sel.idx === zi;
                const r = effectZoneRect(z.area);
                const { cx, cy } = tileCenter(r.x, r.y, dims);
                const bar = !!z.barrier; // barrière = trait plein (mur), piège = pointillés (hasard)
                return (
                  <g key={`ez-${z.id}`}>
                    {Array.from({ length: Math.max(0, r.w * r.h) }, (_, i) => {
                      const x = r.x + (i % r.w);
                      const y = r.y + Math.floor(i / r.w);
                      return (
                        <path
                          key={i}
                          d={diamondPath(x, y, dims)}
                          fill={isSel ? (bar ? 'rgba(120,140,200,0.4)' : 'rgba(226,100,30,0.35)') : (bar ? 'rgba(120,140,200,0.18)' : 'rgba(226,100,30,0.15)')}
                          stroke={isSel ? SELECT : bar ? 'rgba(120,140,200,0.95)' : 'rgba(226,100,30,0.9)'}
                          strokeWidth={isSel ? 2.5 : bar ? 2 : 1.5}
                          strokeDasharray={bar ? undefined : '3 2'}
                        />
                      );
                    })}
                    <text x={cx} y={cy + TH / 4} textAnchor="middle" fontSize="12" pointerEvents="none">
                      {bar ? '🧱' : '⚠️'}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
          {layers.entries && (
            <g pointerEvents="none">
              {Object.entries(scene.entryPoints ?? {}).map(([name, pos]) => {
                const isSel = sel?.type === 'entry' && sel.id === name;
                const { cx, cy } = tileCenter(pos.x, pos.y, dims);
                return (
                  <g key={`en-${name}`}>
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
              <path key={`fp-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims)} fill="none" stroke={SELECT} strokeWidth={3} pointerEvents="none" />
            ))}
          {selRoof && (
            <g pointerEvents="none">
              {footCells(selRoof.foot).map((t) => (
                <path key={`selr-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims)} fill="none" stroke={SELECT} strokeWidth={2} opacity={0.8} />
              ))}
            </g>
          )}
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
