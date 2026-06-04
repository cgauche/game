import { useRef, useState } from 'react';
import { useGame } from '../../state/store';
import { Scene, Terrain, SceneEntity, EntityKind, emptyScene, tileAt } from '../../state/scene';
import { tome1Intro } from '../../scenes/tome1-intro';
import { creatures } from '../../data';
import { Dims, diamondPath, tileCenter, screenToTile, stageSize, depth, TH } from '../../gameIso/iso';
import { DEFS, wallBlock, tree, placeSprite, pnjSprite, enemySprite, objetSprite, propSprite } from '../../gameIso/sprites';
import { groundTile } from '../../gameIso/ground';
import { BUILDINGS } from '../../gameIso/catalog/buildings';
import { buildingObj } from '../../gameIso/BuildingSprite';
import { TERRAINS as TERRAIN_META } from '../../state/terrain';
import { TERRAIN_VIZ } from '../../gameIso/catalog/terrain';
import { BUILDINGS_META, perimeterTiles, defaultDoor } from '../../state/buildings';
import { PROPS } from '../../gameIso/catalog/decor';
import { BuildingFeature } from '../../state/scene';
import { campaign } from '../../scenes/campaign';
import { ParamFields } from './ParamFields';
import { TriggersEditor } from './TriggersEditor';
import { DialogueEditor } from './DialogueEditor';
import { EncountersEditor } from './EncountersEditor';
const TERRAIN_IDS = Object.keys(TERRAIN_META);
const KINDS: EntityKind[] = ['heroStart', 'pnj', 'ennemi', 'objet', 'prop'];
const KIND_LABEL: Record<EntityKind, string> = {
  heroStart: 'Départ héros',
  pnj: 'PNJ',
  ennemi: 'Ennemi',
  objet: 'Objet',
  prop: 'Décor',
};

type Tool =
  | { mode: 'tile'; terrain: Terrain }
  | { mode: 'entity'; kind: EntityKind }
  | { mode: 'building'; type: string }
  | { mode: 'erase' }
  | { mode: 'trigger' };
type Rect = { x: number; y: number; w: number; h: number };

export function Editor() {
  const setScreen = useGame((s) => s.setScreen);
  const startScene = useGame((s) => s.startScene);
  const party = useGame((s) => s.party);

  const [scene, setScene] = useState<Scene>(() => clone(tome1Intro));
  const [tool, setTool] = useState<Tool>({ mode: 'tile', terrain: 'mur' });
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [painting, setPainting] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [advText, setAdvText] = useState('');
  const [trigOpen, setTrigOpen] = useState(false);
  const [dlgOpen, setDlgOpen] = useState(false);
  const [encOpen, setEncOpen] = useState(false);
  const [palTab, setPalTab] = useState<'carte' | 'logique' | 'scene'>('carte');
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragRect, setDragRect] = useState<Rect | null>(null);
  const canvasRef = useRef<SVGSVGElement>(null);

  const enemyCreatures = creatures.filter((c) => typeof c.char.B === 'number');

  function clone(s: Scene): Scene {
    return JSON.parse(JSON.stringify(s));
  }

  const dims: Dims = scene.dimensions;
  const stage = stageSize(dims);

  /** Point écran → tuile (projection iso, comme le jeu). */
  function isoTile(ev: React.PointerEvent): { x: number; y: number } {
    const svg = canvasRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = ev.clientX;
    pt.y = ev.clientY;
    const loc = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return screenToTile(loc.x, loc.y, dims);
  }

  /** Sprite de jeu correspondant à une entité (WYSIWYG). */
  function entitySvg(e: SceneEntity): string {
    if (e.kind === 'pnj') return pnjSprite();
    if (e.kind === 'ennemi') return enemySprite(e.ref ?? '');
    if (e.kind === 'objet') return objetSprite();
    if (e.kind === 'prop') return propSprite(e.ref);
    return '';
  }

  function applyAt(p: { x: number; y: number }) {
    const { w, h } = scene.dimensions;
    if (p.x < 0 || p.y < 0 || p.x >= w || p.y >= h) return;
    if (tool.mode === 'tile') {
      const idx = p.y * w + p.x;
      const tiles = [...scene.tiles];
      tiles[idx] = tool.terrain;
      setScene({ ...scene, tiles });
    } else if (tool.mode === 'erase') {
      const ent = scene.entities.find((e) => e.pos.x === p.x && e.pos.y === p.y);
      if (ent) setScene({ ...scene, entities: scene.entities.filter((e) => e !== ent) });
    } else if (tool.mode === 'entity') {
      const existing = scene.entities.find((e) => e.pos.x === p.x && e.pos.y === p.y);
      if (existing) {
        setSelected(existing.id);
        return;
      }
      const id = `${tool.kind}-${Date.now().toString(36)}`;
      const ent: SceneEntity = { id, kind: tool.kind, pos: { ...p }, label: KIND_LABEL[tool.kind] };
      if (tool.kind === 'ennemi') ent.ref = enemyCreatures[0]?.label ?? 'Mutant';
      setScene({ ...scene, entities: [...scene.entities, ent] });
      setSelected(id);
    }
  }

  function rectFrom(a: { x: number; y: number }, b: { x: number; y: number }): Rect {
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x) + 1, h: Math.abs(a.y - b.y) + 1 };
  }
  function addTrigger(rect: Rect) {
    setScene({ ...scene, triggers: [...scene.triggers, { id: `trig-${Date.now().toString(36)}`, rect, once: true, effects: [] }] });
    setTrigOpen(true); // ouvrir l'éditeur pour attacher les effets
  }
  function addBuilding(type: string, rect: Rect) {
    const meta = BUILDINGS_META[type];
    if (!meta) return;
    const b: BuildingFeature = {
      id: `b-${Date.now().toString(36)}`,
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
    setSelectedBuilding(b.id);
  }

  const sel = scene.entities.find((e) => e.id === selected) ?? null;
  const updateSel = (patch: Partial<SceneEntity>) =>
    setScene({ ...scene, entities: scene.entities.map((e) => (e.id === selected ? { ...e, ...patch } : e)) });
  const selB = (scene.buildings ?? []).find((b) => b.id === selectedBuilding) ?? null;
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
    const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${scene.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function importJson(file: File) {
    file.text().then((txt) => {
      try {
        setScene(JSON.parse(txt));
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
    startScene(scene);
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
          <button className="btn small" onClick={() => setScene(emptyScene())}>
            Nouveau
          </button>
          <button className="btn small" onClick={() => setScene(clone(tome1Intro))}>
            Charger « La Diligence »
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
              <div className="mini-title">Terrains</div>
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
            </div>
          )}

          {palTab === 'scene' && (
            <div className="pal-tab">
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
                <select value={scene.ambiance ?? 'jour'} onChange={(e) => setScene({ ...scene, ambiance: e.target.value as Scene['ambiance'] })}>
                  <option value="jour">Jour</option>
                  <option value="nuit">Nuit</option>
                  <option value="interieur">Intérieur</option>
                  <option value="foret">Forêt</option>
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
          <svg
            ref={canvasRef}
            className="editor-iso"
            viewBox={`0 0 ${stage.w} ${stage.h}`}
            width={stage.w}
            height={stage.h}
            onPointerDown={(e) => {
              const p = isoTile(e);
              if (tool.mode === 'trigger' || tool.mode === 'building') {
                dragStartRef.current = p;
                setDragRect({ x: p.x, y: p.y, w: 1, h: 1 });
              } else {
                setPainting(true);
                applyAt(p);
              }
            }}
            onPointerMove={(e) => {
              if ((tool.mode === 'trigger' || tool.mode === 'building') && dragStartRef.current)
                setDragRect(rectFrom(dragStartRef.current, isoTile(e)));
              else if (painting && tool.mode === 'tile') applyAt(isoTile(e));
            }}
            onPointerUp={(e) => {
              if (tool.mode === 'trigger' && dragStartRef.current) addTrigger(rectFrom(dragStartRef.current, isoTile(e)));
              else if (tool.mode === 'building' && dragStartRef.current) addBuilding(tool.type, rectFrom(dragStartRef.current, isoTile(e)));
              dragStartRef.current = null;
              setDragRect(null);
              setPainting(false);
            }}
            onPointerLeave={() => {
              dragStartRef.current = null;
              setDragRect(null);
              setPainting(false);
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
                    const t = tileAt(scene, x, y);
                    if (t === 'mur') objs.push({ d: depth(x, y), el: <g key={`w${x}-${y}`} dangerouslySetInnerHTML={{ __html: wallBlock(x, y, dims) }} /> });
                    if (t === 'bois') objs.push({ d: depth(x, y) - 0.1, el: <g key={`t${x}-${y}`} dangerouslySetInnerHTML={{ __html: tree(x, y, dims) }} /> });
                  }
                for (const b of scene.buildings ?? []) objs.push(buildingObj(b, dims));
                for (const e of scene.entities) {
                  if (e.kind === 'heroStart') {
                    const { cx, cy } = tileCenter(e.pos.x, e.pos.y, dims);
                    objs.push({
                      d: depth(e.pos.x, e.pos.y) + 0.4,
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
                    objs.push({ d: depth(e.pos.x, e.pos.y) + 0.5, el: <g key={e.id} dangerouslySetInnerHTML={{ __html: placeSprite(entitySvg(e), e.pos.x, e.pos.y, dims, 0.5) }} /> });
                  }
                }
                objs.sort((a, b) => a.d - b.d);
                return objs.map((o) => o.el);
              })()}
            </g>
            <g>
              {scene.triggers.flatMap((t) =>
                Array.from({ length: Math.max(0, t.rect.w * t.rect.h) }, (_, i) => {
                  const x = t.rect.x + (i % t.rect.w);
                  const y = t.rect.y + Math.floor(i / t.rect.w);
                  return (
                    <path
                      key={`tr-${t.id}-${i}`}
                      d={diamondPath(x, y, dims)}
                      fill="rgba(231,76,60,0.12)"
                      stroke="rgba(231,76,60,0.9)"
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                    />
                  );
                }),
              )}
            </g>
            {sel && <path d={diamondPath(sel.pos.x, sel.pos.y, dims)} fill="none" stroke="#ffe066" strokeWidth={3} />}
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
          <p className="hint">
            Peignez les tuiles (cliquer-glisser). Placez les entités. Les zones rouges en pointillés sont les triggers.
          </p>
        </main>

        <aside className="editor-inspector">
          {selB ? (
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
                        {campaign.map((c) => (
                          <option key={c.scene.id} value={c.scene.id}>
                            {c.scene.nom} ({c.scene.id})
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
                      <g dangerouslySetInnerHTML={{ __html: entitySvg(sel) }} />
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
                {sel.kind === 'ennemi' && (
                  <label className="ed-field">
                    Créature (bestiaire)
                    <select value={sel.ref ?? ''} onChange={(e) => updateSel({ ref: e.target.value })}>
                      {enemyCreatures.map((c) => (
                        <option key={c.label} value={c.label}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {sel.kind === 'pnj' && (
                  <label className="ed-field">
                    Dialogue
                    <select value={sel.dialogueId ?? ''} onChange={(e) => updateSel({ dialogueId: e.target.value || undefined })}>
                      <option value="">— aucun —</option>
                      {scene.dialogues.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.id}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {sel.kind === 'objet' && (
                  <label className="ed-field">
                    Butin (séparé par ;)
                    <input
                      value={(sel.loot ?? []).join('; ')}
                      onChange={(e) => updateSel({ loot: e.target.value.split(';').map((s) => s.trim()).filter(Boolean) })}
                    />
                  </label>
                )}
                {sel.kind === 'prop' && (
                  <label className="ed-field">
                    Décor
                    <select value={sel.ref ?? 'tonneau'} onChange={(e) => updateSel({ ref: e.target.value })}>
                      {Object.values(PROPS).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
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

function entColor(kind: EntityKind): string {
  return { heroStart: '#2ecc71', pnj: '#4aa3df', ennemi: '#c0392b', objet: '#f1c40f', prop: '#7f8c8d' }[kind];
}
