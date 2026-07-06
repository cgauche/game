/**
 * Palette v2 : un RAIL d'outils à icônes + le contenu CONTEXTUEL de l'outil actif (un seul
 * affiché à la fois — fini la pile infinie du POC). Pose DIRECTE depuis les catalogues
 * recherchables (décors `PROPS`, espèces du rig, bâtiments par catégorie, créatures du bestiaire).
 * Composant de PRÉSENTATION : l'état (outil, pinceau, rencontre cible) vit dans Editor.
 */
import { useState, type ReactNode } from 'react';
import type { Scene, Terrain } from '../../state/scene';
import { Icon } from '../Icon';
import { TERRAINS } from '../../state/terrain';
import { TERRAIN_VIZ } from '../../gameIso/catalog/terrain';
import { PROPS } from '../../gameIso/catalog/decor';
import { creatureSpeciesOptions } from '../../gameIso/rig/creatures';
import type { Tool } from './editorState';
import { SIEGE_ENGINES, ROOF_STYLES } from './editorState';

const TERRAIN_IDS = Object.keys(TERRAINS);

type Family = 'select' | 'tile' | 'wall' | 'height' | 'personnage' | 'prop' | 'heroStart' | 'roof' | 'zone' | 'entry' | 'encounter' | 'emplacement' | 'erase';

const RAIL: { key: Family; icon: ReactNode; label: string }[] = [
  { key: 'select', icon: '↖', label: 'Sélection / déplacer — clic = sélectionner, glisser = déplacer' },
  { key: 'tile', icon: <Icon id="map-tool/paint" />, label: 'Peindre le terrain' },
  { key: 'wall', icon: <Icon id="map-tool/wall" />, label: 'Murs — cloison ou porte sur une arête, diagonale au centre de la case' },
  { key: 'height', icon: <Icon id="map-tool/height" />, label: 'Hauteur — surface surélevée / fosse (peindre une hauteur en mètres ; la traversée verticale s’auto-dérive)' },
  { key: 'personnage', icon: <Icon id="map-tool/npc" />, label: 'Poser un personnage' },
  { key: 'prop', icon: <Icon id="map-tool/prop" />, label: 'Poser un décor' },
  { key: 'heroStart', icon: <Icon id="map-tool/start-flag" />, label: 'Départ des héros (case d’arrivée du groupe)' },
  { key: 'roof', icon: <Icon id="rest/home" />, label: 'Toit — bâtiment composé : glisser pour couvrir l’empreinte (les murs se tracent à l’outil mur)' },
  { key: 'zone', icon: <Icon id="map-tool/zone" />, label: 'Dessiner une zone — trigger ou zone de repos' },
  { key: 'entry', icon: <Icon id="nav/entry-point" />, label: 'Poser un point d’entrée (cible des transitions)' },
  { key: 'encounter', icon: <Icon id="action/attack" size="sm" />, label: 'Placer des ennemis (rencontre de combat)' },
  { key: 'emplacement', icon: <Icon id="scenario/siege" size="sm" />, label: 'Emplacement de siège — poser une pièce d’artillerie (baliste, catapulte, canon…) servie par un équipage' },
  { key: 'erase', icon: <Icon id="map-tool/erase" />, label: 'Gomme — efface les entités cliquées' },
];

/** Sous-modes de l'outil murs (rail contextuel). */
const WALL_PAINTS: { paint: import('./editorState').WallPaint; icon: ReactNode; label: string }[] = [
  { paint: 'wall', icon: '▮', label: 'Cloison' },
  { paint: 'door', icon: <Icon id="map-tool/door" />, label: 'Porte' },
  { paint: 'diagBack', icon: '◣', label: 'Diagonale ＼' },
  { paint: 'diagFwd', icon: '◢', label: 'Diagonale ／' },
];

/** Presets de HAUTEUR en MÈTRES (échelle RAW, cf. `relief.ts`). « Plat » remet la surface à 0. */
const HEIGHT_PRESETS: { metres: number; label: string }[] = [
  { metres: 0, label: 'Plat' },
  { metres: 1, label: 'Estrade' },
  { metres: 2, label: 'Surface' },
  { metres: 4, label: 'Haute' },
  { metres: -2, label: 'Fosse' },
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
  const [lastStyle, setLastStyle] = useState<string>(ROOF_STYLES[0]);
  const [lastEngine, setLastEngine] = useState(SIEGE_ENGINES[0]?.id ?? 'baliste');

  const pick = (f: Family) => {
    setSearch('');
    switch (f) {
      case 'select': return setTool({ mode: 'select' });
      case 'tile': return setTool({ mode: 'tile', terrain: lastTerrain });
      case 'wall': return setTool({ mode: 'wall', paint: 'wall' });
      case 'height': return setTool({ mode: 'height', metres: 2 });
      case 'personnage': return setTool({ mode: 'entity', kind: 'personnage' });
      case 'prop': return setTool({ mode: 'entity', kind: 'prop', ref: lastProp });
      case 'heroStart': return setTool({ mode: 'entity', kind: 'heroStart' });
      case 'roof': return setTool({ mode: 'roof', style: lastStyle });
      case 'zone': return setTool({ mode: 'zone', zone: 'trigger' });
      case 'entry': return setTool({ mode: 'entry' });
      case 'encounter': return setTool({ mode: 'encounter' });
      case 'emplacement': return setTool({ mode: 'emplacement', trappingId: lastEngine });
      case 'erase': return setTool({ mode: 'erase' });
    }
  };

  const match = (label: string) => label.toLowerCase().includes(search.toLowerCase());
  const searchBox = (placeholder: string) => (
    <div className="pal-search-row">
      <Icon id="ui/search" size="sm" />
      <input className="pal-search" placeholder={placeholder} value={search} onChange={(e) => setSearch(e.target.value)} />
    </div>
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
            <p className="hint">↖ Sélectionnez une cloison/porte pour lui donner une structure destructible (porte de ville, mur de pierre…).</p>
          </>
        )}

        {family === 'height' && tool.mode === 'height' && (
          <>
            <div className="mini-title">Pinceau</div>
            <div className="row-flex">
              {[1, 3, 5].map((n) => (
                <button key={n} className={`btn small ${brush === n ? 'btn-primary' : ''}`} onClick={() => setBrush(n)}>
                  {n}×{n}
                </button>
              ))}
            </div>
            <div className="mini-title">Hauteur (mètres)</div>
            <div className="row-flex">
              {HEIGHT_PRESETS.map((p) => (
                <button key={p.label} className={`btn small ${tool.metres === p.metres ? 'btn-primary' : ''}`} onClick={() => setTool({ mode: 'height', metres: p.metres })}>
                  {p.label} <span className="chip">{p.metres > 0 ? '+' : ''}{p.metres} m</span>
                </button>
              ))}
            </div>
            <label className="mini-title" style={{ display: 'block' }}>
              Sur mesure
              <input type="number" step={0.5} value={tool.metres} onChange={(e) => setTool({ mode: 'height', metres: Number(e.target.value) })} style={{ width: '5rem', marginLeft: '0.5rem' }} />
            </label>
            <p className="hint">Peignez la hauteur RÉELLE des cases en mètres (surface surélevée, fosse d’orchestre). « Plat » remet à 0 ; la traversée à pied / en chute s’en déduit (cf. relief).</p>
          </>
        )}

        {family === 'personnage' && tool.mode === 'entity' && (
          <>
            <div className="mini-title">Personnage à poser</div>
            {searchBox('espèce…')}
            <div className="pal-list">
              {[{ id: '', label: 'Villageois' }, ...creatureSpeciesOptions()].filter((o) => match(o.label)).map((o) => (
                <button
                  key={o.id || '__villageois'}
                  className={`pal-item${(tool.ref ?? '') === o.id ? ' active' : ''}`}
                  onClick={() => setTool({ mode: 'entity', kind: 'personnage', ref: o.id || undefined })}
                >
                  {o.label}
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

        {family === 'roof' && tool.mode === 'roof' && (
          <>
            <div className="mini-title">Style de toit</div>
            <div className="pal-list">
              {ROOF_STYLES.map((s) => (
                <button
                  key={s}
                  className={`pal-item${tool.style === s ? ' active' : ''}`}
                  title={`${s} — glisser sur la carte pour couvrir l'empreinte`}
                  onClick={() => {
                    setLastStyle(s);
                    setTool({ mode: 'roof', style: s });
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="hint">Glissez sur la carte pour couvrir l'empreinte (le toit suit le geste). Tracez les MURS du bâtiment à l'outil <Icon id="map-tool/wall" size="sm" /> ; matériau, étages et couleurs s'éditent dans l'inspecteur.</p>
          </>
        )}

        {family === 'zone' && tool.mode === 'zone' && (
          <>
            <div className="mini-title">Type de zone</div>
            <div className="stack">
              <button className={`pal-item${tool.zone === 'trigger' ? ' active' : ''}`} onClick={() => setTool({ mode: 'zone', zone: 'trigger' })}>
                <Icon id="map-tool/zone" size="sm" /> Trigger — déclenche des effets quand le groupe y entre
              </button>
              <button className={`pal-item${tool.zone === 'rest' ? ' active' : ''}`} onClick={() => setTool({ mode: 'zone', zone: 'rest' })}>
                <Icon id="rest/camp" size="sm" /> Zone de repos — offre de repos locale (auberge/maison/camp)
              </button>
              <button className={`pal-item${tool.zone === 'effect' ? ' active' : ''}`} onClick={() => setTool({ mode: 'zone', zone: 'effect' })}>
                <Icon id="ui/warning" size="sm" /> Piège / hasard — Dégâts ou États à la traversée / au stationnement
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

        {family === 'emplacement' && tool.mode === 'emplacement' && (
          <>
            <div className="mini-title">Pièce d'artillerie à poser</div>
            {searchBox('engin de siège…')}
            <div className="pal-list">
              {SIEGE_ENGINES.filter((t) => match(t.label)).map((t) => (
                <button
                  key={t.id}
                  className={`pal-item${tool.trappingId === t.id ? ' active' : ''}`}
                  onClick={() => {
                    setLastEngine(t.id);
                    setTool({ mode: 'emplacement', trappingId: t.id });
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="hint">Cliquez la carte pour poser l'emplacement. Orientation du créneau et équipage s'éditent dans l'inspecteur ; enrôlez-le dans une rencontre (fold <Icon id="action/attack" size="sm" /> Combat) pour qu'il entre en jeu.</p>
          </>
        )}

        {family === 'erase' && <p className="hint">Cliquez (ou glissez sur) les entités à effacer. Zones, bâtiments et spawns se suppriment via leur sélection (Suppr).</p>}
      </div>
    </aside>
  );
}
