import { useRef, useState, useEffect, useMemo } from 'react';
import { useGame } from '../../state/store';
import { Scene, emptyScene, Terrain, tileAt, heightAt } from '../../state/scene';
import { validateScene, type Warning } from '../../state/validateScene';
import { testScene } from '../../scenes/test-fixture';
import { creatures } from '../../data';
import { useSceneHistory } from './useSceneHistory';
import { useEditorView } from './useEditorView';
import { EditorToolbar } from './EditorToolbar';
import { EditorCanvas } from './EditorCanvas';
import { StatusBar } from './StatusBar';
import { Palette } from './Palette';
import { Inspector } from './Inspector';
import { LogicDock, LogicTab } from './LogicDock';
import { WorldMapEditor } from './WorldMapEditor';
import { NarratifEditor } from './NarratifEditor';
import { OpenProjectModal, SaveProjectModal } from './ProjectModals';
import { projectSave, SavedProject } from '../../state/projectLibrary';
import { downloadText } from '../../state/fileIo';
import type { TestScenario } from '../../scenes/test-scenarios';
import type { BuiltinCampaign } from '../../scenes/campaign';
import { WorldMap, parseProject, CURRENT_PROJECT_SCHEMA, type ProjectMeta } from '../../state/worldMap';
import { type NarratifBlock, emptyNarratif } from '../../state/campaignNarratif';
import { nextEntityId } from '../../state/entityId';
import {
  Tool, Sel, Pt, Layers, DEFAULT_LAYERS, deleteSel, moveSel, selPos, pasteEntity, addLayer, removeLayer,
  addArchitectureBody, addArchitecturePart, addRoofSection,
} from './editorState';
import { Icon } from '../Icon';
import { Modal } from '../Modal';

export function architectureSelectionForWarning(warning: Warning): Warning['architectureRef'] | null {
  return warning.scope === 'architecture' ? warning.architectureRef ?? null : null;
}

/**
 * Éditeur de niveau v2 — SHELL d'orchestration : toolbar (Fichier/scènes/Tester), Palette
 * (rail d'outils), canvas WYSIWYG, Inspecteur DOCKÉ, barre de statut et PANNEAU LOGIQUE
 * (triggers/dialogues/rencontres/validation — fini les modales). Toute édition passe par
 * `setScene` (useSceneHistory) → UN SEUL historique d'undo. La sélection est UNIFIÉE (`Sel`)
 * et synchronisée carte ⇄ inspecteur ⇄ dock.
 */
export function Editor({
  initialScene,
  onSceneChange,
}: {
  initialScene?: Scene;
  onSceneChange?: (scene: Scene) => void;
} = {}) {
  const setScreen = useGame((s) => s.setScreen);
  const loadProject = useGame((s) => s.loadProject);
  const party = useGame((s) => s.party);

  const { scene, setScene, setSceneNoHistory, pushSnapshot, undo, redo, resetScene, canUndo, canRedo } = useSceneHistory(() => clone(initialScene ?? testScene));
  const [tool, setTool] = useState<Tool>({ mode: 'select' });
  const [architectureMode, setArchitectureMode] = useState(false);
  const [architectureBodyId, setArchitectureBodyId] = useState<string | null>(null);
  const [architectureStoreyId, setArchitectureStoreyId] = useState<string | null>(null);
  const [architectureAction, setArchitectureAction] = useState<'select' | 'facade'>('select');
  const [sel, setSel] = useState<Sel>(null);
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [brush, setBrush] = useState(1); // taille de pinceau terrain (1/3/5)
  const [currentLayer, setCurrentLayer] = useState(0); // couche (z) en cours d'édition (multi-niveaux)
  const [terrainRect, setTerrainRect] = useState(false); // pinceau terrain en mode Rectangle
  const [encTarget, setEncTarget] = useState(''); // rencontre cible de l'outil de placement d'ennemis
  const [encRef, setEncRef] = useState(''); // créature à placer
  const [clip, setClip] = useState<Scene['entities'][number] | null>(null); // presse-papier (Ctrl+C/V)
  const hoverRef = useRef<Pt>({ x: 0, y: 0 }); // dernière case survolée (cible de Ctrl+V)
  const [hover, setHover] = useState<Pt | null>(null); // barre de statut

  // --- Projet multi-scènes + métadonnées ---
  const [otherScenes, setOtherScenes] = useState<Scene[]>([]);
  const [worldMap, setWorldMap] = useState<WorldMap | null>(null);
  /** Axes de forces/faiblesses ACTIFS de la campagne (#409) — `undefined` = socle de base. */
  const [activeAxes, setActiveAxes] = useState<string[] | undefined>(undefined);
  /** Bloc NARRATIF du paquet de campagne (#765) — affaires/indices/PNJ/objets, préservé au round-trip. */
  const [narratif, setNarratif] = useState<NarratifBlock>(emptyNarratif());
  /** Identité de campagne (#765/#766) — préservée au round-trip, absente d'un projet legacy sans identité. */
  const [meta, setMeta] = useState<ProjectMeta | undefined>(undefined);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('La Diligence');
  const [published, setPublished] = useState(false);

  // --- Panneau Logique (dock bas) ---
  const [dockTab, setDockTab] = useState<LogicTab>('triggers');
  const [dockOpen, setDockOpen] = useState(false);
  const [dockH, setDockH] = useState(300);
  const [dlgSel, setDlgSel] = useState<string | null>(null);
  const [encSel, setEncSel] = useState<string | null>(null);
  const openLogic = (tab: LogicTab, id?: string) => {
    setDockTab(tab);
    setDockOpen(true);
    if (tab === 'dialogues' && id) setDlgSel(id);
    if (tab === 'encounters' && id) setEncSel(id);
    if (tab === 'triggers' && id) setSel({ type: 'trigger', id });
  };

  // --- Modales restantes (fichiers/monde/JSON — jamais pour ÉDITER la scène) ---
  const [openOpen, setOpenOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [worldOpen, setWorldOpen] = useState(false);
  const [narratifOpen, setNarratifOpen] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [advText, setAdvText] = useState('');
  const [drawer, setDrawer] = useState<null | 'palette' | 'inspector'>(null); // tiroirs tactiles (≤900px)

  const view = useEditorView();
  const enemyCreatures = creatures.filter((c) => typeof c.char.B === 'number');

  function clone(s: Scene): Scene {
    return JSON.parse(JSON.stringify(s));
  }

  useEffect(() => {
    onSceneChange?.(scene);
  }, [scene, onSceneChange]);

  const architectureBody = scene.architecture?.find((body) => body.id === architectureBodyId) ?? scene.architecture?.[0] ?? null;
  const architectureStorey = architectureBody?.storeys.find((storey) => storey.id === architectureStoreyId) ?? architectureBody?.storeys[0] ?? null;

  function selectMapTool(next: Tool) {
    setArchitectureMode(false);
    setArchitectureAction('select');
    setTool(next);
  }

  function enterArchitectureMode() {
    setTool({ mode: 'select' });
    setArchitectureMode(true);
    setArchitectureAction('select');
    if (architectureBody) {
      setArchitectureBodyId(architectureBody.id);
      setArchitectureStoreyId(architectureStorey?.id ?? null);
      if (architectureStorey && scene.layers.some((layer) => layer.z === architectureStorey.z)) {
        setCurrentLayer(architectureStorey.z);
      }
    }
  }

  function selectArchitectureBody(id: string) {
    const body = scene.architecture?.find((candidate) => candidate.id === id);
    setArchitectureBodyId(id);
    setArchitectureStoreyId(body?.storeys[0]?.id ?? null);
    if (body?.storeys[0] && scene.layers.some((layer) => layer.z === body.storeys[0].z)) {
      setCurrentLayer(body.storeys[0].z);
    }
    setArchitectureAction('select');
  }

  function selectArchitectureStorey(id: string) {
    const storey = architectureBody?.storeys.find((candidate) => candidate.id === id);
    setArchitectureStoreyId(id);
    if (storey && scene.layers.some((layer) => layer.z === storey.z)) setCurrentLayer(storey.z);
    setArchitectureAction('select');
  }

  function createArchitectureBody() {
    const out = addArchitectureBody(scene, 'maison');
    setScene(out.scene);
    setArchitectureBodyId(out.id);
    setArchitectureStoreyId('z0');
    setArchitectureAction('select');
  }

  function updateArchitectureBody(patch: Partial<Pick<NonNullable<Scene['architecture']>[number], 'label' | 'style'>>) {
    if (!architectureBody) return;
    setScene({
      ...scene,
      architecture: scene.architecture?.map((body) => body.id === architectureBody.id ? { ...body, ...patch } : body),
    });
  }

  function createArchitecturePart() {
    if (!architectureBody || !architectureStorey) return;
    const out = addArchitecturePart(scene, architectureBody.id, architectureStorey.id, { x: 0, y: 0, w: 1, h: 1 });
    if (!out) return;
    setScene(out.scene);
    setSel({ type: 'architecturePart', bodyId: architectureBody.id, storeyId: architectureStorey.id, id: out.id });
  }

  function createRoofSection() {
    if (!architectureBody || !architectureStorey) return;
    const out = addRoofSection(scene, architectureBody.id, { x: 0, y: 0, w: 1, h: 1 }, architectureStorey.z);
    if (!out) return;
    setScene(out.scene);
    setSel({ type: 'roofSection', bodyId: architectureBody.id, id: out.id });
  }

  /** Sélection depuis le CANVAS : un trigger ouvre aussi son détail dans le dock Logique. */
  function selectFromCanvas(s: Sel) {
    setSel(s);
    if (s?.type === 'trigger') {
      setDockTab('triggers');
      setDockOpen(true);
    }
  }
  const onHover = (p: Pt) => {
    hoverRef.current = p;
    setHover((h) => (h && h.x === p.x && h.y === p.y ? h : p));
  };

  // --- Projet multi-scènes : la scène éditée (avec historique) + les autres en réserve. ---
  function switchScene(id: string) {
    if (id === scene.id) return;
    const target = otherScenes.find((s) => s.id === id);
    if (!target) return;
    setOtherScenes([...otherScenes.filter((s) => s.id !== id), scene]); // ranger l'active, sortir la cible
    setSel(null);
    resetScene(target);
  }
  function addScene() {
    const s = emptyScene();
    s.id = `scene-${Date.now().toString(36)}`;
    s.nom = 'Nouvelle scène';
    setOtherScenes([...otherScenes, scene]);
    setSel(null);
    resetScene(s);
  }
  function duplicateScene() {
    const dup = clone(scene);
    dup.id = nextEntityId(scene.id, [scene.id, ...otherScenes.map((s) => s.id)]);
    dup.nom = `${scene.nom || scene.id} (copie)`;
    setOtherScenes([...otherScenes, scene]);
    setSel(null);
    resetScene(dup);
  }
  function deleteScene() {
    if (otherScenes.length === 0) return; // ne pas supprimer la dernière scène
    const [next, ...rest] = otherScenes;
    setOtherScenes(rest);
    setSel(null);
    resetScene(next);
  }

  // Raccourcis clavier (hors champ de saisie) : undo/redo, copier/coller/dupliquer,
  // Suppr (tout type sélectionné), flèches (nudge), Échap (désélection).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (e.ctrlKey || e.metaKey) {
        if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
        else if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); }
        else if (k === 'c' && sel?.type === 'entity') {
          const ent = scene.entities.find((x) => x.id === sel.id);
          if (ent) { e.preventDefault(); setClip(JSON.parse(JSON.stringify(ent))); }
        } else if (k === 'v' && clip) {
          e.preventDefault();
          const out = pasteEntity(scene, clip, hoverRef.current);
          setScene(out.scene);
          setSel({ type: 'entity', id: out.id });
        } else if (k === 'd' && sel?.type === 'entity') {
          const ent = scene.entities.find((x) => x.id === sel.id);
          if (ent) {
            e.preventDefault();
            const { w, h } = scene.dimensions;
            const out = pasteEntity(scene, ent, { x: Math.min(w - 1, ent.pos.x + 1), y: Math.min(h - 1, ent.pos.y + 1) });
            setScene(out.scene);
            setSel({ type: 'entity', id: out.id });
          }
        }
        return;
      }
      if (e.key === 'Escape') { setSel(null); return; }
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
        e.preventDefault();
        setScene(deleteSel(scene, sel));
        setSel(null);
        return;
      }
      const d: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (sel && d[e.key]) {
        const p = selPos(scene, sel);
        if (p) {
          e.preventDefault();
          setScene(moveSel(scene, sel, { x: p.x + d[e.key][0], y: p.y + d[e.key][1] }));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [scene, sel, clip, undo, redo, setScene]);

  // Avertissements de LA scène éditée + ceux de la carte du monde.
  const warnings = useMemo(
    () => validateScene([scene, ...otherScenes], worldMap)
      .filter((w) => w.scope !== 'roof' && (w.sceneId === scene.id || w.scope === 'worldMap')),
    [scene, otherScenes, worldMap],
  );
  /** Clic sur un avertissement → sélectionne/ouvre le fautif. */
  function selectWarning(w: Warning) {
    if (w.scope === 'dialogue') return openLogic('dialogues', w.refId);
    if (w.scope === 'encounter') return openLogic('encounters', w.refId);
    const architectureSel = architectureSelectionForWarning(w);
    if (architectureSel) {
      const bodyId = architectureSel.type === 'architectureBody' ? architectureSel.id : architectureSel.bodyId;
      const body = scene.architecture?.find((candidate) => candidate.id === bodyId);
      const storeyId = architectureSel.type === 'architectureStorey'
        ? architectureSel.id
        : architectureSel.type === 'architecturePart'
          ? architectureSel.storeyId
          : undefined;
      const z = storeyId !== undefined
        ? body?.storeys.find((storey) => storey.id === storeyId)?.z
        : architectureSel.type === 'facadeSection'
          ? body?.facades.find((facade) => facade.id === architectureSel.id)?.z
          : architectureSel.type === 'roofSection'
            ? body?.roofs.find((roof) => roof.id === architectureSel.id)?.z
            : undefined;
      setArchitectureMode(true);
      setArchitectureBodyId(bodyId);
      if (storeyId !== undefined) setArchitectureStoreyId(storeyId);
      else if (z !== undefined) setArchitectureStoreyId(body?.storeys.find((storey) => storey.z === z)?.id ?? null);
      else setArchitectureStoreyId(body?.storeys[0]?.id ?? null);
      if (z !== undefined && scene.layers.some((layer) => layer.z === z)) setCurrentLayer(z);
      setTool({ mode: 'select' });
      setArchitectureAction('select');
      setSel(architectureSel);
      return;
    }
    if (!w.refId) return;
    if (w.scope === 'entity') setSel({ type: 'entity', id: w.refId });
    else if (w.scope === 'trigger') selectFromCanvas({ type: 'trigger', id: w.refId });
  }

  // --- Fichier : import/export/bibliothèque/test ---
  function exportJson() {
    // Exporte le PROJET v2 (scènes + carte du monde) ; la première scène est l'entrée.
    const project = { schema: CURRENT_PROJECT_SCHEMA, scenes: [scene, ...otherScenes], ...(worldMap ? { worldMap } : {}), ...(activeAxes ? { activeAxes } : {}), narratif, ...(meta ? { meta } : {}) };
    downloadText(`${scene.id}-projet.json`, JSON.stringify(project, null, 2));
  }
  function importJson(file: File) {
    file.text().then((txt) => {
      try {
        const data = JSON.parse(txt);
        const { scenes, worldMap: wm, activeAxes: aa, narratif: na, meta: ma } = parseProject(data); // paquet ({ schema: 3, scenes, worldMap?, activeAxes?, narratif, meta? })
        if (!scenes.length) return;
        setOtherScenes(scenes.slice(1).map(clone));
        setWorldMap(wm ?? null);
        setActiveAxes(aa);
        setNarratif(na);
        setMeta(ma);
        setSel(null);
        resetScene(clone(scenes[0]));
      } catch {
        alert('JSON invalide');
      }
    });
  }
  function test() {
    if (party.length === 0) {
      alert("Ajoutez d'abord au moins un aventurier au groupe (menu Nouvelle partie) pour tester.");
      return;
    }
    loadProject([scene, ...otherScenes], scene.id, worldMap, narratif);
    setScreen('campaign');
  }
  function loadScenario(sc: TestScenario) {
    setOtherScenes((sc.extraScenes ?? []).map(clone));
    setWorldMap(sc.worldMap ? JSON.parse(JSON.stringify(sc.worldMap)) : null);
    setActiveAxes(undefined);
    setNarratif(emptyNarratif());
    setMeta(undefined);
    setProjectId(null);
    setProjectName(sc.title);
    setPublished(false);
    setSel(null);
    resetScene(clone(sc.scene));
    setOpenOpen(false);
  }
  /** Ouvrir une campagne BUILT-IN (Arène ou campagne du jeu) : jamais en édition directe du JSON
   *  commité — `projectId` reste `null`, donc « Enregistrer » crée un NOUVEAU projet localStorage
   *  (#367, même garantie que `loadScenario` pour les scénarios de test). */
  function loadBuiltin(bc: BuiltinCampaign) {
    const start = bc.scenes.find((s) => s.id === bc.startSceneId) ?? bc.scenes[0];
    const rest = bc.scenes.filter((s) => s.id !== start.id);
    setOtherScenes(rest.map(clone));
    setWorldMap(bc.worldMap ? JSON.parse(JSON.stringify(bc.worldMap)) : null);
    setActiveAxes(undefined);
    setNarratif(emptyNarratif());
    setMeta({ id: bc.id, label: bc.label, icon: bc.icon, version: 1 });
    setProjectId(null);
    setProjectName(`Copie de ${bc.label}`);
    setPublished(false);
    setSel(null);
    resetScene(clone(start));
    setOpenOpen(false);
  }
  function loadSaved(p: SavedProject) {
    let scenes: Scene[];
    let wm: WorldMap | undefined;
    let aa: string[] | undefined;
    let na: NarratifBlock;
    let ma: ProjectMeta | undefined;
    try {
      ({ scenes, worldMap: wm, activeAxes: aa, narratif: na, meta: ma } = parseProject(p.project)); // même validation/migration que l'import JSON
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Projet invalide');
      return;
    }
    if (!scenes.length) return;
    setOtherScenes(scenes.slice(1).map(clone));
    setWorldMap(wm ? JSON.parse(JSON.stringify(wm)) : null);
    setActiveAxes(aa);
    setNarratif(na);
    setMeta(ma);
    setProjectId(p.id);
    setProjectName(p.label);
    setPublished(p.published);
    setSel(null);
    resetScene(clone(scenes[0]));
    setOpenOpen(false);
  }
  function saveProject(name: string, pub: boolean, startSceneId: string) {
    const id = projectId ?? `proj-${Date.now().toString(36)}`;
    projectSave({
      id,
      label: name,
      startSceneId,
      savedAt: Date.now(),
      published: pub,
      project: { schema: CURRENT_PROJECT_SCHEMA, scenes: [scene, ...otherScenes], ...(worldMap ? { worldMap } : {}), ...(activeAxes ? { activeAxes } : {}), narratif, ...(meta ? { meta } : {}) },
    });
    setProjectId(id);
    setProjectName(name);
    setPublished(pub);
    setSaveOpen(false);
  }
  function newProject() {
    setOtherScenes([]);
    setWorldMap(null);
    setActiveAxes(undefined);
    setNarratif(emptyNarratif());
    setMeta(undefined);
    setProjectId(null);
    setProjectName('Nouveau projet');
    setPublished(false);
    setSel(null);
    resetScene(emptyScene());
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
    // Re-tisse chaque couche à la nouvelle taille : tuiles ET hauteurs métriques recopiées dans la zone
    // commune (le reste = défaut). Le tableau `height` n'est conservé que s'il porte une valeur ≠ 0.
    const layers = scene.layers.map((layer) => {
      const tiles: Terrain[] = new Array(w * h).fill('herbe');
      const height: number[] = new Array(w * h).fill(0);
      let hasHeight = false;
      for (let y = 0; y < Math.min(h, scene.dimensions.h); y++)
        for (let x = 0; x < Math.min(w, scene.dimensions.w); x++) {
          tiles[y * w + x] = tileAt(scene, x, y, layer.z);
          const hv = heightAt(scene, x, y, layer.z);
          if (hv) { height[y * w + x] = hv; hasHeight = true; }
        }
      return { z: layer.z, tiles, ...(hasHeight ? { height } : {}) };
    });
    setScene({ ...scene, dimensions: { w, h }, layers });
  }

  const { w, h } = scene.dimensions;
  const hoverIn = hover && hover.x >= 0 && hover.y >= 0 && hover.x < w && hover.y < h ? hover : null;

  return (
    <div className="screen editor-screen">
      <EditorToolbar
        onBack={() => setScreen('menu')}
        projectName={projectName}
        onNew={newProject}
        onOpen={() => setOpenOpen(true)}
        onSave={() => setSaveOpen(true)}
        onImport={importJson}
        onExport={exportJson}
        onAdvanced={openAdvanced}
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        scenes={[scene, ...otherScenes]}
        activeId={scene.id}
        onSwitchScene={switchScene}
        onAddScene={addScene}
        onDuplicateScene={duplicateScene}
        onDeleteScene={deleteScene}
        worldCount={worldMap ? worldMap.places.length : null}
        onWorld={() => setWorldOpen(true)}
        narratifCount={narratif.affaires.length + narratif.indices.length + narratif.presetsPnj.length + narratif.objets.length}
        onNarratif={() => setNarratifOpen(true)}
        onTest={test}
      />

      <div className={`editor-main${drawer ? ` drawer-${drawer}` : ''}`}>
        <Palette
          scene={scene}
          tool={tool}
          setTool={selectMapTool}
          brush={brush}
          setBrush={setBrush}
          terrainRect={terrainRect}
          setTerrainRect={setTerrainRect}
          encTarget={encTarget}
          setEncTarget={setEncTarget}
          encRef={encRef}
          setEncRef={setEncRef}
          enemyCreatures={enemyCreatures}
          architectureMode={architectureMode}
          architectureBodyId={architectureBody?.id ?? null}
          architectureStoreyId={architectureStorey?.id ?? null}
          architectureAction={architectureAction}
          onArchitectureMode={enterArchitectureMode}
          onArchitectureBody={selectArchitectureBody}
          onArchitectureStorey={selectArchitectureStorey}
          onAddArchitectureBody={createArchitectureBody}
          onUpdateArchitectureBody={updateArchitectureBody}
          onAddArchitecturePart={createArchitecturePart}
          onAddRoofSection={createRoofSection}
          onArmFacade={() => setArchitectureAction('facade')}
        />

        {/* Colonne centrale de la grille (1 enfant par colonne, sinon la grille 3 colonnes déborde en
            ligne implicite et s'effondre) : le canvas + la barre d'étages en OVERLAY ancré dessus. */}
        <div className="editor-canvas-col">
        <EditorCanvas
          scene={scene}
          view={view}
          setScene={setScene}
          setSceneNoHistory={setSceneNoHistory}
          pushSnapshot={pushSnapshot}
          tool={tool}
          brush={brush}
          terrainRect={terrainRect}
          encTarget={encTarget}
          setEncTarget={setEncTarget}
          encRef={encRef || enemyCreatures[0]?.id || 'mutant'}
          layers={layers}
          sel={sel}
          onSelect={selectFromCanvas}
          onHover={onHover}
          currentLayer={currentLayer}
          architectureMode={architectureMode}
          architectureBodyId={architectureBody?.id ?? null}
          architectureZ={architectureStorey?.z ?? null}
          architectureAction={architectureAction}
          onArchitectureActionComplete={() => setArchitectureAction('select')}
        />

        <div className="ed-level-bar" title="Couches (multi-niveaux) : z=0 = base, z>0 = surplombs (loges/galeries/passerelles)">
          <span className="ed-level-z">Couche {currentLayer}</span>
          <button
            className="btn small"
            disabled={!scene.layers.some((l) => l.z < currentLayer)}
            title="Couche inférieure"
            onClick={() => setCurrentLayer(Math.max(...scene.layers.filter((l) => l.z < currentLayer).map((l) => l.z)))}
          >
            ▼
          </button>
          <button
            className="btn small"
            disabled={!scene.layers.some((l) => l.z > currentLayer)}
            title="Couche supérieure"
            onClick={() => setCurrentLayer(Math.min(...scene.layers.filter((l) => l.z > currentLayer).map((l) => l.z)))}
          >
            ▲
          </button>
          <button
            className="btn small"
            title="Ajouter une couche au-dessus"
            onClick={() => {
              const z = Math.max(...scene.layers.map((l) => l.z)) + 1;
              setScene(addLayer(scene, z));
              setCurrentLayer(z);
            }}
          >
            ＋
          </button>
          <button
            className="btn small danger"
            disabled={currentLayer === 0}
            title="Supprimer cette couche"
            onClick={() => {
              setScene(removeLayer(scene, currentLayer));
              setCurrentLayer(0);
            }}
          >
            －
          </button>
        </div>
        </div>

        <Inspector
          scene={scene}
          otherScenes={otherScenes}
          worldMap={worldMap}
          setScene={setScene}
          sel={sel}
          setSel={setSel}
          enemyCreatures={enemyCreatures}
          openLogic={openLogic}
          resizeScene={resize}
        />

        {drawer && <div className="editor-drawer-backdrop" onClick={() => setDrawer(null)} />}
      </div>

      <StatusBar
        hover={hoverIn}
        hoverTerrain={hoverIn ? tileAt(scene, hoverIn.x, hoverIn.y) : null}
        tool={tool}
        dims={scene.dimensions}
        layers={layers}
        setLayers={setLayers}
      />

      <LogicDock
        scene={scene}
        otherScenes={otherScenes}
        worldMap={worldMap}
        setScene={setScene}
        enemyCreatures={enemyCreatures}
        warnings={warnings}
        onSelectWarning={selectWarning}
        tab={dockTab}
        setTab={setDockTab}
        open={dockOpen}
        setOpen={setDockOpen}
        height={dockH}
        setHeight={setDockH}
        trigSel={sel?.type === 'trigger' ? sel.id : null}
        setTrigSel={(id) => setSel(id ? { type: 'trigger', id } : null)}
        dlgSel={dlgSel}
        setDlgSel={setDlgSel}
        encSel={encSel}
        setEncSel={setEncSel}
        onSelectEntity={(id) => { setSel({ type: 'entity', id }); setDrawer('inspector'); }}
      />

      <div className="editor-mobile-bar">
        <button className={`btn${drawer === 'palette' ? ' btn-primary' : ''}`} onClick={() => setDrawer(drawer === 'palette' ? null : 'palette')}>
          <Icon id="map-tool/paint" size="sm" /> Outils
        </button>
        <button className={`btn${drawer === 'inspector' ? ' btn-primary' : ''}`} onClick={() => setDrawer(drawer === 'inspector' ? null : 'inspector')}>
          <Icon id="ui/search" size="sm" /> Inspecteur
        </button>
      </div>

      {worldOpen && (
        <WorldMapEditor map={worldMap} setMap={setWorldMap} scenes={[scene, ...otherScenes]} onClose={() => setWorldOpen(false)} activeAxes={activeAxes} setActiveAxes={setActiveAxes} />
      )}
      {narratifOpen && (
        <NarratifEditor narratif={narratif} onChange={setNarratif} onClose={() => setNarratifOpen(false)} />
      )}
      {openOpen && (
        <OpenProjectModal onScenario={loadScenario} onProject={loadSaved} onBuiltin={loadBuiltin} onClose={() => setOpenOpen(false)} />
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
        <Modal
          variant="plain"
          className="wide"
          title="Avancé — JSON de la scène (dialogues, triggers, rencontres)"
          onClose={() => setAdvOpen(false)}
          backdropClose
        >
          <p className="hint">Filet de sécurité pour l'édition en masse ; le format est celui du schéma de Scène.</p>
          <textarea className="json-editor" value={advText} onChange={(e) => setAdvText(e.target.value)} />
          <div className="modal-actions">
            <button className="btn" onClick={() => setAdvOpen(false)}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={saveAdvanced}>
              Appliquer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
