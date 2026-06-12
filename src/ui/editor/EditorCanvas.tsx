/**
 * Canvas SVG iso de l'éditeur v2 : rendu WYSIWYG (sol, bâtiments, entités, spawns) + calques
 * d'auteur (triggers, zones de repos, points d'entrée) + interactions pointeur — peindre, poser,
 * drag-rectangle, sélection/déplacement et REDIMENSIONNEMENT par poignée (coin SE des zones).
 * Les overlays sont en `pointer-events: none` : tout le picking passe par `hitAt` (les calques
 * masqués laissent cliquer à travers). La logique de mutation vit dans `editorState` (pur).
 */
import { useRef, useState } from 'react';
import { Scene, SceneEntity, tileAt } from '../../state/scene';
import { Dims, diamondPath, tileCenter, screenToTile, stageSize, depth, TH } from '../../gameIso/iso';
import { DEFS, terrainOverlay } from '../../gameIso/sprites';
import { EntityToken } from '../../gameIso/EntityToken';
import { footprintTiles } from '../../state/footprint';
import { entitySize } from '../../state/spawn';
import { groundTile } from '../../gameIso/ground';
import { buildingObj } from '../../gameIso/BuildingSprite';
import { perimeterTiles } from '../../state/buildings';
import { ViewControls } from '../ViewControls';
import type { useEditorView } from './useEditorView';
import {
  Tool, Layers, Sel, Rect, Pt, rectFrom, hitAt, selRect, moveSel, resizeSel, paintTiles, fillTerrainRect,
  placeEntity, placeEntry, addTrigger, addRestZone, addBuilding, addSpawn, eraseAt, sameSel,
} from './editorState';

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
}) {
  const { rot, setRot, viewMode, setViewMode, view: vb, setView, zoomAt, spaceRef, panRef, canvasRef, stageRef } = view;
  const dims: Dims = { ...scene.dimensions, rot, view: viewMode };
  const stage = stageSize(dims);
  stageRef.current = stage; // le zoom centré (molette/boutons) lit la taille à jour

  const dragStartRef = useRef<Pt | null>(null);
  const [dragRect, setDragRect] = useState<Rect | null>(null);
  const [painting, setPainting] = useState(false);
  const moveRef = useRef<{ from: Pt; moved: boolean } | null>(null);
  const resizeRef = useRef<{ moved: boolean } | null>(null);

  /** Point écran → tuile (projection iso, comme le jeu). */
  function isoTile(ev: React.PointerEvent): Pt {
    const svg = canvasRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return screenToTile(loc.x, loc.y, dims);
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
          setSceneNoHistory(paintTiles(scene, p, tool.terrain, brush));
        }
        return;
      case 'entity': {
        const existing = scene.entities.find((en) => en.pos.x === p.x && en.pos.y === p.y);
        if (existing) return onSelect({ type: 'entity', id: existing.id });
        const out = placeEntity(scene, tool.kind, tool.ref, p);
        setScene(out.scene);
        onSelect({ type: 'entity', id: out.id });
        return;
      }
      case 'building':
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
      case 'encounter': {
        const out = addSpawn(scene, encTarget, encRef, p);
        setScene(out.scene);
        if (out.encId !== encTarget) setEncTarget(out.encId);
        return;
      }
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
    if ((tool.mode === 'building' || tool.mode === 'zone' || (tool.mode === 'tile' && terrainRect)) && dragStartRef.current)
      setDragRect(rectFrom(dragStartRef.current, p));
    else if (painting && tool.mode === 'tile') setSceneNoHistory(paintTiles(scene, p, tool.terrain, brush));
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
      } else if (tool.mode === 'building') {
        const out = addBuilding(scene, tool.type, rect);
        if (out) {
          setScene(out.scene);
          onSelect({ type: 'building', id: out.id });
        }
      } else if (tool.mode === 'tile' && terrainRect) {
        setScene(fillTerrainRect(scene, rect, tool.terrain));
      }
    }
    dragStartRef.current = null;
    setDragRect(null);
    setPainting(false);
    moveRef.current = null;
    resizeRef.current = null;
  }

  // Surlignage de la sélection : empreinte (entité), périmètre (bâtiment), rect (zones).
  const selEnt = sel?.type === 'entity' ? scene.entities.find((en) => en.id === sel.id) ?? null : null;
  const selBuilding = sel?.type === 'building' ? (scene.buildings ?? []).find((b) => b.id === sel.id) ?? null : null;
  const zoneRect = sel?.type === 'trigger' || sel?.type === 'restZone' ? selRect(scene, sel) : null;

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
            moveRef.current = null;
            resizeRef.current = null;
          }}
        >
          <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
          <g>
            {(() => {
              const els: JSX.Element[] = [];
              for (let y = 0; y < dims.h; y++)
                for (let x = 0; x < dims.w; x++)
                  els.push(<g key={`f${x}-${y}`} dangerouslySetInnerHTML={{ __html: groundTile(scene, x, y, dims) }} />);
              return els;
            })()}
          </g>
          <g pointerEvents="none">
            {(() => {
              const objs: { d: number; el: JSX.Element }[] = [];
              for (let y = 0; y < dims.h; y++)
                for (let x = 0; x < dims.w; x++) {
                  const ov = terrainOverlay(tileAt(scene, x, y), x, y, dims);
                  if (ov) objs.push({ d: ov.d, el: <g key={`ov${x}-${y}`} dangerouslySetInnerHTML={{ __html: ov.html }} /> });
                }
              if (layers.buildings) for (const b of scene.buildings ?? []) objs.push(buildingObj(b, dims, false, false)); // aperçu de jour ; le jour/nuit est runtime via l'horloge
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
                } else {
                  objs.push({ d: depth(en.pos.x, en.pos.y, dims) + 0.5, el: <EntityToken key={en.id} ent={en} dims={dims} /> });
                }
              }
              // Ennemis des rencontres (points d'apparition).
              if (layers.spawns)
                for (const [encIdx, enc] of scene.encounters.entries()) {
                  enc.enemies.forEach((en, idx) => {
                    const isSel = sameSel(sel, { type: 'spawn', enc: encIdx, idx });
                    const synth = { id: `spawn-${encIdx}-${idx}`, kind: 'personnage', ref: en.ref, pos: en.pos, appearance: en.appearance, weapon: en.weapon } as SceneEntity;
                    objs.push({
                      d: depth(en.pos.x, en.pos.y, dims) + 0.45,
                      el: (
                        <g key={`spawn-${encIdx}-${idx}`}>
                          {footprintTiles(en.pos, entitySize(en)).map((t) => (
                            <path
                              key={`fp-${t.x}-${t.y}`}
                              d={diamondPath(t.x, t.y, dims)}
                              fill="rgba(192,57,43,0.32)"
                              stroke={isSel ? '#ffe066' : '#c0392b'}
                              strokeWidth={isSel ? 2.5 : 1.5}
                            />
                          ))}
                          <EntityToken ent={synth} dims={dims} />
                        </g>
                      ),
                    });
                  });
                }
              objs.sort((a, b) => a.d - b.d);
              return objs.map((o) => o.el);
            })()}
          </g>
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
                          stroke={isSel ? '#ffe066' : 'rgba(231,76,60,0.9)'}
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
                          stroke={isSel ? '#ffe066' : 'rgba(46,204,113,0.9)'}
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
          {layers.entries && (
            <g pointerEvents="none">
              {Object.entries(scene.entryPoints ?? {}).map(([name, pos]) => {
                const isSel = sel?.type === 'entry' && sel.id === name;
                const { cx, cy } = tileCenter(pos.x, pos.y, dims);
                return (
                  <g key={`en-${name}`}>
                    <path d={diamondPath(pos.x, pos.y, dims)} fill="rgba(78,195,224,0.5)" stroke={isSel ? '#ffe066' : '#4ec3e0'} strokeWidth={isSel ? 2.5 : 1.5} />
                    <text x={cx} y={cy + TH / 4} textAnchor="middle" fontSize="12" fontWeight="bold" fill="#06222b">
                      ⚑
                    </text>
                    <text x={cx} y={cy - TH / 2} textAnchor="middle" fontSize="10" fill="#bfe9f5" stroke="#06222b" strokeWidth={0.4}>
                      {name}
                    </text>
                  </g>
                );
              })}
            </g>
          )}
          {selEnt &&
            footprintTiles(selEnt.pos, entitySize(selEnt)).map((t) => (
              <path key={`fp-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims)} fill="none" stroke="#ffe066" strokeWidth={3} pointerEvents="none" />
            ))}
          {selBuilding && (
            <g pointerEvents="none">
              {perimeterTiles(selBuilding).map((t) => (
                <path key={`selb-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims)} fill="none" stroke="#ffe066" strokeWidth={2} opacity={0.8} />
              ))}
            </g>
          )}
          {zoneRect && (
            // Poignée de REDIMENSIONNEMENT (coin SE) — manque du POC comblé.
            <path
              d={diamondPath(zoneRect.x + zoneRect.w - 1, zoneRect.y + zoneRect.h - 1, dims)}
              fill="rgba(255,224,102,0.45)"
              stroke="#ffe066"
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
