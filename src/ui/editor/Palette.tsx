/**
 * Palette v2 : un RAIL d'outils à icônes + le contenu CONTEXTUEL de l'outil actif (un seul
 * affiché à la fois — fini la pile infinie du POC). Pose DIRECTE depuis les catalogues
 * recherchables (décors `PROPS`, espèces du rig, bâtiments par catégorie, créatures du bestiaire).
 * Composant de PRÉSENTATION : l'état (outil, pinceau, rencontre cible) vit dans Editor.
 */
import { useState } from 'react';
import type { Scene, Terrain } from '../../state/scene';
import { TERRAINS } from '../../state/terrain';
import { TERRAIN_VIZ } from '../../gameIso/catalog/terrain';
import { BUILDINGS_META } from '../../gameIso/catalog/buildings';
import { PROPS } from '../../gameIso/catalog/decor';
import { creatureSpeciesNames } from '../../gameIso/rig/creatures';
import type { Tool } from './editorState';

const TERRAIN_IDS = Object.keys(TERRAINS);

type Family = 'select' | 'tile' | 'wall' | 'elev' | 'personnage' | 'prop' | 'heroStart' | 'building' | 'zone' | 'entry' | 'encounter' | 'stair' | 'erase';

const RAIL: { key: Family; icon: string; label: string }[] = [
  { key: 'select', icon: '↖', label: 'Sélection / déplacer — clic = sélectionner, glisser = déplacer' },
  { key: 'tile', icon: '🖌', label: 'Peindre le terrain' },
  { key: 'wall', icon: '🧱', label: 'Murs — cloison ou porte sur une arête, diagonale au centre de la case' },
  { key: 'elev', icon: '⛰', label: 'Élévation — scène surélevée / fosse (peindre une hauteur)' },
  { key: 'personnage', icon: '🙂', label: 'Poser un personnage' },
  { key: 'prop', icon: '🌳', label: 'Poser un décor' },
  { key: 'heroStart', icon: '🏁', label: 'Départ des héros (case d’arrivée du groupe)' },
  { key: 'building', icon: '🏠', label: 'Poser un bâtiment — glisser pour définir l’empreinte' },
  { key: 'zone', icon: '🟦', label: 'Dessiner une zone — trigger ou zone de repos' },
  { key: 'entry', icon: '⚑', label: 'Poser un point d’entrée (cible des transitions)' },
  { key: 'encounter', icon: '⚔️', label: 'Placer des ennemis (rencontre de combat)' },
  { key: 'stair', icon: '🪜', label: 'Escalier — relie cette case à l’étage au-dessus (traversée multi-niveaux)' },
  { key: 'erase', icon: '🧽', label: 'Gomme — efface les entités cliquées' },
];

/** Sous-modes de l'outil murs (rail contextuel). */
const WALL_PAINTS: { paint: import('./editorState').WallPaint; icon: string; label: string }[] = [
  { paint: 'wall', icon: '▮', label: 'Cloison' },
  { paint: 'door', icon: '🚪', label: 'Porte' },
  { paint: 'diagBack', icon: '◣', label: 'Diagonale ＼' },
  { paint: 'diagFwd', icon: '◢', label: 'Diagonale ／' },
];

/** Presets d'élévation (unités d'étage). Plat efface l'élévation locale. */
const ELEV_PRESETS: { value: number; label: string }[] = [
  { value: 0, label: 'Plat' },
  { value: 0.25, label: 'Estrade' },
  { value: 0.45, label: 'Scène' },
  { value: 0.7, label: 'Haute' },
  { value: -0.4, label: 'Fosse' },
  { value: -0.8, label: 'Cave' },
];

/** Famille du rail correspondant à l'outil actif. */
function familyOf(tool: Tool): Family {
  if (tool.mode === 'entity') return tool.kind === 'prop' ? 'prop' : tool.kind === 'personnage' ? 'personnage' : 'heroStart';
  return tool.mode as Family;
}

export function Palette({
  scene,
  tool,
  setTool,
  brush,
  setBrush,
  terrainRect,
  setTerrainRect,
  encTarget,
  setEncTarget,
  encRef,
  setEncRef,
  enemyCreatures,
}: {
  scene: Scene;
  tool: Tool;
  setTool: (t: Tool) => void;
  brush: number;
  setBrush: (n: number) => void;
  terrainRect: boolean;
  setTerrainRect: (b: boolean) => void;
  encTarget: string;
  setEncTarget: (s: string) => void;
  encRef: string;
  setEncRef: (s: string) => void;
  enemyCreatures: { id: string; label: string }[];
}) {
  const family = familyOf(tool);
  const [search, setSearch] = useState(''); // filtre partagé des catalogues (réinitialisé au changement d'outil)
  // Derniers choix par famille → re-cliquer l'icône retrouve l'outil précis.
  const [lastTerrain, setLastTerrain] = useState<Terrain>('herbe');
  const [lastProp, setLastProp] = useState('tonneau');
  const [lastBuilding, setLastBuilding] = useState(Object.keys(BUILDINGS_META)[0] ?? 'maison');

  const pick = (f: Family) => {
    setSearch('');
    switch (f) {
      case 'select': return setTool({ mode: 'select' });
      case 'tile': return setTool({ mode: 'tile', terrain: lastTerrain });
      case 'wall': return setTool({ mode: 'wall', paint: 'wall' });
      case 'elev': return setTool({ mode: 'elev', value: 0.45 });
      case 'personnage': return setTool({ mode: 'entity', kind: 'personnage' });
      case 'prop': return setTool({ mode: 'entity', kind: 'prop', ref: lastProp });
      case 'heroStart': return setTool({ mode: 'entity', kind: 'heroStart' });
      case 'building': return setTool({ mode: 'building', type: lastBuilding });
      case 'zone': return setTool({ mode: 'zone', zone: 'trigger' });
      case 'entry': return setTool({ mode: 'entry' });
      case 'encounter': return setTool({ mode: 'encounter' });
      case 'stair': return setTool({ mode: 'stair' });
      case 'erase': return setTool({ mode: 'erase' });
    }
  };

  const match = (label: string) => label.toLowerCase().includes(search.toLowerCase());
  const searchBox = (placeholder: string) => (
    <input className="pal-search" placeholder={`🔎 ${placeholder}`} value={search} onChange={(e) => setSearch(e.target.value)} />
  );

  return (
    <aside className="editor-palette">
      <div className="pal-rail" role="toolbar" aria-label="Outils">
        {RAIL.map((r) => (
          <button
            key={r.key}
            className={`pal-tool${family === r.key ? ' active' : ''}`}
            title={r.label}
            aria-label={r.label}
            aria-pressed={family === r.key}
            onClick={() => pick(r.key)}
          >
            {r.icon}
          </button>
        ))}
      </div>

      <div className="pal-content">
        {family === 'select' && (
          <p className="hint">Cliquez un élément de la carte pour l'éditer dans l'inspecteur ; glissez pour le déplacer. Suppr = supprimer, flèches = décaler, Ctrl+C/V/D = copier/coller/dupliquer.</p>
        )}

        {family === 'tile' && tool.mode === 'tile' && (
          <>
            <div className="mini-title">Pinceau</div>
            <div className="row-flex">
              {[1, 3, 5].map((n) => (
                <button key={n} className={`btn small ${brush === n && !terrainRect ? 'btn-primary' : ''}`} onClick={() => { setBrush(n); setTerrainRect(false); }}>
                  {n}×{n}
                </button>
              ))}
              <button className={`btn small ${terrainRect ? 'btn-primary' : ''}`} title="Glisser pour remplir un rectangle" onClick={() => setTerrainRect(!terrainRect)}>
                ▭ Rect
              </button>
            </div>
            <div className="mini-title">Terrains</div>
            <div className="terrain-palette">
              {TERRAIN_IDS.map((t) => (
                <button
                  key={t}
                  className={`terrain-swatch ${tool.terrain === t ? 'active' : ''}`}
                  style={{ background: TERRAIN_VIZ[t]?.swatch ?? '#888' }}
                  onClick={() => {
                    setLastTerrain(t as Terrain);
                    setTool({ mode: 'tile', terrain: t as Terrain });
                  }}
                  title={TERRAINS[t].label}
                >
                  {TERRAINS[t].label}
                </button>
              ))}
            </div>
          </>
        )}

        {family === 'wall' && tool.mode === 'wall' && (
          <>
            <div className="mini-title">Type de cloison</div>
            <div className="row-flex">
              {WALL_PAINTS.map((wp) => (
                <button
                  key={wp.paint}
                  className={`btn small ${tool.paint === wp.paint ? 'btn-primary' : ''}`}
                  title={wp.label}
                  onClick={() => setTool({ mode: 'wall', paint: wp.paint })}
                >
                  {wp.icon} {wp.label}
                </button>
              ))}
            </div>
            <p className="hint">
              {tool.paint === 'wall' || tool.paint === 'door'
                ? 'Cliquez PRÈS d’une arête de case : l’arête surlignée prend la cloison/porte. Re-cliquer l’efface.'
                : 'Cliquez une case : la diagonale se pose en travers (éventail / paroi courbe). Re-cliquer l’efface.'}
            </p>
          </>
        )}

        {family === 'elev' && tool.mode === 'elev' && (
          <>
            <div className="mini-title">Pinceau</div>
            <div className="row-flex">
              {[1, 3, 5].map((n) => (
                <button key={n} className={`btn small ${brush === n ? 'btn-primary' : ''}`} onClick={() => setBrush(n)}>
                  {n}×{n}
                </button>
              ))}
            </div>
            <div className="mini-title">Hauteur</div>
            <div className="row-flex">
              {ELEV_PRESETS.map((p) => (
                <button key={p.label} className={`btn small ${tool.value === p.value ? 'btn-primary' : ''}`} onClick={() => setTool({ mode: 'elev', value: p.value })}>
                  {p.label} <span className="chip">{p.value > 0 ? '+' : ''}{p.value}</span>
                </button>
              ))}
            </div>
            <label className="mini-title" style={{ display: 'block' }}>
              Sur mesure
              <input type="number" step={0.05} value={tool.value} onChange={(e) => setTool({ mode: 'elev', value: Number(e.target.value) })} style={{ width: '5rem', marginLeft: '0.5rem' }} />
            </label>
            <p className="hint">Peignez une hauteur sur les cases (scène surélevée, fosse d’orchestre). « Plat » remet à 0.</p>
          </>
        )}

        {family === 'personnage' && tool.mode === 'entity' && (
          <>
            <div className="mini-title">Personnage à poser</div>
            {searchBox('espèce…')}
            <div className="pal-list">
              {['Villageois', ...creatureSpeciesNames()].filter(match).map((name) => (
                <button
                  key={name}
                  className={`pal-item${(tool.ref ?? 'Villageois') === name ? ' active' : ''}`}
                  onClick={() => setTool({ mode: 'entity', kind: 'personnage', ref: name === 'Villageois' ? undefined : name })}
                >
                  {name}
                </button>
              ))}
            </div>
            <p className="hint">Cliquez la carte pour poser. Apparence, dialogue et rôle de marchand s'éditent ensuite dans l'inspecteur.</p>
          </>
        )}

        {family === 'prop' && tool.mode === 'entity' && (
          <>
            <div className="mini-title">Décor à poser</div>
            {searchBox('décor…')}
            <div className="pal-list">
              {Object.values(PROPS).filter((p) => match(p.label)).map((p) => (
                <button
                  key={p.id}
                  className={`pal-item${tool.ref === p.id ? ' active' : ''}`}
                  onClick={() => {
                    setLastProp(p.id);
                    setTool({ mode: 'entity', kind: 'prop', ref: p.id });
                  }}
                >
                  {p.label}
                  {p.foot ? <span className="chip">{p.foot.w}×{p.foot.h}</span> : null}
                </button>
              ))}
            </div>
          </>
        )}

        {family === 'heroStart' && (
          <p className="hint">Cliquez la carte pour poser la case de DÉPART du groupe (une seule utile — la première trouvée est utilisée).</p>
        )}

        {family === 'building' && tool.mode === 'building' && (
          <>
            {(['petit', 'monument'] as const).map((cat) => {
              const list = Object.values(BUILDINGS_META).filter((b) => b.category === cat);
              if (!list.length) return null;
              return (
                <div key={cat}>
                  <div className="mini-title">{cat === 'petit' ? 'Bâtiments' : 'Monuments'}</div>
                  <div className="pal-list">
                    {list.map((b) => (
                      <button
                        key={b.id}
                        className={`pal-item${tool.type === b.id ? ' active' : ''}`}
                        title={`${b.label} — glisser sur la carte pour définir l'empreinte`}
                        onClick={() => {
                          setLastBuilding(b.id);
                          setTool({ mode: 'building', type: b.id });
                        }}
                      >
                        {b.label}
                        <span className="chip">{b.defaultFoot.w}×{b.defaultFoot.h}</span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
            <p className="hint">Glissez sur la carte pour poser (l'empreinte suit le geste). Porte, orientation et intérieur s'éditent dans l'inspecteur.</p>
          </>
        )}

        {family === 'zone' && tool.mode === 'zone' && (
          <>
            <div className="mini-title">Type de zone</div>
            <div className="stack">
              <button className={`pal-item${tool.zone === 'trigger' ? ' active' : ''}`} onClick={() => setTool({ mode: 'zone', zone: 'trigger' })}>
                🟦 Trigger — déclenche des effets quand le groupe y entre
              </button>
              <button className={`pal-item${tool.zone === 'rest' ? ' active' : ''}`} onClick={() => setTool({ mode: 'zone', zone: 'rest' })}>
                ⛺ Zone de repos — offre de repos locale (auberge/maison/camp)
              </button>
              <button className={`pal-item${tool.zone === 'effect' ? ' active' : ''}`} onClick={() => setTool({ mode: 'zone', zone: 'effect' })}>
                ⚠️ Piège / hasard — Dégâts ou États à la traversée / au stationnement
              </button>
            </div>
            <p className="hint">Glissez sur la carte pour dessiner le rectangle. Effets / lieux de repos s'éditent ensuite ({tool.zone === 'trigger' ? 'panneau Logique' : 'inspecteur'}).</p>
          </>
        )}

        {family === 'entry' && (
          <p className="hint">Cliquez la carte pour poser un point d'entrée nommé (cible des transitions d'une autre scène et des arrivées de voyage). Renommez-le dans l'inspecteur.</p>
        )}

        {family === 'encounter' && (
          <>
            <div className="mini-title">Rencontre cible</div>
            <select value={encTarget} onChange={(e) => setEncTarget(e.target.value)}>
              <option value="">Nouvelle rencontre…</option>
              {scene.encounters.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.id} ({(e.members ?? []).length})
                </option>
              ))}
            </select>
            <div className="mini-title">Créature à placer</div>
            {searchBox('créature…')}
            <div className="pal-list">
              {enemyCreatures.filter((c) => match(c.label)).map((c) => (
                <button key={c.id} className={`pal-item${(encRef || enemyCreatures[0]?.id) === c.id ? ' active' : ''}`} onClick={() => setEncRef(c.id)}>
                  {c.label}
                </button>
              ))}
            </div>
            <p className="hint">Chaque clic sur la carte ajoute la créature à la rencontre cible. Traits, sorts et apparence du spawn s'éditent dans l'inspecteur.</p>
          </>
        )}

        {family === 'erase' && <p className="hint">Cliquez (ou glissez sur) les entités à effacer. Zones, bâtiments et spawns se suppriment via leur sélection (Suppr).</p>}
      </div>
    </aside>
  );
}
