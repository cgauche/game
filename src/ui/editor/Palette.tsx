import type { Dispatch, SetStateAction } from 'react';
import { Scene, Terrain } from '../../state/scene';
import { TERRAINS as TERRAIN_META } from '../../state/terrain';
import { TERRAIN_VIZ } from '../../gameIso/catalog/terrain';
import { BUILDINGS_META } from '../../gameIso/catalog/buildings';
import type { Warning } from '../../state/validateScene';
import { ValidationPanel } from './ValidationPanel';
import { Tool, Layers, KINDS, KIND_LABEL } from './tools';
import { allMusicDefs } from '../../audio/music';

const TERRAIN_IDS = Object.keys(TERRAIN_META);

/** Sélecteur de musique de scène (ambiance/combat) : Auto (contexte) / Aucune / pistes du registre. */
function MusicSelect({ label, value, onChange }: { label: string; value: string | null | undefined; onChange: (v: string | null | undefined) => void }) {
  return (
    <label className="ed-field">
      {label}
      <select
        value={value === undefined ? '__auto' : value === null ? '__silence' : value}
        onChange={(e) => onChange(e.target.value === '__auto' ? undefined : e.target.value === '__silence' ? null : e.target.value)}
      >
        <option value="__auto">Automatique</option>
        <option value="__silence">Aucune</option>
        {allMusicDefs().map((d) => (
          <option key={d.id} value={d.id}>{d.id.replace(/^musique-/, '')}</option>
        ))}
      </select>
    </label>
  );
}

/**
 * Volet GAUCHE de l'éditeur : palette à onglets Carte (outils/terrains/entités/bâtiments/zones/
 * rencontres) · Logique (triggers/dialogues/rencontres + validation) · Scène (projet multi-scènes,
 * identité, dimensions, ambiance/météo). Composant de PRÉSENTATION : tout l'état vit dans Editor.
 */
export function Palette({
  scene,
  otherScenes,
  setScene,
  tool,
  setTool,
  layers,
  setLayers,
  brush,
  setBrush,
  terrainRect,
  setTerrainRect,
  palTab,
  setPalTab,
  encTarget,
  setEncTarget,
  encRef,
  setEncRef,
  creatureFilter,
  setCreatureFilter,
  enemyCreatures,
  warnings,
  onSelectWarning,
  openTriggers,
  openDialogues,
  openEncounters,
  openAdvanced,
  switchScene,
  addScene,
  deleteScene,
  resize,
}: {
  scene: Scene;
  otherScenes: Scene[];
  setScene: (s: Scene) => void;
  tool: Tool;
  setTool: (t: Tool) => void;
  layers: Layers;
  setLayers: Dispatch<SetStateAction<Layers>>;
  brush: number;
  setBrush: (n: number) => void;
  terrainRect: boolean;
  setTerrainRect: (b: boolean) => void;
  palTab: 'carte' | 'logique' | 'scene';
  setPalTab: (t: 'carte' | 'logique' | 'scene') => void;
  encTarget: string;
  setEncTarget: (s: string) => void;
  encRef: string;
  setEncRef: (s: string) => void;
  creatureFilter: string;
  setCreatureFilter: (s: string) => void;
  enemyCreatures: { label: string }[];
  warnings: Warning[];
  onSelectWarning: (w: Warning) => void;
  openTriggers: () => void;
  openDialogues: () => void;
  openEncounters: () => void;
  openAdvanced: () => void;
  switchScene: (id: string) => void;
  addScene: () => void;
  deleteScene: (id: string) => void;
  resize: (w: number, h: number) => void;
}) {
  return (
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
                onClick={() => setTool({ mode: 'tile', terrain: t as Terrain })}
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
          <button className="btn btn-primary" onClick={openTriggers}>
            🎯 Triggers &amp; effets ({scene.triggers.length})
          </button>
          <button className="btn btn-primary" onClick={openDialogues}>
            💬 Dialogues ({scene.dialogues.length})
          </button>
          <button className="btn btn-primary" onClick={openEncounters}>
            ⚔️ Rencontres ({scene.encounters.length})
          </button>
          <button className="btn small" onClick={openAdvanced}>
            Avancé (JSON)
          </button>
          <div className="mini-title">Validation{warnings.length ? ` (${warnings.length})` : ''}</div>
          <ValidationPanel warnings={warnings} onSelect={onSelectWarning} />
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
          <MusicSelect
            label="Musique (ambiance)"
            value={scene.music?.ambient}
            onChange={(v) => {
              const m = { ...scene.music, ambient: v };
              setScene({ ...scene, music: m.ambient === undefined && m.combat === undefined ? undefined : m });
            }}
          />
          <MusicSelect
            label="Musique (combat)"
            value={scene.music?.combat}
            onChange={(v) => {
              const m = { ...scene.music, combat: v };
              setScene({ ...scene, music: m.ambient === undefined && m.combat === undefined ? undefined : m });
            }}
          />

          <label className="ed-field">
            Message d'introduction
            <textarea value={scene.startMessage ?? ''} onChange={(e) => setScene({ ...scene, startMessage: e.target.value || undefined })} />
          </label>
        </div>
      )}
    </aside>
  );
}
