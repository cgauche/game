/**
 * Palette v2 : un RAIL d'outils à icônes + le contenu CONTEXTUEL de l'outil actif (un seul
 * affiché à la fois — fini la pile infinie du POC). Pose DIRECTE depuis les catalogues
 * recherchables (décors `PROPS`, espèces du rig, bâtiments par catégorie, créatures du bestiaire).
 * Composant de PRÉSENTATION : l'état (outil, pinceau, rencontre cible) vit dans Editor.
 */
import { useState, type ReactNode } from 'react';
import type { ArchitectureBody, Scene, Terrain } from '../../state/scene';
import { Icon } from '../Icon';
import { OptionChooser } from '../OptionChooser';
import { SearchFilterField, filterByLabel } from '../SearchFilterField';
import { TERRAINS } from '../../state/terrain';
import { TERRAIN_VIZ } from '../../gameIso/catalog/terrain';
import { PROPS } from '../../gameIso/catalog/decor';
import { creatureSpeciesOptions } from '../../gameIso/rig/creatures';
import { BUILDINGS_META } from '../../gameIso/catalog/buildings';
import { structures } from '../../data';
import { structureAppearance } from '../../gameIso/catalog/structures';
import { isWallEdgeStructure, isDoorEdgeStructure } from '../../engine/structures';
import type { Tool } from './editorState';
import { SIEGE_ENGINES } from './editorState';

const TERRAIN_IDS = Object.keys(TERRAINS);

type Family = 'select' | 'architecture' | 'tile' | 'wall' | 'height' | 'crenellated' | 'personnage' | 'prop' | 'heroStart' | 'zone' | 'entry' | 'encounter' | 'emplacement' | 'erase';

const RAIL: { key: Family; icon: ReactNode; label: string }[] = [
  { key: 'select', icon: '↖', label: 'Sélection / déplacer — clic = sélectionner, glisser = déplacer' },
  { key: 'architecture', icon: <Icon id="rest/home" />, label: 'Architecture' },
  { key: 'tile', icon: <Icon id="map-tool/paint" />, label: 'Peindre le terrain' },
  { key: 'wall', icon: <Icon id="map-tool/wall" />, label: 'Murs — cloison ou porte sur une arête, diagonale au centre de la case' },
  { key: 'height', icon: <Icon id="map-tool/height" />, label: 'Hauteur — surface surélevée / fosse (peindre une hauteur en mètres ; la traversée verticale s’auto-dérive)' },
  { key: 'crenellated', icon: <Icon id="map-tool/crenel" />, label: 'Crénelage — marque un parapet crénelé sur les cases peintes (décoration de rendu)' },
  { key: 'personnage', icon: <Icon id="map-tool/npc" />, label: 'Poser un personnage' },
  { key: 'prop', icon: <Icon id="map-tool/prop" />, label: 'Poser un décor' },
  { key: 'heroStart', icon: <Icon id="map-tool/start-flag" />, label: 'Départ des héros (case d’arrivée du groupe)' },
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
  architectureMode,
  architectureBodyId,
  architectureStoreyId,
  architectureAction,
  onArchitectureMode,
  onArchitectureBody,
  onArchitectureStorey,
  onAddArchitectureBody,
  onUpdateArchitectureBody,
  onAddArchitecturePart,
  onAddArchitectureStorey,
  onAddRoofSection,
  onArmFacade,
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
  architectureMode: boolean;
  architectureBodyId: string | null;
  architectureStoreyId: string | null;
  architectureAction: 'select' | 'facade';
  onArchitectureMode: () => void;
  onArchitectureBody: (id: string) => void;
  onArchitectureStorey: (id: string) => void;
  onAddArchitectureBody: () => void;
  onUpdateArchitectureBody: (patch: Partial<Pick<ArchitectureBody, 'label' | 'style'>>) => void;
  onAddArchitecturePart: () => void;
  onAddArchitectureStorey: () => void;
  onAddRoofSection: () => void;
  onArmFacade: () => void;
}) {
  const family = architectureMode ? 'architecture' : familyOf(tool);
  const architectureBody = scene.architecture?.find((body) => body.id === architectureBodyId) ?? scene.architecture?.[0] ?? null;
  const architectureStorey = architectureBody?.storeys.find((storey) => storey.id === architectureStoreyId) ?? architectureBody?.storeys[0] ?? null;
  const [search, setSearch] = useState(''); // filtre partagé des catalogues (réinitialisé au changement d'outil)
  // Derniers choix par famille → re-cliquer l'icône retrouve l'outil précis.
  const [lastTerrain, setLastTerrain] = useState<Terrain>('herbe');
  const [lastProp, setLastProp] = useState('tonneau');
  const [lastEngine, setLastEngine] = useState(SIEGE_ENGINES[0]?.id ?? 'baliste');
  // Matériau MÉMORISÉ par sous-mode (Cloison/Porte) — l'outil porte son matériau comme un pinceau porte
  // sa couleur : la palette ne montre que ce qui est POSABLE sur une arête pour ce sous-mode (#830).
  const wallEdgeStructures = structures.filter(isWallEdgeStructure);
  const doorEdgeStructures = structures.filter(isDoorEdgeStructure);
  const [lastWallStructure, setLastWallStructure] = useState<string | undefined>(undefined);
  // Structures posables au Crénelage : celles qui portent un PARAPET (`structureAppearance`) — une
  // structure sans parapet n'a rien à dessiner sur le pourtour (#841 FU-H).
  const crenelStructures = structures.filter((s) => isWallEdgeStructure(s) && !!structureAppearance(s.id).parapet);
  const [lastCrenelStructure, setLastCrenelStructure] = useState<string | undefined>(crenelStructures[0]?.id);
  const [lastDoorStructure, setLastDoorStructure] = useState<string | undefined>(undefined);

  const pick = (f: Family) => {
    setSearch('');
    switch (f) {
      case 'select': return setTool({ mode: 'select' });
      case 'architecture': return onArchitectureMode();
      case 'tile': return setTool({ mode: 'tile', terrain: lastTerrain });
      case 'wall': return setTool({ mode: 'wall', paint: 'wall', structure: lastWallStructure });
      case 'height': return setTool({ mode: 'height', metres: 2 });
      case 'crenellated': return setTool({ mode: 'crenellated', structure: lastCrenelStructure ?? null });
      case 'personnage': return setTool({ mode: 'entity', kind: 'personnage' });
      case 'prop': return setTool({ mode: 'entity', kind: 'prop', ref: lastProp });
      case 'heroStart': return setTool({ mode: 'entity', kind: 'heroStart' });
      case 'zone': return setTool({ mode: 'zone', zone: 'trigger' });
      case 'entry': return setTool({ mode: 'entry' });
      case 'encounter': return setTool({ mode: 'encounter' });
      case 'emplacement': return setTool({ mode: 'emplacement', trappingId: lastEngine });
      case 'erase': return setTool({ mode: 'erase' });
    }
  };

  const searchBox = (placeholder: string) => (
    <SearchFilterField icon className="pal-search" placeholder={placeholder} value={search} onChange={setSearch} />
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

        {family === 'architecture' && (
          <div className="stack">
            <details className="fold" open>
              <summary><span className="fold-title">Corps</span></summary>
              <div className="fold-body stack">
                <button className="btn small btn-primary" onClick={onAddArchitectureBody}>Nouveau corps</button>
                {architectureBody && (
                  <>
                    <label className="ed-field">
                      Corps actif
                      <select value={architectureBody.id} onChange={(event) => onArchitectureBody(event.target.value)}>
                        {(scene.architecture ?? []).map((body, index) => (
                          <option key={`${body.id}:${index}`} value={body.id}>{body.label ?? body.id}</option>
                        ))}
                      </select>
                    </label>
                    <label className="ed-field">
                      Libellé
                      <input value={architectureBody.label ?? ''} onChange={(event) => onUpdateArchitectureBody({ label: event.target.value || undefined })} />
                    </label>
                    <label className="ed-field">
                      Style
                      <select value={architectureBody.style} onChange={(event) => onUpdateArchitectureBody({ style: event.target.value })}>
                        {!BUILDINGS_META[architectureBody.style] && <option value={architectureBody.style}>{architectureBody.style} (inconnu)</option>}
                        {Object.values(BUILDINGS_META).map((meta) => <option key={meta.id} value={meta.id}>{meta.label}</option>)}
                      </select>
                    </label>
                  </>
                )}
              </div>
            </details>

            <details className="fold" open>
              <summary><span className="fold-title">Étage et parties</span></summary>
              <div className="fold-body stack">
                {architectureBody && architectureStorey ? (
                  <>
                    <label className="ed-field">
                      Étage actif
                      <select value={architectureStorey.id} onChange={(event) => onArchitectureStorey(event.target.value)}>
                        {architectureBody.storeys.map((storey, index) => <option key={`${storey.id}:${index}`} value={storey.id}>{storey.id} · z {storey.z}</option>)}
                      </select>
                    </label>
                    <button className="btn small" onClick={onAddArchitecturePart}>Nouvelle partie</button>
                    <button
                      className="btn small"
                      title="Ajoute un étage au corps actif, à la couche juste au-dessus du plus haut étage existant"
                      onClick={onAddArchitectureStorey}
                    >
                      Nouvel étage
                    </button>
                  </>
                ) : <p className="hint">Créez d’abord un corps.</p>}
              </div>
            </details>

            <details className="fold" open>
              <summary><span className="fold-title">Façades et features</span></summary>
              <div className="fold-body stack">
                <button
                  className={`btn small${architectureAction === 'facade' ? ' btn-primary' : ''}`}
                  disabled={!architectureBody}
                  aria-pressed={architectureAction === 'facade'}
                  onClick={onArmFacade}
                >
                  Section de façade
                </button>
                <p className="hint">Activez puis cliquez une arête du plan. Une façade existante est sélectionnée avant toute création.</p>
              </div>
            </details>

            <details className="fold" open>
              <summary><span className="fold-title">Toitures</span></summary>
              <div className="fold-body">
                <button className="btn small" disabled={!architectureBody} onClick={onAddRoofSection}>Section de toiture</button>
              </div>
            </details>

            <details className="fold">
              <summary><span className="fold-title">Pièces révélées</span></summary>
              <div className="fold-body">
                <p className="hint">Sélectionnez une partie, une façade ou une toiture pour la relier aux zones intérieures dans l’inspecteur.</p>
              </div>
            </details>
          </div>
        )}

        {family === 'tile' && tool.mode === 'tile' && (
          <>
            <div className="mini-title">Pinceau</div>
            <OptionChooser
              layout="seg"
              options={[
                ...[1, 3, 5].map((n) => ({
                  key: String(n),
                  label: `${n}×${n}`,
                  selected: brush === n && !terrainRect,
                  onSelect: () => { setBrush(n); setTerrainRect(false); },
                })),
                { key: 'rect', label: '▭ Rect', title: 'Glisser pour remplir un rectangle', selected: terrainRect, onSelect: () => setTerrainRect(!terrainRect) },
              ]}
            />
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
            <OptionChooser
              layout="seg"
              options={WALL_PAINTS.map((wp) => ({
                key: wp.paint,
                label: <>{wp.icon} {wp.label}</>,
                title: wp.label,
                selected: tool.paint === wp.paint,
                onSelect: () => setTool({
                  mode: 'wall',
                  paint: wp.paint,
                  structure: wp.paint === 'door' ? lastDoorStructure : wp.paint === 'wall' ? lastWallStructure : undefined,
                }),
              }))}
            />
            <p className="hint">
              {tool.paint === 'wall' || tool.paint === 'door'
                ? 'Cliquez PRÈS d’une arête de case : l’arête surlignée prend la cloison/porte. Re-cliquer l’efface.'
                : 'Cliquez une case : la diagonale se pose en travers (éventail / paroi courbe). Re-cliquer l’efface.'}
            </p>
            {(tool.paint === 'wall' || tool.paint === 'door') && (
              <>
                <div className="mini-title">Matériau du mur</div>
                {searchBox('matériau…')}
                <div className="pal-list">
                  {filterByLabel(tool.paint === 'door' ? doorEdgeStructures : wallEdgeStructures, (s) => s.label, search).map((s) => (
                    <button
                      key={s.id}
                      className={`pal-item${tool.structure === s.id ? ' active' : ''}`}
                      onClick={() => {
                        if (tool.paint === 'door') setLastDoorStructure(s.id); else setLastWallStructure(s.id);
                        setTool({ mode: 'wall', paint: tool.paint, structure: s.id });
                      }}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <p className="hint">Le matériau CHOISI est porté par l'outil : chaque cloison/porte posée ensuite le reçoit directement (plus besoin de repasser par l'inspecteur).</p>
              </>
            )}
          </>
        )}

        {family === 'height' && tool.mode === 'height' && (
          <>
            <div className="mini-title">Pinceau</div>
            <OptionChooser
              layout="seg"
              options={[1, 3, 5].map((n) => ({ key: String(n), label: `${n}×${n}`, selected: brush === n, onSelect: () => setBrush(n) }))}
            />
            <div className="mini-title">Hauteur (mètres)</div>
            <OptionChooser
              layout="seg"
              options={HEIGHT_PRESETS.map((p) => ({
                key: p.label,
                label: <>{p.label} <span className="chip">{p.metres > 0 ? '+' : ''}{p.metres} m</span></>,
                selected: tool.metres === p.metres,
                onSelect: () => setTool({ mode: 'height', metres: p.metres }),
              }))}
            />
            <label className="mini-title" style={{ display: 'block' }}>
              Sur mesure
              <input type="number" step={0.5} value={tool.metres} onChange={(e) => setTool({ mode: 'height', metres: Number(e.target.value) })} style={{ width: '5rem', marginLeft: '0.5rem' }} />
            </label>
            <p className="hint">Peignez la hauteur RÉELLE des cases en mètres (surface surélevée, fosse d’orchestre). « Plat » remet à 0 ; la traversée à pied / en chute s’en déduit (cf. relief).</p>
          </>
        )}

        {family === 'crenellated' && tool.mode === 'crenellated' && (
          <>
            <div className="mini-title">Pinceau</div>
            <OptionChooser
              layout="seg"
              options={[1, 3, 5].map((n) => ({ key: String(n), label: `${n}×${n}`, selected: brush === n, onSelect: () => setBrush(n) }))}
            />
            <div className="mini-title">Structure du parapet</div>
            <OptionChooser
              layout="grid"
              options={[
                ...crenelStructures.map((s) => ({
                  key: s.id,
                  label: s.label,
                  selected: tool.structure === s.id,
                  onSelect: () => {
                    setLastCrenelStructure(s.id);
                    setTool({ mode: 'crenellated', structure: s.id });
                  },
                })),
                { key: '__erase', label: 'Gomme (effacer la marque)', selected: tool.structure === null, onSelect: () => setTool({ mode: 'crenellated', structure: null }) },
              ]}
            />
            <p className="hint">Peint la case comme portant un PARAPET crénelé — décoration de rendu (merlons de périmètre) : n'affecte ni passabilité ni ligne de vue. Combinez-le à l'outil <Icon id="map-tool/height" size="sm" /> Hauteur pour un rempart complet.</p>
          </>
        )}

        {family === 'personnage' && tool.mode === 'entity' && (
          <>
            <div className="mini-title">Personnage à poser</div>
            {searchBox('espèce…')}
            <div className="pal-list">
              {filterByLabel([{ id: '', label: 'Villageois' }, ...creatureSpeciesOptions()], (o) => o.label, search).map((o) => (
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
              {filterByLabel(Object.values(PROPS), (p) => p.label, search).map((p) => (
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

        {family === 'zone' && tool.mode === 'zone' && (
          <>
            <div className="mini-title">Type de zone</div>
            <OptionChooser
              layout="seg"
              options={[
                { key: 'trigger', label: <><Icon id="map-tool/zone" size="sm" /> Trigger — déclenche des effets quand le groupe y entre</>, selected: tool.zone === 'trigger', onSelect: () => setTool({ mode: 'zone', zone: 'trigger' }) },
                { key: 'rest', label: <><Icon id="rest/camp" size="sm" /> Zone de repos — offre de repos locale (auberge/maison/camp)</>, selected: tool.zone === 'rest', onSelect: () => setTool({ mode: 'zone', zone: 'rest' }) },
                { key: 'effect', label: <><Icon id="ui/warning" size="sm" /> Piège / hasard — Dégâts ou États à la traversée / au stationnement</>, selected: tool.zone === 'effect', onSelect: () => setTool({ mode: 'zone', zone: 'effect' }) },
              ]}
            />
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
              {filterByLabel(enemyCreatures, (c) => c.label, search).map((c) => (
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
              {filterByLabel(SIEGE_ENGINES, (t) => t.label, search).map((t) => (
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
