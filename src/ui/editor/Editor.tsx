import { useRef, useState } from 'react';
import { useGame } from '../../state/store';
import { Scene, Terrain, SceneEntity, EntityKind, emptyScene, tileAt } from '../../state/scene';
import { tome1Intro } from '../../scenes/tome1-intro';
import { creatures } from '../../data';
import { TERRAIN_COLORS } from '../../game/palette';
import { Dims, diamondPath, tileCenter, screenToTile, stageSize, depth, TH } from '../../gameIso/iso';
import { DEFS, TILE_GRAD, wallBlock, tree, placeSprite, pnjSprite, enemySprite, objetSprite, propSprite } from '../../gameIso/sprites';
import { TriggersEditor } from './TriggersEditor';
import { DialogueEditor } from './DialogueEditor';
const TERRAINS: Terrain[] = ['herbe', 'sol', 'route', 'plancher', 'bois', 'eau', 'mur', 'porte'];
const KINDS: EntityKind[] = ['heroStart', 'pnj', 'ennemi', 'objet', 'prop'];
const KIND_LABEL: Record<EntityKind, string> = {
  heroStart: 'Départ héros',
  pnj: 'PNJ',
  ennemi: 'Ennemi',
  objet: 'Objet',
  prop: 'Décor',
};

type Tool = { mode: 'tile'; terrain: Terrain } | { mode: 'entity'; kind: EntityKind } | { mode: 'erase' };

export function Editor() {
  const setScreen = useGame((s) => s.setScreen);
  const startScene = useGame((s) => s.startScene);
  const party = useGame((s) => s.party);

  const [scene, setScene] = useState<Scene>(() => clone(tome1Intro));
  const [tool, setTool] = useState<Tool>({ mode: 'tile', terrain: 'mur' });
  const [selected, setSelected] = useState<string | null>(null);
  const [painting, setPainting] = useState(false);
  const [advOpen, setAdvOpen] = useState(false);
  const [advText, setAdvText] = useState('');
  const [trigOpen, setTrigOpen] = useState(false);
  const [dlgOpen, setDlgOpen] = useState(false);
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
    if (e.kind === 'prop') return propSprite();
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

  const sel = scene.entities.find((e) => e.id === selected) ?? null;
  const updateSel = (patch: Partial<SceneEntity>) =>
    setScene({ ...scene, entities: scene.entities.map((e) => (e.id === selected ? { ...e, ...patch } : e)) });

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
          <div className="mini-title">Métadonnées</div>
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

          <div className="mini-title">Terrains</div>
          <div className="terrain-palette">
            {TERRAINS.map((t) => (
              <button
                key={t}
                className={`terrain-swatch ${tool.mode === 'tile' && tool.terrain === t ? 'active' : ''}`}
                style={{ background: '#' + TERRAIN_COLORS[t].toString(16).padStart(6, '0') }}
                onClick={() => setTool({ mode: 'tile', terrain: t })}
                title={t}
              >
                {t}
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

          <button className="btn small btn-primary" style={{ marginTop: 12 }} onClick={() => setTrigOpen(true)}>
            🎯 Triggers &amp; effets
          </button>
          <button className="btn small btn-primary" style={{ marginTop: 6 }} onClick={() => setDlgOpen(true)}>
            💬 Dialogues
          </button>
          <button className="btn small" style={{ marginTop: 6 }} onClick={openAdvanced}>
            Rencontres / avancé (JSON)
          </button>
        </aside>

        <main className="editor-canvas-wrap">
          <svg
            ref={canvasRef}
            className="editor-iso"
            viewBox={`0 0 ${stage.w} ${stage.h}`}
            width={stage.w}
            height={stage.h}
            onPointerDown={(e) => {
              setPainting(true);
              applyAt(isoTile(e));
            }}
            onPointerMove={(e) => painting && tool.mode === 'tile' && applyAt(isoTile(e))}
            onPointerUp={() => setPainting(false)}
            onPointerLeave={() => setPainting(false)}
          >
            <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
            <g>
              {(() => {
                const els: JSX.Element[] = [];
                for (let y = 0; y < dims.h; y++)
                  for (let x = 0; x < dims.w; x++) {
                    const t = tileAt(scene, x, y);
                    els.push(<path key={`f${x}-${y}`} d={diamondPath(x, y, dims)} fill={`url(#${TILE_GRAD[t]})`} stroke="rgba(0,0,0,0.18)" />);
                  }
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
          </svg>
          <p className="hint">
            Peignez les tuiles (cliquer-glisser). Placez les entités. Les zones rouges en pointillés sont les triggers.
          </p>
        </main>

        <aside className="editor-inspector">
          <div className="mini-title">Entité sélectionnée</div>
          {sel ? (
            <div className="inspector">
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
                  ID de dialogue
                  <input value={sel.dialogueId ?? ''} onChange={(e) => updateSel({ dialogueId: e.target.value })} placeholder="dlg-…" />
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
              <button className="btn small danger" onClick={() => setScene({ ...scene, entities: scene.entities.filter((x) => x.id !== sel.id) })}>
                Supprimer
              </button>
            </div>
          ) : (
            <p className="hint">Cliquez une entité sur la carte pour l'éditer.</p>
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
