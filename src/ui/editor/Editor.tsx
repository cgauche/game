import { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useGame } from '../../state/store';
import { Scene, Terrain, SceneEntity, EntityKind, emptyScene, tileAt } from '../../state/scene';
import { nextEntityId } from '../../state/entityId';
import { MERCHANTS } from '../../state/merchants/index';
import type { Settlement } from '../../engine/disponibilite';
import { validateScene, type Warning } from '../../state/validateScene';
import { ValidationPanel } from './ValidationPanel';
import { EntityListPanel } from './EntityListPanel';
import { tome1Intro } from '../../scenes/tome1-intro';
import { creatures } from '../../data';
import { Dims, diamondPath, tileCenter, screenToTile, stageSize, depth, TH } from '../../gameIso/iso';
import { DEFS, placeSprite, terrainOverlay } from '../../gameIso/sprites';
import { hashSeed } from '../../gameIso/appearance';
import { SCENE_ANIMS } from '../../gameIso/sceneAnims';
import { MonsterPartsFields } from './MonsterPartsFields';
import { EntityToken } from '../../gameIso/EntityToken';
import { footprintTiles } from '../../state/footprint';
import { entitySize } from '../../state/spawn';
import { pickBackend } from '../../gameIso/pickBackend';
import { creatureSpeciesNames } from '../../gameIso/rig/creatures';
import { groundTile } from '../../gameIso/ground';
import { BUILDINGS, BUILDINGS_META } from '../../gameIso/catalog/buildings';
import { buildingObj } from '../../gameIso/BuildingSprite';
import { TERRAINS as TERRAIN_META } from '../../state/terrain';
import { TERRAIN_VIZ } from '../../gameIso/catalog/terrain';
import { perimeterTiles, defaultDoor } from '../../state/buildings';
import { PROPS } from '../../gameIso/catalog/decor';
import { BuildingFeature, Trigger, CustomStatblock, EncounterDef } from '../../state/scene';
import { ParamFields } from './ParamFields';
import { EffectList } from './EffectList';
import { propRefPatch } from './propDefaults';
import { ViewControls } from '../ViewControls';
import { TriggersEditor } from './TriggersEditor';
import { DialogueEditor } from './DialogueEditor';
import { EncountersEditor } from './EncountersEditor';
import { StatblockEditor, emptyStatblock } from './StatblockEditor';
const TERRAIN_IDS = Object.keys(TERRAIN_META);
const KINDS: EntityKind[] = ['heroStart', 'personnage', 'prop'];
const KIND_LABEL: Record<EntityKind, string> = {
  heroStart: 'Départ héros',
  personnage: 'Personnage',
  prop: 'Décor',
};

type Tool =
  | { mode: 'select' }
  | { mode: 'tile'; terrain: Terrain }
  | { mode: 'entity'; kind: EntityKind }
  | { mode: 'building'; type: string }
  | { mode: 'erase' }
  | { mode: 'trigger' }
  | { mode: 'encounter' };
type Rect = { x: number; y: number; w: number; h: number };

/**
 * Historique d'édition (annuler/rétablir) : chaque `setScene` empile un instantané
 * de la scène ; `resetScene` (Nouveau / Charger / Importer) vide l'historique.
 * Les instantanés sont des objets `Scene` complets (les éditions clonent déjà).
 */
function useSceneHistory(initial: Scene | (() => Scene)) {
  const [scene, setSceneState] = useState<Scene>(initial);
  const sceneRef = useRef(scene);
  sceneRef.current = scene; // toujours synchronisé, pour des callbacks stables
  const past = useRef<Scene[]>([]);
  const future = useRef<Scene[]>([]);

  const setScene = useCallback((next: Scene) => {
    past.current.push(sceneRef.current);
    if (past.current.length > 200) past.current.shift(); // borne mémoire
    future.current = [];
    setSceneState(next);
  }, []);
  /** Push manuel de l'état COURANT (avant un geste coalescé : peinture / glisser). */
  const pushSnapshot = useCallback(() => {
    past.current.push(sceneRef.current);
    if (past.current.length > 200) past.current.shift();
    future.current = [];
  }, []);
  /** Mutation SANS snapshot (pendant un geste) → 1 seul cran d'undo pour tout le geste. */
  const setSceneNoHistory = useCallback((next: Scene) => setSceneState(next), []);
  const undo = useCallback(() => {
    if (!past.current.length) return;
    future.current.push(sceneRef.current);
    setSceneState(past.current.pop()!);
  }, []);
  const redo = useCallback(() => {
    if (!future.current.length) return;
    past.current.push(sceneRef.current);
    setSceneState(future.current.pop()!);
  }, []);
  const resetScene = useCallback((s: Scene) => {
    past.current = [];
    future.current = [];
    setSceneState(s);
  }, []);

  return { scene, setScene, setSceneNoHistory, pushSnapshot, undo, redo, resetScene, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}

export function Editor() {
  const setScreen = useGame((s) => s.setScreen);
  const loadProject = useGame((s) => s.loadProject);
  const party = useGame((s) => s.party);

  const { scene, setScene, setSceneNoHistory, pushSnapshot, undo, redo, resetScene, canUndo, canRedo } = useSceneHistory(() => clone(tome1Intro));
  const [tool, setTool] = useState<Tool>({ mode: 'select' });
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [selectedSpawn, setSelectedSpawn] = useState<{ enc: number; idx: number } | null>(null);
  const [encTarget, setEncTarget] = useState<string>(''); // rencontre cible pour le placement
  const [encRef, setEncRef] = useState<string>(''); // créature à placer
  const [otherScenes, setOtherScenes] = useState<Scene[]>([]); // projet : scènes ≠ active
  const [painting, setPainting] = useState(false);
  const [clip, setClip] = useState<SceneEntity | null>(null); // presse-papier (copier/coller)
  const hoverRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 }); // dernière case survolée (cible de Ctrl+V)
  const [brush, setBrush] = useState(1); // taille de pinceau terrain (1/3/5)
  const [creatureFilter, setCreatureFilter] = useState(''); // recherche dans la palette créatures
  const [terrainRect, setTerrainRect] = useState(false); // pinceau terrain en mode Rectangle (drag → remplir)
  const [layers, setLayers] = useState({ triggers: true, spawns: true, buildings: true }); // calques masquables
  const [advOpen, setAdvOpen] = useState(false);
  const [advText, setAdvText] = useState('');
  const [trigOpen, setTrigOpen] = useState(false);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [encOpen, setEncOpen] = useState(false);
  const [palTab, setPalTab] = useState<'carte' | 'logique' | 'scene'>('carte');
  const [rot, setRot] = useState<0 | 1 | 2 | 3>(0); // rotation caméra éditeur (snap, local)
  // Zoom/pan ÉDITEUR via viewBox : `getScreenCTM` en tient compte → picking inchangé.
  const [view, setView] = useState({ zoom: 1, x: 0, y: 0 }); // x,y = origine viewBox (coords contenu)
  const spaceRef = useRef(false); // barre Espace maintenue → pan au glisser
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName) || ae.isContentEditable)) return;
      const k = e.key.toLowerCase(); // la LETTRE → Q/E étiquetées (AZERTY comme QWERTY)
      if (k === 'e') setRot((r) => (((r + 1) % 4) as 0 | 1 | 2 | 3));
      else if (k === 'q') setRot((r) => (((r + 3) % 4) as 0 | 1 | 2 | 3));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<Rect | null>(null);
  const canvasRef = useRef<SVGSVGElement>(null);

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

  const dims: Dims = { ...scene.dimensions, rot };
  const stage = stageSize(dims);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const ZE_MIN = 1,
    ZE_MAX = 6;
  // Zoom centré sur un point contenu (curseur pour la molette, centre pour les boutons).
  const zoomAt = (factor: number, ax?: number, ay?: number) =>
    setView((v) => {
      const nz = Math.min(ZE_MAX, Math.max(ZE_MIN, v.zoom * factor));
      const s = stageRef.current;
      const ovw = s.w / v.zoom,
        ovh = s.h / v.zoom;
      const nvw = s.w / nz,
        nvh = s.h / nz;
      const cx = ax ?? v.x + ovw / 2,
        cy = ay ?? v.y + ovh / 2;
      const fx = (cx - v.x) / ovw,
        fy = (cy - v.y) / ovh;
      return { zoom: nz, x: cx - fx * nvw, y: cy - fy * nvh };
    });
  // Molette = zoom ancré sur le curseur (listener non-passif pour preventDefault).
  useEffect(() => {
    const svg = canvasRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, loc.x, loc.y);
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, []);
  // Barre Espace maintenue → mode pan (au glisser).
  useEffect(() => {
    const d = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceRef.current = true;
    };
    const u = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceRef.current = false;
    };
    window.addEventListener('keydown', d);
    window.addEventListener('keyup', u);
    return () => {
      window.removeEventListener('keydown', d);
      window.removeEventListener('keyup', u);
    };
  }, []);

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
  function rectFrom(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
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
  const warnings = useMemo(() => validateScene([scene, ...otherScenes]).filter((w) => w.sceneId === scene.id), [scene, otherScenes]);
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
    // Exporte le PROJET (toutes les scènes) ; la première est la scène d'entrée.
    const project = [scene, ...otherScenes];
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
        const scenes: Scene[] = Array.isArray(data) ? data : [data]; // projet OU scène unique
        if (!scenes.length) return;
        setOtherScenes(scenes.slice(1));
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
    loadProject([scene, ...otherScenes], scene.id);
    setScreen('campaign');
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
          <button className="btn small" onClick={() => resetScene(clone(tome1Intro))}>
            Charger « La Diligence »
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
          <button className="btn small btn-primary" onClick={test}>
            ▶ Tester
          </button>
        </div>
      </header>

      <div className="editor-body">
        <aside className="editor-palette">
          <div className="pal-tabs">
            <button className={palTab === 'carte' ? 'active' : ''} onClick={() => setPalTab('carte')}>
              🗺️ Carte
            </button>
            <button className={palTab === 'logique' ? 'active' : ''} onClick={() => setPalTab('logique')}>
              ⚙️ Logique
            </button>
            <button className={palTab === 'scene' ? 'active' : ''} onClick={() => setPalTab('scene')}>
              📄 Scène
            </button>
          </div>

          {palTab === 'carte' && (
            <div className="pal-tab">
              <div className="mini-title">Calques</div>
              <div className="layer-toggles">
                {(['triggers', 'spawns', 'buildings'] as const).map((L) => (
                  <label key={L} className="ed-toggle">
                    <input type="checkbox" checked={layers[L]} onChange={(e) => setLayers((l) => ({ ...l, [L]: e.target.checked }))} /> {L === 'triggers' ? 'Zones' : L === 'spawns' ? 'Ennemis' : 'Bâtiments'}
                  </label>
                ))}
              </div>
              <div className="mini-title">Terrains</div>
              <div className="brush-sizes">
                Pinceau :{' '}
                {[1, 3, 5].map((n) => (
                  <button key={n} className={`btn small ${brush === n ? 'btn-primary' : ''}`} onClick={() => setBrush(n)}>
                    {n}×{n}
                  </button>
                ))}
                <label className="ed-toggle"> <input type="checkbox" checked={terrainRect} onChange={(e) => setTerrainRect(e.target.checked)} /> Rectangle</label>
              </div>
              <div className="terrain-palette">
                {TERRAIN_IDS.map((t) => (
                  <button
                    key={t}
                    className={`terrain-swatch ${tool.mode === 'tile' && tool.terrain === t ? 'active' : ''}`}
                    style={{ background: TERRAIN_VIZ[t]?.swatch ?? '#888' }}
                    onClick={() => setTool({ mode: 'tile', terrain: t })}
                    title={TERRAIN_META[t].label}
                  >
                    {TERRAIN_META[t].label}
                  </button>
                ))}
              </div>

              <button className={`btn small ${tool.mode === 'select' ? 'btn-primary' : ''}`} onClick={() => setTool({ mode: 'select' })}>
                ↖ Sélection / Déplacer
              </button>
              <div className="mini-title">Entités</div>
              <div className="entity-tools">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    className={`btn small ${tool.mode === 'entity' && tool.kind === k ? 'btn-primary' : ''}`}
                    onClick={() => setTool({ mode: 'entity', kind: k })}
                  >
                    {KIND_LABEL[k]}
                  </button>
                ))}
                <button className={`btn small danger ${tool.mode === 'erase' ? 'btn-primary' : ''}`} onClick={() => setTool({ mode: 'erase' })}>
                  Gomme
                </button>
              </div>

              <div className="mini-title">Bâtiments</div>
              <div className="entity-tools">
                {Object.values(BUILDINGS_META).map((b) => (
                  <button
                    key={b.id}
                    className={`btn small ${tool.mode === 'building' && tool.type === b.id ? 'btn-primary' : ''}`}
                    onClick={() => setTool({ mode: 'building', type: b.id })}
                    title={`${b.label} (${b.category}) — glisser pour définir l'empreinte`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              <div className="mini-title">Zones</div>
              <button
                className={`btn small ${tool.mode === 'trigger' ? 'btn-primary' : ''}`}
                onClick={() => setTool({ mode: 'trigger' })}
                title="Glisser sur la carte pour dessiner une zone de trigger"
              >
                🟦 Dessiner une zone (trigger)
              </button>

              <div className="mini-title">Rencontres (ennemis)</div>
              <div className="entity-tools">
                <select value={encTarget} onChange={(e) => setEncTarget(e.target.value)} title="Rencontre cible">
                  <option value="">Nouvelle rencontre…</option>
                  {scene.encounters.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.id} ({e.enemies.length})
                    </option>
                  ))}
                </select>
                <input className="ed-search" placeholder="🔎 filtrer créature…" value={creatureFilter} onChange={(e) => setCreatureFilter(e.target.value)} />
                <select value={encRef} onChange={(e) => setEncRef(e.target.value)} title="Créature à placer">
                  <option value="">{enemyCreatures[0]?.label ?? 'créature'}…</option>
                  {enemyCreatures
                    .filter((c) => c.label.toLowerCase().includes(creatureFilter.toLowerCase()))
                    .map((c) => (
                      <option key={c.label} value={c.label}>
                        {c.label}
                      </option>
                    ))}
                </select>
                <button
                  className={`btn small ${tool.mode === 'encounter' ? 'btn-primary' : ''}`}
                  onClick={() => setTool({ mode: 'encounter' })}
                  title="Cliquer sur la carte pour ajouter des ennemis à la rencontre cible"
                >
                  ⚔️ Placer des ennemis
                </button>
              </div>
            </div>
          )}

          {palTab === 'logique' && (
            <div className="pal-tab logic-buttons">
              <button className="btn btn-primary" onClick={() => setTrigOpen(true)}>
                🎯 Triggers &amp; effets ({scene.triggers.length})
              </button>
              <button className="btn btn-primary" onClick={() => setDlgOpen(true)}>
                💬 Dialogues ({scene.dialogues.length})
              </button>
              <button className="btn btn-primary" onClick={() => setEncOpen(true)}>
                ⚔️ Rencontres ({scene.encounters.length})
              </button>
              <button className="btn small" onClick={openAdvanced}>
                Avancé (JSON)
              </button>
              <div className="mini-title">Validation{warnings.length ? ` (${warnings.length})` : ''}</div>
              <ValidationPanel warnings={warnings} onSelect={selectWarning} />
            </div>
          )}

          {palTab === 'scene' && (
            <div className="pal-tab">
              <div className="mini-title">Scènes du projet</div>
              <div className="entity-tools">
                {[scene, ...otherScenes].map((s) => (
                  <div key={s.id} className="proj-scene-row">
                    <button
                      className={`btn small ${s.id === scene.id ? 'btn-primary' : ''}`}
                      onClick={() => switchScene(s.id)}
                      title={s.id}
                    >
                      {s.nom || s.id}
                    </button>
                    <button
                      className="btn small danger"
                      title="Retirer cette scène du projet"
                      onClick={() => deleteScene(s.id)}
                      disabled={s.id === scene.id && otherScenes.length === 0}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button className="btn small" onClick={addScene}>
                  + Nouvelle scène
                </button>
              </div>
              <label className="ed-field">
                Identifiant (référencé par les portes d'intérieur)
                <input value={scene.id} onChange={(e) => setScene({ ...scene, id: e.target.value })} />
              </label>
              <label className="ed-field">
                Nom
                <input value={scene.nom} onChange={(e) => setScene({ ...scene, nom: e.target.value })} />
              </label>
              <div className="ed-dim">
                <label>
                  L
                  <input type="number" value={scene.dimensions.w} min={5} max={40} onChange={(e) => resize(Number(e.target.value) || 5, scene.dimensions.h)} />
                </label>
                <label>
                  H
                  <input type="number" value={scene.dimensions.h} min={5} max={40} onChange={(e) => resize(scene.dimensions.w, Number(e.target.value) || 5)} />
                </label>
              </div>
              <label className="ed-field">
                Ambiance
                <select value={scene.ambiance === 'interieur' ? 'interieur' : 'exterieur'} onChange={(e) => setScene({ ...scene, ambiance: e.target.value as Scene['ambiance'] })}>
                  <option value="exterieur">Extérieur (jour/nuit = horloge)</option>
                  <option value="interieur">Intérieur (éclairé)</option>
                </select>
              </label>
              <label className="ed-field">
                Météo
                <select value={scene.weather ?? 'clair'} onChange={(e) => setScene({ ...scene, weather: e.target.value as Scene['weather'] })}>
                  <option value="clair">Clair</option>
                  <option value="pluie">Pluie</option>
                  <option value="brouillard">Brouillard (−20 tir)</option>
                  <option value="neige">Neige épaisse (−20 attaque/esquive)</option>
                  <option value="tempete">Tempête (−20 attaque)</option>
                </select>
              </label>
              <label className="ed-field">
                Message d'introduction
                <textarea value={scene.startMessage ?? ''} onChange={(e) => setScene({ ...scene, startMessage: e.target.value || undefined })} />
              </label>
            </div>
          )}
        </aside>

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
            />
          </div>
          <p className="hint">
            Peignez les tuiles (cliquer-glisser). Placez les entités. Les zones rouges en pointillés sont les triggers. Molette = zoom · clic-milieu/Espace = déplacer.
          </p>
        </main>

        <aside className="editor-inspector">
          {selT ? (
            <>
              <div className="mini-title">Zone trigger sélectionnée</div>
              <div className="inspector">
                <p>
                  <b>{selT.id}</b> @ ({selT.rect.x}, {selT.rect.y}) {selT.rect.w}×{selT.rect.h}
                </p>
                <label className="ed-field">
                  X (colonne)
                  <input type="number" value={selT.rect.x} onChange={(e) => updateSelTRect({ x: Number(e.target.value) })} />
                </label>
                <label className="ed-field">
                  Y (ligne)
                  <input type="number" value={selT.rect.y} onChange={(e) => updateSelTRect({ y: Number(e.target.value) })} />
                </label>
                <label className="ed-field">
                  Largeur
                  <input type="number" min={1} value={selT.rect.w} onChange={(e) => updateSelTRect({ w: Math.max(1, Number(e.target.value)) })} />
                </label>
                <label className="ed-field">
                  Hauteur
                  <input type="number" min={1} value={selT.rect.h} onChange={(e) => updateSelTRect({ h: Math.max(1, Number(e.target.value)) })} />
                </label>
                <label className="ed-field">
                  Condition (flag ; « ! » pour nié)
                  <input value={selT.condition ?? ''} onChange={(e) => updateSelT({ condition: e.target.value || undefined })} />
                </label>
                <label className="ed-field">
                  <input type="checkbox" checked={selT.once ?? false} onChange={(e) => updateSelT({ once: e.target.checked })} /> Une
                  seule fois
                </label>
                <button className="btn small" onClick={() => setTrigOpen(true)}>
                  Éditer les effets ({selT.effects.length})
                </button>
                <button
                  className="btn small danger"
                  onClick={() => {
                    setScene({ ...scene, triggers: scene.triggers.filter((x) => x.id !== selT.id) });
                    setSelectedTrigger(null);
                  }}
                >
                  Supprimer
                </button>
                <button className="btn small" onClick={() => setSelectedTrigger(null)}>
                  Désélectionner
                </button>
              </div>
            </>
          ) : spawn ? (
            <>
              <div className="mini-title">Ennemi de rencontre</div>
              <div className="inspector">
                <p>
                  <b>{scene.encounters[selectedSpawn!.enc].id}</b> · ennemi @ ({spawn.pos.x}, {spawn.pos.y})
                </p>
                {spawn.statblock ? (
                  <>
                    <StatblockEditor stat={spawn.statblock} onChange={(sb) => updateSpawn({ statblock: sb })} />
                    <button className="btn small" onClick={() => updateSpawn({ statblock: undefined })}>
                      ↩ Utiliser une créature du bestiaire
                    </button>
                  </>
                ) : (
                  <>
                    <label className="ed-field">
                      Créature
                      <select value={spawn.ref ?? ''} onChange={(e) => updateSpawn({ ref: e.target.value })}>
                        <option value="">— créature —</option>
                        {enemyCreatures.map((c) => (
                          <option key={c.label} value={c.label}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="btn small"
                      onClick={() => updateSpawn({ ref: undefined, statblock: emptyStatblock(spawn.ref || 'Ennemi') })}
                    >
                      ⚙️ Profil personnalisé…
                    </button>
                  </>
                )}
                <MonsterPartsFields
                  monster={spawn.appearance?.monster}
                  weapon={spawn.weapon}
                  colors={spawn.appearance?.colors}
                  sex={spawn.appearance?.sex}
                  build={spawn.appearance?.build}
                  parts={spawn.appearance?.parts}
                  career={spawn.appearance?.career}
                  onMonster={(patch) => updateSpawn({ appearance: { ...spawn.appearance, monster: { ...(spawn.appearance?.monster ?? {}), ...patch } } })}
                  onWeapon={(w) => updateSpawn({ weapon: w })}
                  onColors={(patch) => updateSpawn({ appearance: { ...spawn.appearance, colors: { ...(spawn.appearance?.colors ?? {}), ...patch } } })}
                  onSex={(s) => updateSpawn({ appearance: { ...spawn.appearance, sex: s } })}
                  onBuild={(b) => updateSpawn({ appearance: { ...spawn.appearance, build: b } })}
                  onParts={(patch) => updateSpawn({ appearance: { ...spawn.appearance, parts: { ...(spawn.appearance?.parts ?? {}), ...patch } } })}
                  onCareer={(c) => updateSpawn({ appearance: { ...spawn.appearance, career: c } })}
                />
                <label className="ed-field">
                  X<input type="number" value={spawn.pos.x} onChange={(e) => updateSpawn({ pos: { ...spawn.pos, x: Number(e.target.value) } })} />
                </label>
                <label className="ed-field">
                  Y<input type="number" value={spawn.pos.y} onChange={(e) => updateSpawn({ pos: { ...spawn.pos, y: Number(e.target.value) } })} />
                </label>
                <button className="btn small danger" onClick={deleteSpawn}>
                  Supprimer
                </button>
                <button className="btn small" onClick={() => setSelectedSpawn(null)}>
                  Désélectionner
                </button>
              </div>
            </>
          ) : selB ? (
            <>
              <div className="mini-title">Bâtiment sélectionné</div>
              <div className="inspector">
                <p>
                  <b>{BUILDINGS_META[selB.type]?.label ?? selB.type}</b> @ ({selB.foot.x}, {selB.foot.y}) {selB.foot.w}×{selB.foot.h}
                </p>
                <label className="ed-field">
                  Libellé
                  <input value={selB.label ?? ''} onChange={(e) => updateSelB({ label: e.target.value })} />
                </label>
                <label className="ed-field">
                  Orientation (place la porte)
                  <select
                    value={selB.facing ?? 'S'}
                    onChange={(e) => {
                      const f = e.target.value as BuildingFeature['facing'];
                      updateSelB({ facing: f, door: defaultDoor(selB.foot, f) });
                    }}
                  >
                    <option value="N">Nord</option>
                    <option value="E">Est</option>
                    <option value="S">Sud</option>
                    <option value="O">Ouest</option>
                  </select>
                </label>
                <label className="ed-field">
                  Révélation
                  <select value={selB.reveal} onChange={(e) => updateSelB({ reveal: e.target.value as BuildingFeature['reveal'] })}>
                    <option value="cutaway">Toit qui se lève (intérieur in-scene)</option>
                    <option value="door">Façade pleine + porte → intérieur</option>
                  </select>
                </label>
                <label className="ed-field">
                  Tuile-porte
                  <select
                    value={selB.door ? `${selB.door.x},${selB.door.y}` : ''}
                    onChange={(e) => {
                      const [x, y] = e.target.value.split(',').map(Number);
                      updateSelB({ door: { x, y } });
                    }}
                  >
                    {perimeterTiles(selB).map((t) => (
                      <option key={`${t.x},${t.y}`} value={`${t.x},${t.y}`}>
                        ({t.x}, {t.y})
                      </option>
                    ))}
                  </select>
                </label>
                {selB.reveal === 'door' && (
                  <>
                    <label className="ed-field">
                      Scène d'intérieur
                      <select value={selB.interiorScene ?? ''} onChange={(e) => updateSelB({ interiorScene: e.target.value || undefined })}>
                        <option value="">— aucune —</option>
                        {[scene, ...otherScenes].map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.nom || s.id} ({s.id})
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="ed-field">
                      Point d'arrivée (entry)
                      <input value={selB.entry ?? ''} onChange={(e) => updateSelB({ entry: e.target.value || undefined })} />
                    </label>
                  </>
                )}
                <ParamFields
                  schema={BUILDINGS[selB.type]?.paramsSchema ?? []}
                  values={(selB.params ?? {}) as Record<string, unknown>}
                  onChange={updateSelBParam}
                />
                <button
                  className="btn small danger"
                  onClick={() => {
                    setScene({ ...scene, buildings: (scene.buildings ?? []).filter((x) => x.id !== selB.id) });
                    setSelectedBuilding(null);
                  }}
                >
                  Supprimer
                </button>
                <button className="btn small" onClick={() => setSelectedBuilding(null)}>
                  Désélectionner
                </button>
              </div>
            </>
          ) : sel ? (
            <>
              <div className="mini-title">Entité sélectionnée</div>
              <div className="inspector">
                <div className="ent-preview">
                  <svg viewBox="0 0 120 150" width="84" height="105">
                    <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
                    {sel.kind === 'heroStart' ? (
                      <text x="60" y="92" textAnchor="middle" fontSize="44" fill="#2ecc71">
                        ★
                      </text>
                    ) : (
                      // Aperçu unifié via le MÊME classifieur que le canvas (pickBackend) :
                      // rig humanoïde / gabarit animé / sprite décor — plus aucun recours au monolithique.
                      pickBackend({ kind: 'sceneEntity', ent: sel }).body
                    )}
                  </svg>
                </div>
                <p>
                  <b>{KIND_LABEL[sel.kind]}</b> @ ({sel.pos.x}, {sel.pos.y})
                </p>
                <label className="ed-field">
                  Libellé
                  <input value={sel.label ?? ''} onChange={(e) => updateSel({ label: e.target.value })} />
                </label>
                <label className="ed-field">
                  Orientation
                  <select
                    value={sel.facing ?? 'S'}
                    onChange={(e) => updateSel({ facing: e.target.value as SceneEntity['facing'] })}
                  >
                    <option value="N">Nord</option>
                    <option value="NE">Nord-Est</option>
                    <option value="E">Est</option>
                    <option value="SE">Sud-Est</option>
                    <option value="S">Sud</option>
                    <option value="SO">Sud-Ouest</option>
                    <option value="O">Ouest</option>
                    <option value="NO">Nord-Ouest</option>
                  </select>
                </label>
                {sel.kind === 'personnage' && (
                  <>
                    <label className="ed-field">
                      Apparence
                      <select
                        value={sel.ref ?? 'Villageois'}
                        onChange={(e) => updateSel({ ref: e.target.value })}
                      >
                        <option value="Villageois">Villageois</option>
                        {creatureSpeciesNames().map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="ed-field">
                      Animation d'ambiance
                      <select value={sel.anim ?? ''} onChange={(e) => updateSel({ anim: e.target.value || undefined })}>
                        {SCENE_ANIMS.map((a) => (
                          <option key={a.key} value={a.key}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="ed-field">
                      <span>Apparence aléatoire</span>
                      <button
                        className="btn small"
                        onClick={() => updateSel({ appearance: { ...sel.appearance, seed: hashSeed(sel.id + ':' + Math.floor(performance.now())) } })}
                      >
                        🎲 Relancer
                      </button>
                    </div>
                    <MonsterPartsFields
                      monster={sel.appearance?.monster}
                      weapon={sel.weapon}
                      colors={sel.appearance?.colors}
                      sex={sel.appearance?.sex}
                      build={sel.appearance?.build}
                      parts={sel.appearance?.parts}
                      career={sel.appearance?.career}
                      onMonster={(patch) => updateSel({ appearance: { ...sel.appearance, monster: { ...(sel.appearance?.monster ?? {}), ...patch } } })}
                      onWeapon={(w) => updateSel({ weapon: w })}
                      onColors={(patch) => updateSel({ appearance: { ...sel.appearance, colors: { ...(sel.appearance?.colors ?? {}), ...patch } } })}
                      onSex={(s) => updateSel({ appearance: { ...sel.appearance, sex: s } })}
                      onBuild={(b) => updateSel({ appearance: { ...sel.appearance, build: b } })}
                      onParts={(patch) => updateSel({ appearance: { ...sel.appearance, parts: { ...(sel.appearance?.parts ?? {}), ...patch } } })}
                      onCareer={(c) => updateSel({ appearance: { ...sel.appearance, career: c } })}
                    />
                    <label className="ed-field">
                      Dialogue / quête
                      <select value={sel.dialogueId ?? ''} onChange={(e) => updateSel({ dialogueId: e.target.value || undefined })}>
                        <option value="">— aucun —</option>
                        {scene.dialogues.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.id}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="ed-field">
                      Marchand (archétype)
                      <select value={sel.merchant?.archetype ?? ''} onChange={(e) => updateSel({ merchant: e.target.value ? { ...sel.merchant, archetype: e.target.value } : undefined })}>
                        <option value="">— aucun —</option>
                        {Object.values(MERCHANTS).map((a) => (
                          <option key={a.name} value={a.name}>
                            {a.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {sel.merchant && (
                      <>
                        <label className="ed-field">
                          ↳ Bourg (override Disponibilité)
                          <select
                            value={sel.merchant.settlement ?? ''}
                            onChange={(e) => updateSel({ merchant: { ...sel.merchant!, settlement: (e.target.value || undefined) as Settlement | undefined } })}
                          >
                            <option value="">— défaut (archétype) —</option>
                            <option value="village">Village</option>
                            <option value="ville">Ville</option>
                            <option value="cite">Cité</option>
                          </select>
                        </label>
                        <label className="ed-field">
                          ↳ Taux de rachat (override, ex. 0.5 = ½)
                          <input
                            type="number"
                            step="0.05"
                            min="0"
                            max="1"
                            placeholder="défaut archétype"
                            value={sel.merchant.resaleRate ?? ''}
                            onChange={(e) => updateSel({ merchant: { ...sel.merchant!, resaleRate: e.target.value === '' ? undefined : Number(e.target.value) } })}
                          />
                        </label>
                      </>
                    )}
                  </>
                )}
                {sel.kind === 'prop' && (
                  <>
                    <label className="ed-field">
                      Décor
                      <select value={sel.ref ?? 'tonneau'} onChange={(e) => updateSel(propRefPatch(e.target.value, !!sel.interact))}>
                        {Object.values(PROPS).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="ed-field">
                      Empreinte (cases L×H) — couvre/bloque toutes ses cases (1×1 = aucune)
                      <span style={{ display: 'flex', gap: 4 }}>
                        <input
                          type="number"
                          min={1}
                          value={sel.foot?.w ?? 1}
                          onChange={(e) => {
                            const w = Math.max(1, Number(e.target.value));
                            const h = sel.foot?.h ?? 1;
                            updateSel({ foot: w > 1 || h > 1 ? { w, h } : undefined });
                          }}
                        />
                        <input
                          type="number"
                          min={1}
                          value={sel.foot?.h ?? 1}
                          onChange={(e) => {
                            const h = Math.max(1, Number(e.target.value));
                            const w = sel.foot?.w ?? 1;
                            updateSel({ foot: w > 1 || h > 1 ? { w, h } : undefined });
                          }}
                        />
                      </span>
                    </label>
                    <label className="ed-field">
                      <input
                        type="checkbox"
                        checked={!!sel.interact}
                        onChange={(e) => updateSel({ interact: e.target.checked ? (sel.interact ?? { effects: [] }) : undefined })}
                      />{' '}
                      Interactif (fouille / ramassage)
                    </label>
                    {sel.interact && (
                      <>
                        <label className="ed-field">
                          <input
                            type="checkbox"
                            checked={!!sel.interact.consume}
                            onChange={(e) => updateSel({ interact: { ...sel.interact!, consume: e.target.checked } })}
                          />{' '}
                          Disparaît quand pris (butin) — sinon reste, fouillé une fois
                        </label>
                        <div className="ed-field">
                          <span className="mini-title">Effets de la fouille / du ramassage</span>
                          <EffectList
                            effects={sel.interact.effects}
                            onChange={(eff) => updateSel({ interact: { ...sel.interact!, effects: eff } })}
                            ctx={{ encounters: scene.encounters, dialogues: scene.dialogues }}
                          />
                        </div>
                      </>
                    )}
                  </>
                )}
                <button className="btn small" onClick={duplicateSel}>Dupliquer</button>
                <button className="btn small danger" onClick={() => setScene({ ...scene, entities: scene.entities.filter((x) => x.id !== sel.id) })}>
                  Supprimer
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="mini-title">Inspecteur</div>
              <p className="hint">
                Sélectionnez une entité sur la carte pour l'éditer (créature, dialogue, butin…).
                <br />
                <br />
                Onglet <b>Carte</b> : peindre tuiles, placer entités, <b>glisser</b> pour poser un bâtiment ou une zone.
                <br />
                Onglet <b>Logique</b> : triggers, dialogues, rencontres.
                <br />
                Onglet <b>Scène</b> : nom, taille, ambiance.
              </p>
              {(scene.buildings ?? []).length > 0 && (
                <>
                  <div className="mini-title">Bâtiments posés</div>
                  <div className="entity-tools">
                    {(scene.buildings ?? []).map((b) => (
                      <button key={b.id} className="btn small" onClick={() => setSelectedBuilding(b.id)}>
                        {b.label ?? BUILDINGS_META[b.type]?.label ?? b.type} ({b.foot.x},{b.foot.y})
                      </button>
                    ))}
                  </div>
                </>
              )}
              <EntityListPanel
                entities={scene.entities}
                selectedId={selected}
                onSelect={(id) => { setSelected(id); setSelectedTrigger(null); setSelectedSpawn(null); setSelectedBuilding(null); }}
              />
            </>
          )}
        </aside>
      </div>

      {trigOpen && (
        <TriggersEditor
          triggers={scene.triggers}
          encounters={scene.encounters}
          dialogues={scene.dialogues}
          onSave={(t) => setScene({ ...scene, triggers: t })}
          onClose={() => setTrigOpen(false)}
        />
      )}

      {dlgOpen && (
        <DialogueEditor
          dialogues={scene.dialogues}
          encounters={scene.encounters}
          onSave={(d) => setScene({ ...scene, dialogues: d })}
          onClose={() => setDlgOpen(false)}
        />
      )}

      {encOpen && (
        <EncountersEditor
          encounters={scene.encounters}
          creatures={enemyCreatures}
          dialogues={scene.dialogues}
          onSave={(e) => setScene({ ...scene, encounters: e })}
          onClose={() => setEncOpen(false)}
        />
      )}

      {advOpen && (
        <div className="modal-overlay" onClick={() => setAdvOpen(false)}>
          <div className="modal wide" onClick={(e) => e.stopPropagation()}>
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

