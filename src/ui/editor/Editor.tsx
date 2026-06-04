import { useEffect, useRef, useState } from 'react';
import { useGame } from '../../state/store';
import { Scene, Terrain, SceneEntity, EntityKind, emptyScene, tileAt, WALKABLE } from '../../state/scene';
import { tome1Intro } from '../../scenes/tome1-intro';
import { creatures } from '../../data';
import { TERRAIN_COLORS } from '../../game/palette';

const ET = 28;
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
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const enemyCreatures = creatures.filter((c) => typeof c.char.B === 'number');

  useEffect(() => draw(), [scene, selected]);

  function clone(s: Scene): Scene {
    return JSON.parse(JSON.stringify(s));
  }

  function draw() {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const { w, h } = scene.dimensions;
    cv.width = w * ET;
    cv.height = h * ET;
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const t = tileAt(scene, x, y);
        ctx.fillStyle = '#' + TERRAIN_COLORS[t].toString(16).padStart(6, '0');
        ctx.fillRect(x * ET, y * ET, ET, ET);
        if (!WALKABLE[t]) {
          ctx.fillStyle = 'rgba(0,0,0,0.25)';
          ctx.fillRect(x * ET, y * ET, ET, ET);
        }
        ctx.strokeStyle = 'rgba(0,0,0,0.15)';
        ctx.strokeRect(x * ET, y * ET, ET, ET);
      }
    for (const e of scene.entities) {
      ctx.fillStyle = entColor(e.kind);
      ctx.beginPath();
      ctx.arc(e.pos.x * ET + ET / 2, e.pos.y * ET + ET / 2, ET / 2 - 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.lineWidth = e.id === selected ? 3 : 1;
      ctx.strokeStyle = e.id === selected ? '#ffe066' : '#000';
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText((e.label ?? e.ref ?? e.kind)[0].toUpperCase(), e.pos.x * ET + ET / 2, e.pos.y * ET + ET / 2 + 4);
    }
    // Triggers (zones)
    for (const t of scene.triggers) {
      ctx.strokeStyle = 'rgba(231,76,60,0.9)';
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(t.rect.x * ET, t.rect.y * ET, t.rect.w * ET, t.rect.h * ET);
      ctx.setLineDash([]);
    }
  }

  function tileFromEvent(e: React.MouseEvent): { x: number; y: number } {
    const r = canvasRef.current!.getBoundingClientRect();
    const scaleX = canvasRef.current!.width / r.width;
    const scaleY = canvasRef.current!.height / r.height;
    return {
      x: Math.floor(((e.clientX - r.left) * scaleX) / ET),
      y: Math.floor(((e.clientY - r.top) * scaleY) / ET),
    };
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

          <button className="btn small" style={{ marginTop: 12 }} onClick={openAdvanced}>
            Dialogues / Triggers / Combats (JSON)
          </button>
        </aside>

        <main className="editor-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="editor-canvas"
            onMouseDown={(e) => {
              setPainting(true);
              applyAt(tileFromEvent(e));
            }}
            onMouseMove={(e) => painting && tool.mode === 'tile' && applyAt(tileFromEvent(e))}
            onMouseUp={() => setPainting(false)}
            onMouseLeave={() => setPainting(false)}
          />
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
