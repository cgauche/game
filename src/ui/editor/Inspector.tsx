import { Scene, SceneEntity, BuildingFeature, Trigger, EncounterDef } from '../../state/scene';
import type { Settlement } from '../../engine/disponibilite';
import { DEFS } from '../../gameIso/sprites';
import { hashSeed } from '../../gameIso/appearance';
import { SCENE_ANIMS } from '../../gameIso/sceneAnims';
import { pickBackend } from '../../gameIso/pickBackend';
import { creatureSpeciesNames } from '../../gameIso/rig/creatures';
import { BUILDINGS, BUILDINGS_META } from '../../gameIso/catalog/buildings';
import { PROPS } from '../../gameIso/catalog/decor';
import { perimeterTiles, defaultDoor } from '../../state/buildings';
import { MERCHANTS } from '../../state/merchants/index';
import { MonsterPartsFields } from './MonsterPartsFields';
import { ParamFields } from './ParamFields';
import { EffectList } from './EffectList';
import { EntityListPanel } from './EntityListPanel';
import { StatblockEditor, emptyStatblock } from './StatblockEditor';
import { propRefPatch } from './propDefaults';
import { KIND_LABEL } from './tools';

/**
 * Volet DROIT de l'éditeur : inspecteur du sélectionné — zone trigger, ennemi de rencontre
 * (spawn), bâtiment, entité (personnage/décor) — sinon l'aide + la liste des entités.
 * Composant de PRÉSENTATION : la sélection et la scène vivent dans Editor.
 */
export function Inspector({
  scene,
  otherScenes,
  setScene,
  enemyCreatures,
  sel,
  selected,
  updateSel,
  duplicateSel,
  onSelectEntity,
  selT,
  updateSelT,
  updateSelTRect,
  onDeselectTrigger,
  openTriggers,
  spawn,
  selectedSpawn,
  updateSpawn,
  deleteSpawn,
  onDeselectSpawn,
  selB,
  updateSelB,
  updateSelBParam,
  onDeselectBuilding,
  onSelectBuilding,
}: {
  scene: Scene;
  otherScenes: Scene[];
  setScene: (s: Scene) => void;
  enemyCreatures: { label: string }[];
  sel: SceneEntity | null;
  selected: string | null;
  updateSel: (patch: Partial<SceneEntity>) => void;
  duplicateSel: () => void;
  onSelectEntity: (id: string) => void;
  selT: Trigger | null;
  updateSelT: (patch: Partial<Trigger>) => void;
  updateSelTRect: (patch: Partial<Trigger['rect']>) => void;
  onDeselectTrigger: () => void;
  openTriggers: () => void;
  spawn: EncounterDef['enemies'][number] | null;
  selectedSpawn: { enc: number; idx: number } | null;
  updateSpawn: (patch: Partial<EncounterDef['enemies'][number]>) => void;
  deleteSpawn: () => void;
  onDeselectSpawn: () => void;
  selB: BuildingFeature | null;
  updateSelB: (patch: Partial<BuildingFeature>) => void;
  updateSelBParam: (key: string, value: unknown) => void;
  onDeselectBuilding: () => void;
  onSelectBuilding: (id: string) => void;
}) {
  return (
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
            <button className="btn small" onClick={openTriggers}>
              Éditer les effets ({selT.effects.length})
            </button>
            <button
              className="btn small danger"
              onClick={() => {
                setScene({ ...scene, triggers: scene.triggers.filter((x) => x.id !== selT.id) });
                onDeselectTrigger();
              }}
            >
              Supprimer
            </button>
            <button className="btn small" onClick={onDeselectTrigger}>
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
            <button className="btn small" onClick={onDeselectSpawn}>
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
                onDeselectBuilding();
              }}
            >
              Supprimer
            </button>
            <button className="btn small" onClick={onDeselectBuilding}>
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
                      ↳ Taux de rachat à la vente (override, ex. 0.5 = ½ si marchandé, ¼ sinon)
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
                    <label className="ed-field">
                      ↳ Majoration d'achat (override, 1 = prix listé ; 1.25 = +25 %)
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        placeholder="défaut archétype (1)"
                        value={sel.merchant.buyMarkup ?? ''}
                        onChange={(e) => updateSel({ merchant: { ...sel.merchant!, buyMarkup: e.target.value === '' ? undefined : Number(e.target.value) } })}
                      />
                    </label>
                    <label className="ed-field">
                      ↳ Réassort (jours, override — défaut 1)
                      <input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="défaut archétype (1 j)"
                        value={sel.merchant.restockDays ?? ''}
                        onChange={(e) => updateSel({ merchant: { ...sel.merchant!, restockDays: e.target.value === '' ? undefined : Number(e.target.value) } })}
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
                  <button key={b.id} className="btn small" onClick={() => onSelectBuilding(b.id)}>
                    {b.label ?? BUILDINGS_META[b.type]?.label ?? b.type} ({b.foot.x},{b.foot.y})
                  </button>
                ))}
              </div>
            </>
          )}
          <EntityListPanel
            entities={scene.entities}
            selectedId={selected}
            onSelect={onSelectEntity}
          />
        </>
      )}
    </aside>
  );
}
