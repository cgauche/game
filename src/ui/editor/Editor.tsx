import { useRef, useState, useEffect, useMemo } from 'react';
import { useGame } from '../../state/store';
import { Scene, emptyScene, Terrain, tileAt } from '../../state/scene';
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
import { OpenProjectModal, SaveProjectModal } from './ProjectModals';
import { projectSave, SavedProject } from '../../state/projectLibrary';
import type { TestScenario } from '../../scenes/test-scenarios';
import { WorldMap, parseProject } from '../../state/worldMap';
import { nextEntityId } from '../../state/entityId';
import { migrateScene } from '../../state/sceneMigrate';
import { Tool, Sel, Pt, Layers, DEFAULT_LAYERS, deleteSel, moveSel, selPos, pasteEntity } from './editorState';

/**
 * Éditeur de niveau v2 — SHELL d'orchestration : toolbar (Fichier/scènes/Tester), Palette
 * (rail d'outils), canvas WYSIWYG, Inspecteur DOCKÉ, barre de statut et PANNEAU LOGIQUE
 * (triggers/dialogues/rencontres/validation — fini les modales). Toute édition passe par
 * `setScene` (useSceneHistory) → UN SEUL historique d'undo. La sélection est UNIFIÉE (`Sel`)
 * et synchronisée carte ⇄ inspecteur ⇄ dock.
 */
export function Editor() {
  const setScreen = useGame((s) => s.setScreen);
  const loadProject = useGame((s) => s.loadProject);
  const party = useGame((s) => s.party);

  const { scene, setScene, setSceneNoHistory, pushSnapshot, undo, redo, resetScene, canUndo, canRedo } = useSceneHistory(() => clone(testScene));
  const [tool, setTool] = useState<Tool>({ mode: 'select' });
  const [sel, setSel] = useState<Sel>(null);
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS);
  const [brush, setBrush] = useState(1); // taille de pinceau terrain (1/3/5)
  const [terrainRect, setTerrainRect] = useState(false); // pinceau terrain en mode Rectangle
  const [encTarget, setEncTarget] = useState(''); // rencontre cible de l'outil ⚔️
  const [encRef, setEncRef] = useState(''); // créature à placer
  const [clip, setClip] = useState<Scene['entities'][number] | null>(null); // presse-papier (Ctrl+C/V)
  const hoverRef = useRef<Pt>({ x: 0, y: 0 }); // dernière case survolée (cible de Ctrl+V)
  const [hover, setHover] = useState<Pt | null>(null); // barre de statut

  // --- Projet multi-scènes + métadonnées ---
  const [otherScenes, setOtherScenes] = useState<Scene[]>([]);
  const [worldMap, setWorldMap] = useState<WorldMap | null>(null);
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
  const [advOpen, setAdvOpen] = useState(false);
  const [advText, setAdvText] = useState('');
  const [drawer, setDrawer] = useState<null | 'palette' | 'inspector'>(null); // tiroirs tactiles (≤900px)

  const view = useEditorView();
  const enemyCreatures = creatures.filter((c) => typeof c.char.B === 'number');

  // Toute scène ENTRANT dans l'éditeur est normalisée : les ennemis legacy (`enemies[]`) deviennent
  // des entités-personnages cachées + des membres de rencontre → l'éditeur les manipule comme des
  // entités à part entière (un seul concept « Personnage »).
  function clone(s: Scene): Scene {
    return migrateScene(JSON.parse(JSON.stringify(s)));
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
    () => validateScene([scene, ...otherScenes], worldMap).filter((w) => w.sceneId === scene.id || w.scope === 'worldMap'),
    [scene, otherScenes, worldMap],
  );
  /** Clic sur un avertissement → sélectionne/ouvre le fautif. */
  function selectWarning(w: Warning) {
    if (w.scope === 'dialogue') return openLogic('dialogues', w.refId);
    if (w.scope === 'encounter') return openLogic('encounters', w.refId);
    if (!w.refId) return;
    if (w.scope === 'entity') setSel({ type: 'entity', id: w.refId });
    else if (w.scope === 'trigger') selectFromCanvas({ type: 'trigger', id: w.refId });
    else if (w.scope === 'building') setSel({ type: 'building', id: w.refId });
  }

  // --- Fichier : import/export/bibliothèque/test ---
  function exportJson() {
    // Exporte le PROJET v2 (scènes + carte du monde) ; la première scène est l'entrée.
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
        const { scenes, worldMap: wm } = parseProject(data); // projet v2, legacy (tableau) ou scène unique
        if (!scenes.length) return;
        setOtherScenes(scenes.slice(1).map(clone));
        setWorldMap(wm ?? null);
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
    loadProject([scene, ...otherScenes], scene.id, worldMap);
    setScreen('campaign');
  }
  function loadScenario(sc: TestScenario) {
    setOtherScenes((sc.extraScenes ?? []).map(clone));
    setWorldMap(sc.worldMap ? JSON.parse(JSON.stringify(sc.worldMap)) : null);
    setProjectId(null);
    setProjectName(sc.title);
    setPublished(false);
    setSel(null);
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
    setSel(null);
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
  function newProject() {
    setOtherScenes([]);
    setWorldMap(null);
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
    const tiles: Terrain[] = new Array(w * h).fill('herbe');
    for (let y = 0; y < Math.min(h, scene.dimensions.h); y++)
      for (let x = 0; x < Math.min(w, scene.dimensions.w); x++) tiles[y * w + x] = tileAt(scene, x, y);
    setScene({ ...scene, dimensions: { w, h }, tiles });
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
        onTest={test}
      />

      <div className={`editor-main${drawer ? ` drawer-${drawer}` : ''}`}>
        <Palette
          scene={scene}
          tool={tool}
          setTool={setTool}
          brush={brush}
          setBrush={setBrush}
          terrainRect={terrainRect}
          setTerrainRect={setTerrainRect}
          encTarget={encTarget}
          setEncTarget={setEncTarget}
          encRef={encRef}
          setEncRef={setEncRef}
          enemyCreatures={enemyCreatures}
        />

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
          encRef={encRef || enemyCreatures[0]?.label || 'Mutant'}
          layers={layers}
          sel={sel}
          onSelect={selectFromCanvas}
          onHover={onHover}
        />

        <Inspector
          scene={scene}
          otherScenes={otherScenes}
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
          🖌 Outils
        </button>
        <button className={`btn${drawer === 'inspector' ? ' btn-primary' : ''}`} onClick={() => setDrawer(drawer === 'inspector' ? null : 'inspector')}>
          🔍 Inspecteur
        </button>
      </div>

      {worldOpen && <WorldMapEditor map={worldMap} setMap={setWorldMap} scenes={[scene, ...otherScenes]} onClose={() => setWorldOpen(false)} />}
      {openOpen && <OpenProjectModal onScenario={loadScenario} onProject={loadSaved} onClose={() => setOpenOpen(false)} />}
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
            <h3>Avancé — JSON de la scène (dialogues, triggers, rencontres)</h3>
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
          </div>
        </div>
      )}
    </div>
  );
}
