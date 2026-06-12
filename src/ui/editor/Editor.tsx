import { useRef, useState, useEffect, useMemo } from 'react';
import { useGame } from '../../state/store';
import { Scene, Terrain, SceneEntity, emptyScene, tileAt } from '../../state/scene';
import { nextEntityId } from '../../state/entityId';
import { validateScene, type Warning } from '../../state/validateScene';
import { testScene } from '../../scenes/test-fixture';
import { creatures } from '../../data';
import { Dims, diamondPath, tileCenter, screenToTile, stageSize, depth, TH } from '../../gameIso/iso';
import { DEFS, terrainOverlay } from '../../gameIso/sprites';
import { EntityToken } from '../../gameIso/EntityToken';
import { footprintTiles } from '../../state/footprint';
import { entitySize } from '../../state/spawn';
import { groundTile } from '../../gameIso/ground';
import { BUILDINGS_META } from '../../gameIso/catalog/buildings';
import { buildingObj } from '../../gameIso/BuildingSprite';
import { perimeterTiles, defaultDoor } from '../../state/buildings';
import { BuildingFeature, Trigger, EncounterDef } from '../../state/scene';
import { ViewControls } from '../ViewControls';
import { effectCtxOf } from './EffectList';
import { TriggersEditor } from './TriggersEditor';
import { DialogueEditor } from './DialogueEditor';
import { EncountersEditor } from './EncountersEditor';
import { useSceneHistory } from './useSceneHistory';
import { useEditorView } from './useEditorView';
import { Palette } from './Palette';
import { Inspector } from './Inspector';
import { WorldMapEditor } from './WorldMapEditor';
import { OpenProjectModal, SaveProjectModal } from './ProjectModals';
import { projectSave, SavedProject } from '../../state/projectLibrary';
import type { TestScenario } from '../../scenes/test-scenarios';
import { WorldMap, parseProject } from '../../state/worldMap';
import { Tool, Rect, Layers, KIND_LABEL, rectFrom } from './tools';

/**
 * Éditeur de niveau iso WYSIWYG. Ce composant ORCHESTRE : l'historique d'édition vit dans
 * `useSceneHistory`, la caméra (zoom/pan/rotation) dans `useEditorView`, le volet gauche dans
 * `Palette`, le volet droit dans `Inspector` — ici restent l'état de sélection, les outils
 * (pointeur → scène) et le canvas SVG.
 */
export function Editor() {
  const setScreen = useGame((s) => s.setScreen);
  const loadProject = useGame((s) => s.loadProject);
  const party = useGame((s) => s.party);

  const { scene, setScene, setSceneNoHistory, pushSnapshot, undo, redo, resetScene, canUndo, canRedo } = useSceneHistory(() => clone(testScene));
  const [tool, setTool] = useState<Tool>({ mode: 'select' });
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [selectedSpawn, setSelectedSpawn] = useState<{ enc: number; idx: number } | null>(null);
  const [encTarget, setEncTarget] = useState<string>(''); // rencontre cible pour le placement
  const [encRef, setEncRef] = useState<string>(''); // créature à placer
  const [otherScenes, setOtherScenes] = useState<Scene[]>([]); // projet : scènes ≠ active
  const [worldMap, setWorldMap] = useState<WorldMap | null>(null); // projet : carte du monde (#T2)
  const [worldOpen, setWorldOpen] = useState(false);
  const [painting, setPainting] = useState(false);
  const [clip, setClip] = useState<SceneEntity | null>(null); // presse-papier (copier/coller)
  const hoverRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 }); // dernière case survolée (cible de Ctrl+V)
  const [brush, setBrush] = useState(1); // taille de pinceau terrain (1/3/5)
  const [creatureFilter, setCreatureFilter] = useState(''); // recherche dans la palette créatures
  const [terrainRect, setTerrainRect] = useState(false); // pinceau terrain en mode Rectangle (drag → remplir)
  const [layers, setLayers] = useState<Layers>({ triggers: true, spawns: true, buildings: true }); // calques masquables
  const [advOpen, setAdvOpen] = useState(false);
  const [advText, setAdvText] = useState('');
  const [trigOpen, setTrigOpen] = useState(false);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [encOpen, setEncOpen] = useState(false);
  const [palTab, setPalTab] = useState<'carte' | 'logique' | 'scene'>('carte');
  const [drawer, setDrawer] = useState<null | 'palette' | 'inspector'>(null); // tiroir tactile ouvert (≤900px)
  const [openOpen, setOpenOpen] = useState(false); // modale « Ouvrir » (scénarios + bibliothèque)
  const [saveOpen, setSaveOpen] = useState(false); // modale « Enregistrer »
  const [projectId, setProjectId] = useState<string | null>(null); // projet localStorage en cours
  const [projectName, setProjectName] = useState('La Diligence');
  const [published, setPublished] = useState(false);

  const { rot, setRot, viewMode, setViewMode, view, setView, zoomAt, spaceRef, panRef, canvasRef, stageRef } = useEditorView();
  const dims: Dims = { ...scene.dimensions, rot, view: viewMode };
  const stage = stageSize(dims);
  stageRef.current = stage; // le zoom centré (molette/boutons) lit la taille à jour

  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<Rect | null>(null);

  const enemyCreatures = creatures.filter((c) => typeof c.char.B === 'number');

  // Raccourcis Annuler/Rétablir. Dans un champ de saisie, on laisse l'undo natif.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  function clone(s: Scene): Scene {
    return JSON.parse(JSON.stringify(s));
  }

  // --- Projet multi-scènes : la scène éditée (`scene`, avec son historique) + les
  // autres scènes en réserve (`otherScenes`). Permet d'authoring et de lier des
  // intérieurs sans toucher campaign.ts. ---
  function switchScene(id: string) {
    if (id === scene.id) return;
    const target = otherScenes.find((s) => s.id === id);
    if (!target) return;
    setOtherScenes([...otherScenes.filter((s) => s.id !== id), scene]); // ranger l'active, sortir la cible
    resetScene(target);
  }
  function addScene() {
    const s = emptyScene();
    s.id = `scene-${Date.now().toString(36)}`;
    s.nom = 'Nouvelle scène';
    setOtherScenes([...otherScenes, scene]);
    resetScene(s);
  }
  function deleteScene(id: string) {
    if (id === scene.id) {
      if (otherScenes.length === 0) return; // ne pas supprimer la dernière scène
      const [next, ...rest] = otherScenes;
      setOtherScenes(rest);
      resetScene(next);
    } else {
      setOtherScenes(otherScenes.filter((s) => s.id !== id));
    }
  }

  /** Point écran → tuile (projection iso, comme le jeu). */
  function isoTile(ev: React.PointerEvent): { x: number; y: number } {
    const svg = canvasRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return screenToTile(loc.x, loc.y, dims);
  }

  function applyAt(p: { x: number; y: number }) {
    const { w, h } = scene.dimensions;
    if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return;
    if (tool.mode === 'tile') {
      const tiles = [...scene.tiles];
      const r = Math.floor((brush - 1) / 2); // pinceau carré de côté `brush`
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const x = p.x + dx,
            y = p.y + dy;
          if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = tool.terrain;
        }
      setSceneNoHistory({ ...scene, tiles }); // geste coalescé (snapshot poussé au pointer-down)
    } else if (tool.mode === 'erase') {
      const ent = scene.entities.find((e) => e.pos.x === p.x && e.pos.y === p.y);
      if (ent) setScene({ ...scene, entities: scene.entities.filter((e) => e !== ent) });
    } else if (tool.mode === 'entity') {
      const existing = scene.entities.find((e) => e.pos.x === p.x && e.pos.y === p.y);
      if (existing) {
        setSelected(existing.id);
        setSelectedTrigger(null);
        setSelectedSpawn(null);
        return;
      }
      const id = nextEntityId(tool.kind, scene.entities.map((e) => e.id));
      const ent: SceneEntity = { id, kind: tool.kind, pos: { ...p }, label: KIND_LABEL[tool.kind] };
      // 'personnage' sans ref → villageois par défaut (apparence éditable dans l'inspecteur).
      setScene({ ...scene, entities: [...scene.entities, ent] });
      setSelected(id);
      setSelectedTrigger(null);
      setSelectedSpawn(null);
    } else if (tool.mode === 'encounter') {
      // Ajoute un ennemi à la rencontre cible (créée si « Nouvelle… »).
      const ref = encRef || enemyCreatures[0]?.label || 'Mutant';
      const encs = scene.encounters.map((e) => ({ ...e, enemies: [...e.enemies] }));
      let target = encs.find((e) => e.id === encTarget);
      if (!target) {
        target = { id: encTarget || nextEntityId('enc', scene.encounters.map((e) => e.id)), enemies: [] };
        encs.push(target);
        setEncTarget(target.id);
      }
      target.enemies.push({ ref, pos: { ...p } });
      setScene({ ...scene, encounters: encs });
    }
  }

  /** Remplit un rectangle de terrain (sous-mode Rectangle) — 1 cran d'undo. */
  function fillTerrainRect(rect: Rect) {
    if (tool.mode !== 'tile') return;
    const { w, h } = scene.dimensions;
    const tiles = [...scene.tiles];
    for (let y = rect.y; y < rect.y + rect.h; y++)
      for (let x = rect.x; x < rect.x + rect.w; x++) {
        if (x >= 0 && y >= 0 && x < w && y < h) tiles[y * w + x] = tool.terrain;
      }
    setScene({ ...scene, tiles });
  }
  function addTrigger(rect: Rect) {
    setScene({ ...scene, triggers: [...scene.triggers, { id: nextEntityId('trig', scene.triggers.map((t) => t.id)), rect, once: true, effects: [] }] });
    setTrigOpen(true); // ouvrir l'éditeur pour attacher les effets
  }
  /** Sélectionne une zone trigger existante (clic direct sur la carte) ; exclusif. */
  function selectTrigger(id: string) {
    setSelectedTrigger(id);
    setSelected(null);
    setSelectedBuilding(null);
    setSelectedSpawn(null);
  }
  /** Sélectionne un ennemi de rencontre (clic sur la carte) ; exclusif. */
  function selectSpawn(enc: number, idx: number) {
    setSelectedSpawn({ enc, idx });
    setSelected(null);
    setSelectedBuilding(null);
    setSelectedTrigger(null);
  }
  function addBuilding(type: string, rect: Rect) {
    const meta = BUILDINGS_META[type];
    if (!meta) return;
    const b: BuildingFeature = {
      id: nextEntityId('b', (scene.buildings ?? []).map((b) => b.id)),
      type: meta.id,
      foot: rect,
      facing: 'S',
      reveal: meta.defaultReveal,
      door: defaultDoor(rect, 'S'),
      params: {},
      label: meta.label,
    };
    setScene({ ...scene, buildings: [...(scene.buildings ?? []), b] });
    setSelected(null);
    setSelectedTrigger(null);
    setSelectedSpawn(null);
    setSelectedBuilding(b.id);
  }

  // --- Glisser-déplacer (outil Sélection) ---
  const moveRef = useRef<{ kind: 'entity' | 'building' | 'trigger' | 'spawn'; id: string; enc?: number; idx?: number; from: { x: number; y: number }; moved: boolean } | null>(null);
  /** Élément occupant la case p (priorité spawn > entité > trigger > bâtiment). */
  function hitAt(p: { x: number; y: number }) {
    for (let ei = 0; ei < scene.encounters.length; ei++) {
      const ii = scene.encounters[ei].enemies.findIndex((en) => en.pos.x === p.x && en.pos.y === p.y);
      if (ii >= 0) return { kind: 'spawn' as const, id: `${ei}:${ii}`, enc: ei, idx: ii };
    }
    const ent = scene.entities.find((e) => e.pos.x === p.x && e.pos.y === p.y);
    if (ent) return { kind: 'entity' as const, id: ent.id };
    const t = scene.triggers.find((t) => p.x >= t.rect.x && p.x < t.rect.x + t.rect.w && p.y >= t.rect.y && p.y < t.rect.y + t.rect.h);
    if (t) return { kind: 'trigger' as const, id: t.id };
    const b = (scene.buildings ?? []).find((b) => p.x >= b.foot.x && p.x < b.foot.x + b.foot.w && p.y >= b.foot.y && p.y < b.foot.y + b.foot.h);
    if (b) return { kind: 'building' as const, id: b.id };
    return null;
  }
  /** Sélection exclusive de l'élément touché. */
  function selectHit(hit: NonNullable<ReturnType<typeof hitAt>>) {
    if (hit.kind === 'entity') { setSelected(hit.id); setSelectedTrigger(null); setSelectedSpawn(null); setSelectedBuilding(null); }
    else if (hit.kind === 'trigger') selectTrigger(hit.id);
    else if (hit.kind === 'spawn') selectSpawn(hit.enc, hit.idx);
    else { setSelectedBuilding(hit.id); setSelected(null); setSelectedTrigger(null); setSelectedSpawn(null); }
  }
  /** Déplace la cible (clampée dans la carte), mutation coalescée (snapshot poussé au 1er move). */
  function moveTarget(m: NonNullable<typeof moveRef.current>, to: { x: number; y: number }) {
    const { w, h } = scene.dimensions;
    const cl = (v: number, max: number) => Math.max(0, Math.min(max - 1, v));
    if (m.kind === 'entity') {
      setSceneNoHistory({ ...scene, entities: scene.entities.map((e) => (e.id === m.id ? { ...e, pos: { x: cl(to.x, w), y: cl(to.y, h) } } : e)) });
    } else if (m.kind === 'spawn') {
      const encs = scene.encounters.map((e) => ({ ...e, enemies: [...e.enemies] }));
      encs[m.enc!].enemies[m.idx!] = { ...encs[m.enc!].enemies[m.idx!], pos: { x: cl(to.x, w), y: cl(to.y, h) } };
      setSceneNoHistory({ ...scene, encounters: encs });
    } else if (m.kind === 'trigger') {
      setSceneNoHistory({ ...scene, triggers: scene.triggers.map((t) => (t.id === m.id ? { ...t, rect: { ...t.rect, x: cl(to.x, w - t.rect.w + 1), y: cl(to.y, h - t.rect.h + 1) } } : t)) });
    } else {
      setSceneNoHistory({ ...scene, buildings: (scene.buildings ?? []).map((b) => (b.id === m.id ? { ...b, foot: { ...b.foot, x: cl(to.x, w - b.foot.w + 1), y: cl(to.y, h - b.foot.h + 1) } } : b)) });
    }
  }

  const sel = scene.entities.find((e) => e.id === selected) ?? null;
  const updateSel = (patch: Partial<SceneEntity>) =>
    setScene({ ...scene, entities: scene.entities.map((e) => (e.id === selected ? { ...e, ...patch } : e)) });
  /** Colle une copie de `data` (id frais) à la case p. */
  function pasteEntity(data: SceneEntity, p: { x: number; y: number }) {
    const id = nextEntityId(data.kind, scene.entities.map((e) => e.id));
    const ent: SceneEntity = { ...JSON.parse(JSON.stringify(data)), id, pos: { ...p } };
    setScene({ ...scene, entities: [...scene.entities, ent] });
    setSelected(id);
    setSelectedTrigger(null);
    setSelectedSpawn(null);
    setSelectedBuilding(null);
  }
  /** Duplique la sélection à +1,+1 (clampé). */
  function duplicateSel() {
    if (!sel) return;
    const { w, h } = scene.dimensions;
    pasteEntity(sel, { x: Math.min(w - 1, sel.pos.x + 1), y: Math.min(h - 1, sel.pos.y + 1) });
  }
  // Copier / coller / dupliquer (entités) — Ctrl+C/V/D, hors champ de saisie.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === 'c' && sel) { e.preventDefault(); setClip(JSON.parse(JSON.stringify(sel))); }
      else if (k === 'v' && clip) { e.preventDefault(); pasteEntity(clip, hoverRef.current); }
      else if (k === 'd' && sel) { e.preventDefault(); duplicateSel(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sel, clip, scene]);
  const selB = (scene.buildings ?? []).find((b) => b.id === selectedBuilding) ?? null;
  const selT = scene.triggers.find((t) => t.id === selectedTrigger) ?? null;
  // Avertissements de LA scène éditée + ceux de la carte du monde (rattachés à aucune scène).
  const warnings = useMemo(
    () => validateScene([scene, ...otherScenes], worldMap).filter((w) => w.sceneId === scene.id || w.scope === 'worldMap'),
    [scene, otherScenes, worldMap],
  );
  /** Clic sur un avertissement → sélectionne le fautif. */
  function selectWarning(w: Warning) {
    if (!w.refId) return;
    if (w.scope === 'entity') { setSelected(w.refId); setSelectedTrigger(null); setSelectedSpawn(null); setSelectedBuilding(null); }
    else if (w.scope === 'trigger') selectTrigger(w.refId);
    else if (w.scope === 'building') { setSelectedBuilding(w.refId); setSelected(null); setSelectedTrigger(null); setSelectedSpawn(null); }
    else if (w.scope === 'dialogue') setDlgOpen(true);
    else if (w.scope === 'encounter') setEncOpen(true);
  }
  // Clavier : Suppr = supprimer la sélection ; flèches = nudge d'1 case (hors champ de saisie).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (sel) { e.preventDefault(); setScene({ ...scene, entities: scene.entities.filter((x) => x.id !== sel.id) }); setSelected(null); }
        else if (selT) { e.preventDefault(); setScene({ ...scene, triggers: scene.triggers.filter((t) => t.id !== selT.id) }); setSelectedTrigger(null); }
        else if (selB) { e.preventDefault(); setScene({ ...scene, buildings: (scene.buildings ?? []).filter((b) => b.id !== selB.id) }); setSelectedBuilding(null); }
        return;
      }
      const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (sel && d[e.key]) {
        e.preventDefault();
        const { w, h } = scene.dimensions;
        const nx = Math.max(0, Math.min(w - 1, sel.pos.x + d[e.key][0]));
        const ny = Math.max(0, Math.min(h - 1, sel.pos.y + d[e.key][1]));
        setScene({ ...scene, entities: scene.entities.map((x) => (x.id === sel.id ? { ...x, pos: { x: nx, y: ny } } : x)) });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene, sel, selT, selB]);
  const updateSelT = (patch: Partial<Trigger>) =>
    setScene({ ...scene, triggers: scene.triggers.map((t) => (t.id === selectedTrigger ? { ...t, ...patch } : t)) });
  const updateSelTRect = (patch: Partial<Trigger['rect']>) => updateSelT({ rect: { ...selT!.rect, ...patch } });
  const spawn = selectedSpawn ? scene.encounters[selectedSpawn.enc]?.enemies[selectedSpawn.idx] ?? null : null;
  const updateSpawn = (patch: Partial<EncounterDef['enemies'][number]>) => {
    if (!selectedSpawn) return;
    const { enc, idx } = selectedSpawn;
    setScene({
      ...scene,
      encounters: scene.encounters.map((e, ei) =>
        ei === enc ? { ...e, enemies: e.enemies.map((en, ni) => (ni === idx ? { ...en, ...patch } : en)) } : e,
      ),
    });
  };
  const deleteSpawn = () => {
    if (!selectedSpawn) return;
    const { enc, idx } = selectedSpawn;
    setScene({
      ...scene,
      encounters: scene.encounters.map((e, ei) => (ei === enc ? { ...e, enemies: e.enemies.filter((_, ni) => ni !== idx) } : e)),
    });
    setSelectedSpawn(null);
  };
  const updateSelB = (patch: Partial<BuildingFeature>) =>
    setScene({ ...scene, buildings: (scene.buildings ?? []).map((b) => (b.id === selectedBuilding ? { ...b, ...patch } : b)) });
  const updateSelBParam = (key: string, value: unknown) =>
    setScene({
      ...scene,
      buildings: (scene.buildings ?? []).map((b) =>
        b.id === selectedBuilding ? { ...b, params: { ...b.params, [key]: value } } : b,
      ),
    });

  function exportJson() {
    // Exporte le PROJET v2 (scènes + carte du monde) ; la première scène est l'entrée.
    // L'import accepte toujours le format legacy (tableau de scènes) — cf. parseProject.
    const project = { schema: 2 as const, scenes: [scene, ...otherScenes], ...(worldMap ? { worldMap } : {}) };
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scene.id}-projet.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importJson(file: File) {
    file.text().then((txt) => {
      try {
        const data = JSON.parse(txt);
        // Projet v2 ({ scenes, worldMap? }), legacy (tableau) OU scène unique — cf. parseProject.
        const { scenes, worldMap: wm } = parseProject(data);
        if (!scenes.length) return;
        setOtherScenes(scenes.slice(1));
        setWorldMap(wm ?? null);
        resetScene(scenes[0]);
        setSelected(null);
      } catch {
        alert('JSON invalide');
      }
    });
  }
  function test() {
    if (party.length === 0) {
      alert('Ajoutez d\'abord au moins un aventurier au groupe (menu Nouvelle partie) pour tester.');
      return;
    }
    loadProject([scene, ...otherScenes], scene.id, worldMap);
    setScreen('campaign');
  }
  function loadScenario(sc: TestScenario) {
    setOtherScenes((sc.extraScenes ?? []).map(clone));
    setWorldMap(sc.worldMap ? JSON.parse(JSON.stringify(sc.worldMap)) : null);
    setProjectId(null);
    setProjectName(sc.title);
    setPublished(false);
    setSelected(null);
    resetScene(clone(sc.scene));
    setOpenOpen(false);
  }
  function loadSaved(p: SavedProject) {
    const scenes = p.project.scenes;
    setOtherScenes(scenes.slice(1).map(clone));
    setWorldMap(p.project.worldMap ? JSON.parse(JSON.stringify(p.project.worldMap)) : null);
    setProjectId(p.id);
    setProjectName(p.name);
    setPublished(p.published);
    setSelected(null);
    resetScene(clone(scenes[0]));
    setOpenOpen(false);
  }
  function saveProject(name: string, pub: boolean, startSceneId: string) {
    const id = projectId ?? `proj-${Date.now().toString(36)}`;
    projectSave({
      id,
      name,
      startSceneId,
      savedAt: Date.now(),
      published: pub,
      project: { schema: 2, scenes: [scene, ...otherScenes], ...(worldMap ? { worldMap } : {}) },
    });
    setProjectId(id);
    setProjectName(name);
    setPublished(pub);
    setSaveOpen(false);
  }
  function openAdvanced() {
    setAdvText(JSON.stringify({ dialogues: scene.dialogues, triggers: scene.triggers, encounters: scene.encounters }, null, 2));
    setAdvOpen(true);
  }
  function saveAdvanced() {
    try {
      const obj = JSON.parse(advText);
      setScene({ ...scene, dialogues: obj.dialogues ?? [], triggers: obj.triggers ?? [], encounters: obj.encounters ?? [] });
      setAdvOpen(false);
    } catch {
      alert('JSON invalide');
    }
  }
  function resize(w: number, h: number) {
    const tiles: Terrain[] = new Array(w * h).fill('herbe');
    for (let y = 0; y < Math.min(h, scene.dimensions.h); y++)
      for (let x = 0; x < Math.min(w, scene.dimensions.w); x++) tiles[y * w + x] = tileAt(scene, x, y);
    setScene({ ...scene, dimensions: { w, h }, tiles });
  }

  return (
    <div className="screen editor-screen">
      <header className="bar">
        <button className="btn small" onClick={() => setScreen('menu')}>
          ← Menu
        </button>
        <h2>Éditeur de niveau</h2>
        <div className="editor-toolbar">
          <button className="btn small" onClick={() => resetScene(emptyScene())}>
            Nouveau
          </button>
          <button className="btn small" onClick={() => setOpenOpen(true)}>
            Ouvrir
          </button>
          <button className="btn small" onClick={() => setSaveOpen(true)} title="Enregistrer le projet (bibliothèque locale)">
            Enregistrer
          </button>
          <button className="btn small" onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
            ↶ Annuler
          </button>
          <button className="btn small" onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Y)">
            ↷ Rétablir
          </button>
          <label className="btn small file-btn">
            Importer
            <input type="file" accept="application/json" onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} hidden />
          </label>
          <button className="btn small" onClick={exportJson}>
            Exporter JSON
          </button>
          <button className="btn small" onClick={() => setWorldOpen(true)} title="Carte du monde du projet : lieux, routes, voyage (#T2)">
            🗺️ Monde{worldMap ? ` (${worldMap.places.length})` : ''}
          </button>
          <button className="btn small btn-primary" onClick={test}>
            ▶ Tester
          </button>
        </div>
      </header>

      <div className={`editor-body${drawer ? ` drawer-${drawer}` : ''}`}>
        <Palette
          scene={scene}
          otherScenes={otherScenes}
          setScene={setScene}
          tool={tool}
          setTool={setTool}
          layers={layers}
          setLayers={setLayers}
          brush={brush}
          setBrush={setBrush}
          terrainRect={terrainRect}
          setTerrainRect={setTerrainRect}
          palTab={palTab}
          setPalTab={setPalTab}
          encTarget={encTarget}
          setEncTarget={setEncTarget}
          encRef={encRef}
          setEncRef={setEncRef}
          creatureFilter={creatureFilter}
          setCreatureFilter={setCreatureFilter}
          enemyCreatures={enemyCreatures}
          warnings={warnings}
          onSelectWarning={selectWarning}
          openTriggers={() => setTrigOpen(true)}
          openDialogues={() => setDlgOpen(true)}
          openEncounters={() => setEncOpen(true)}
          openAdvanced={openAdvanced}
          switchScene={switchScene}
          addScene={addScene}
          deleteScene={deleteScene}
          resize={resize}
        />

        <main className="editor-canvas-wrap">
          <div style={{ position: 'relative', maxWidth: '100%', lineHeight: 0 }}>
          <svg
            ref={canvasRef}
            className="editor-iso"
            viewBox={`${view.x} ${view.y} ${stage.w / view.zoom} ${stage.h / view.zoom}`}
            width={stage.w}
            height={stage.h}
            onPointerDown={(e) => {
              // Pan : clic du milieu OU Espace maintenu → on déplace le viewBox (pas d'édition).
              if (e.button === 1 || spaceRef.current) {
                e.preventDefault();
                panRef.current = { sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y };
                canvasRef.current?.setPointerCapture?.(e.pointerId);
                return;
              }
              const p = isoTile(e);
              if (tool.mode === 'select') {
                const hit = hitAt(p);
                if (hit) {
                  selectHit(hit);
                  moveRef.current =
                    hit.kind === 'spawn'
                      ? { kind: 'spawn', id: hit.id, enc: hit.enc, idx: hit.idx, from: p, moved: false }
                      : { kind: hit.kind, id: hit.id, from: p, moved: false };
                } else {
                  setSelected(null);
                  setSelectedBuilding(null);
                  setSelectedTrigger(null);
                  setSelectedSpawn(null);
                }
                return;
              }
              if (tool.mode === 'trigger' || tool.mode === 'building' || (tool.mode === 'tile' && terrainRect)) {
                dragStartRef.current = p;
                setDragRect({ x: p.x, y: p.y, w: 1, h: 1 });
              } else {
                if (tool.mode === 'tile') pushSnapshot(); // 1 cran d'undo pour tout le trait
                setPainting(true);
                applyAt(p);
              }
            }}
            onPointerMove={(e) => {
              if (panRef.current) {
                const r = canvasRef.current!.getBoundingClientRect();
                const vw = stage.w / view.zoom,
                  vh = stage.h / view.zoom;
                const dx = (e.clientX - panRef.current.sx) * (vw / r.width);
                const dy = (e.clientY - panRef.current.sy) * (vh / r.height);
                setView((v) => ({ ...v, x: panRef.current!.vx - dx, y: panRef.current!.vy - dy }));
                return;
              }
              hoverRef.current = isoTile(e);
              if (moveRef.current) {
                const to = isoTile(e);
                const m = moveRef.current;
                if (!m.moved && to.x === m.from.x && to.y === m.from.y) return; // clic simple = sélection, pas de déplacement
                if (!m.moved) { pushSnapshot(); m.moved = true; } // 1 cran d'undo au 1er déplacement réel
                moveTarget(m, to);
                return;
              }
              if ((tool.mode === 'trigger' || tool.mode === 'building' || (tool.mode === 'tile' && terrainRect)) && dragStartRef.current)
                setDragRect(rectFrom(dragStartRef.current, isoTile(e)));
              else if (painting && tool.mode === 'tile') applyAt(isoTile(e));
            }}
            onPointerUp={(e) => {
              if (panRef.current) {
                panRef.current = null;
                return;
              }
              if (tool.mode === 'trigger' && dragStartRef.current) addTrigger(rectFrom(dragStartRef.current, isoTile(e)));
              else if (tool.mode === 'building' && dragStartRef.current) addBuilding(tool.type, rectFrom(dragStartRef.current, isoTile(e)));
              else if (tool.mode === 'tile' && terrainRect && dragStartRef.current) fillTerrainRect(rectFrom(dragStartRef.current, isoTile(e)));
              dragStartRef.current = null;
              setDragRect(null);
              setPainting(false);
              moveRef.current = null;
            }}
            onPointerLeave={() => {
              panRef.current = null;
              dragStartRef.current = null;
              setDragRect(null);
              setPainting(false);
              moveRef.current = null;
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
            <g>
              {(() => {
                const objs: { d: number; el: JSX.Element }[] = [];
                for (let y = 0; y < dims.h; y++)
                  for (let x = 0; x < dims.w; x++) {
                    const ov = terrainOverlay(tileAt(scene, x, y), x, y, dims);
                    if (ov) objs.push({ d: ov.d, el: <g key={`ov${x}-${y}`} dangerouslySetInnerHTML={{ __html: ov.html }} /> });
                  }
                if (layers.buildings) for (const b of scene.buildings ?? []) objs.push(buildingObj(b, dims, false, false)); // aperçu de jour ; le jour/nuit est runtime via l'horloge (#T1c)
                for (const e of scene.entities) {
                  if (e.kind === 'heroStart') {
                    const { cx, cy } = tileCenter(e.pos.x, e.pos.y, dims);
                    objs.push({
                      d: depth(e.pos.x, e.pos.y, dims) + 0.4,
                      el: (
                        <g key={e.id}>
                          <path d={diamondPath(e.pos.x, e.pos.y, dims)} fill="#2ecc71" opacity={0.55} />
                          <text x={cx} y={cy + TH / 4} textAnchor="middle" fontSize="13" fontWeight="bold" fill="#0a2a14">
                            H
                          </text>
                        </g>
                      ),
                    });
                  } else {
                    objs.push({ d: depth(e.pos.x, e.pos.y, dims) + 0.5, el: <EntityToken key={e.id} ent={e} dims={dims} /> });
                  }
                }
                // Ennemis des rencontres (points d'apparition) : visibles + cliquables.
                if (layers.spawns) for (const [encIdx, enc] of scene.encounters.entries()) {
                  enc.enemies.forEach((en, idx) => {
                    const isSel = selectedSpawn?.enc === encIdx && selectedSpawn?.idx === idx;
                    const synth = { id: `spawn-${encIdx}-${idx}`, kind: 'personnage', ref: en.ref, pos: en.pos, appearance: en.appearance, weapon: en.weapon } as SceneEntity;
                    objs.push({
                      d: depth(en.pos.x, en.pos.y, dims) + 0.45,
                      el: (
                        <g
                          key={`spawn-${encIdx}-${idx}`}
                          style={{ cursor: 'pointer' }}
                          onPointerDown={(ev) => {
                            ev.stopPropagation();
                            selectSpawn(encIdx, idx);
                          }}
                        >
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
            <g>
              {scene.triggers.map((t) => {
                const isSel = t.id === selectedTrigger;
                return (
                  <g
                    key={`tr-${t.id}`}
                    style={{ cursor: 'pointer' }}
                    onPointerDown={(e) => {
                      e.stopPropagation(); // sélectionner la zone plutôt que peindre dessous
                      selectTrigger(t.id);
                    }}
                  >
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
            {sel && footprintTiles(sel.pos, entitySize(sel)).map((t) => (
              <path key={`fp-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims)} fill="none" stroke="#ffe066" strokeWidth={3} />
            ))}
            {selB && (
              <g>
                {perimeterTiles(selB).map((t) => (
                  <path key={`selb-${t.x}-${t.y}`} d={diamondPath(t.x, t.y, dims)} fill="none" stroke="#ffe066" strokeWidth={2} opacity={0.8} />
                ))}
              </g>
            )}
            {dragRect && (
              <g>
                {Array.from({ length: dragRect.w * dragRect.h }, (_, i) => {
                  const x = dragRect.x + (i % dragRect.w);
                  const y = dragRect.y + Math.floor(i / dragRect.w);
                  return <path key={`dr-${i}`} d={diamondPath(x, y, dims)} fill="rgba(78,195,224,0.35)" stroke="#4ec3e0" strokeWidth={1.5} />;
                })}
              </g>
            )}
          </svg>
            <ViewControls
              zoom={view.zoom}
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

        <Inspector
          scene={scene}
          otherScenes={otherScenes}
          setScene={setScene}
          enemyCreatures={enemyCreatures}
          sel={sel}
          selected={selected}
          updateSel={updateSel}
          duplicateSel={duplicateSel}
          onSelectEntity={(id) => { setSelected(id); setSelectedTrigger(null); setSelectedSpawn(null); setSelectedBuilding(null); }}
          onDeselectEntity={() => setSelected(null)}
          selT={selT}
          updateSelT={updateSelT}
          updateSelTRect={updateSelTRect}
          onDeselectTrigger={() => setSelectedTrigger(null)}
          openTriggers={() => setTrigOpen(true)}
          spawn={spawn}
          selectedSpawn={selectedSpawn}
          updateSpawn={updateSpawn}
          deleteSpawn={deleteSpawn}
          onDeselectSpawn={() => setSelectedSpawn(null)}
          selB={selB}
          updateSelB={updateSelB}
          updateSelBParam={updateSelBParam}
          onDeselectBuilding={() => setSelectedBuilding(null)}
          onSelectBuilding={(id) => setSelectedBuilding(id)}
        />

        {drawer && <div className="editor-drawer-backdrop" onClick={() => setDrawer(null)} />}
        <div className="editor-mobile-bar">
          <button className={`btn${drawer === 'palette' ? ' btn-primary' : ''}`} onClick={() => setDrawer(drawer === 'palette' ? null : 'palette')}>
            🗺️ Palette
          </button>
          <button className={`btn${drawer === 'inspector' ? ' btn-primary' : ''}`} onClick={() => setDrawer(drawer === 'inspector' ? null : 'inspector')}>
            🔍 Inspecteur
          </button>
        </div>
      </div>

      {trigOpen && (
        <TriggersEditor
          triggers={scene.triggers}
          encounters={scene.encounters}
          dialogues={scene.dialogues}
          ctxExtra={effectCtxOf(scene, otherScenes)}
          onSave={(t) => setScene({ ...scene, triggers: t })}
          onClose={() => setTrigOpen(false)}
        />
      )}

      {dlgOpen && (
        <DialogueEditor
          dialogues={scene.dialogues}
          encounters={scene.encounters}
          ctxExtra={effectCtxOf(scene, otherScenes)}
          onSave={(d) => setScene({ ...scene, dialogues: d })}
          onClose={() => setDlgOpen(false)}
        />
      )}

      {encOpen && (
        <EncountersEditor
          encounters={scene.encounters}
          creatures={enemyCreatures}
          dialogues={scene.dialogues}
          ctxExtra={effectCtxOf(scene, otherScenes)}
          onSave={(e) => setScene({ ...scene, encounters: e })}
          onClose={() => setEncOpen(false)}
        />
      )}

      {worldOpen && (
        <WorldMapEditor
          map={worldMap}
          setMap={setWorldMap}
          scenes={[scene, ...otherScenes]}
          onClose={() => setWorldOpen(false)}
        />
      )}

      {openOpen && (
        <OpenProjectModal onScenario={loadScenario} onProject={loadSaved} onClose={() => setOpenOpen(false)} />
      )}

      {saveOpen && (
        <SaveProjectModal
          initialName={projectName}
          initialPublished={published}
          scenes={[scene, ...otherScenes]}
          initialStartId={scene.id}
          onSave={saveProject}
          onClose={() => setSaveOpen(false)}
        />
      )}

      {advOpen && (
        <div className="modal-overlay" onClick={() => setAdvOpen(false)}>
          <div role="dialog" aria-modal="true" className="modal wide" onClick={(e) => e.stopPropagation()}>
            <h3>Dialogues, Triggers & Combats</h3>
            <p className="hint">Édition JSON avancée (le format est celui du schéma de Scène). C'est ainsi que sont définies les conversations et l'embuscade.</p>
            <textarea className="json-editor" value={advText} onChange={(e) => setAdvText(e.target.value)} />
            <div className="modal-actions">
              <button className="btn" onClick={() => setAdvOpen(false)}>
                Annuler
              </button>
              <button className="btn btn-primary" onClick={saveAdvanced}>
                Appliquer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
