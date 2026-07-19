/**
 * Inspecteur v2 — volet droit DOCKÉ (fini la modale du POC qui masquait le canvas) :
 * la sélection s'édite EN PLACE, en sections repliables `.fold`, pendant que la carte reste
 * visible. Rien de sélectionné → PROPRIÉTÉS DE LA SCÈNE (identité, dimensions, ambiance,
 * musique, repos, points d'entrée) + liste filtrable du contenu (sélection au clic).
 * Composant de PRÉSENTATION : la scène et la sélection vivent dans Editor.
 */
import { useState, type ReactNode } from 'react';
import { Scene, SceneEntity, Roof, RoofParams, Trigger, SceneEffectZone, WallSeg } from '../../state/scene';
import type { WorldMap } from '../../state/worldMap';
import type { Settlement } from '../../engine/disponibilite';
import { hashSeed } from '../../engine/dice';
import { SCENE_ANIMS } from '../../gameIso/sceneAnims';
import { pickBackend } from '../../gameIso/pickBackend';
import { creatureSpeciesOptions } from '../../gameIso/rig/creatures';
import { PROPS } from '../../gameIso/catalog/decor';
import { MERCHANTS } from '../../state/merchants/index';
import { allMusicDefs } from '../../audio/music';
import { findCreatureById, creatureLabel } from '../../data';
import { MonsterPartsFields } from './MonsterPartsFields';
import { effectCtxOf } from './EffectList';
import { GameOpEditor } from './GameOpEditor';
import { FlowEditor } from './FlowEditor';
import { EMPTY_FLOW } from '../../state/flow';
import { StatblockEditor, emptyStatblock } from './StatblockEditor';
import { CreatureProfile, OptionalTraitsPicker, SpellsField } from './OptionalTraitsPicker';
import { propRefPatch } from './propDefaults';
import { KIND_LABEL, Sel, ROOF_STYLES, ROOF_MATERIALS, deleteSel, renameEntry, addMember, removeMember, patchMember, effectZoneRect, flowEffects, SIEGE_ENGINES, setPosteCrew, setPosteSide, setPosteEngine, patchWall } from './editorState';
import type { FireArc } from '../../engine/types';
import { DIFFICULTY_LABELS } from '../../engine/types';
import { WhenEditor } from './ConditionEditor';
import { RefField } from '../compendium/RefField';
import { SearchFilterField, filterByLabel } from '../SearchFilterField';
import { Icon } from '../Icon';
import type { IconIdInput } from '../icons';

/** Section repliable de l'inspecteur (primitive .fold). */
function Fold({ title, open, children }: { title: ReactNode; open?: boolean; children: ReactNode }) {
  return (
    <details className="fold insp-fold" open={open}>
      <summary>
        <span className="fold-title">{title}</span>
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

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

const ENT_ICON: Record<string, IconIdInput> = { heroStart: 'map-tool/start-flag', personnage: 'map-tool/npc', prop: 'map-tool/prop' };
/** Icône d'entité — un emplacement de siège (entité portant un poste) prime sur l'icône de kind. */
const entIcon = (ent: SceneEntity): JSX.Element => (
  ent.postes?.length ? <Icon id="scenario/siege" size="sm" /> : ENT_ICON[ent.kind] ? <Icon id={ENT_ICON[ent.kind]} size="sm" /> : <>•</>
);

/** Arcs de tir d'un créneau directionnel (FireArc), libellés terrestres (relatifs au facing du chef de pièce). */
const FIRE_ARCS: { side: FireArc; label: string }[] = [
  { side: 'proue', label: 'Avant (proue)' },
  { side: 'tribord', label: 'Droite (tribord)' },
  { side: 'poupe', label: 'Arrière (poupe)' },
  { side: 'babord', label: 'Gauche (bâbord)' },
];

export function Inspector({
  scene,
  otherScenes,
  worldMap,
  setScene,
  sel,
  setSel,
  enemyCreatures,
  openLogic,
  resizeScene,
}: {
  scene: Scene;
  otherScenes: Scene[];
  /** Carte du monde du projet (id + label des lieux) pour `openPort` — absente ⇒ fallback texte. */
  worldMap: WorldMap | null;
  setScene: (s: Scene) => void;
  sel: Sel;
  setSel: (s: Sel) => void;
  enemyCreatures: { id: string; label: string }[];
  /** Ouvre le panneau Logique sur un onglet (+ élément). */
  openLogic: (tab: 'triggers' | 'dialogues' | 'encounters', id?: string) => void;
  resizeScene: (w: number, h: number) => void;
}) {
  const ent = sel?.type === 'entity' ? scene.entities.find((e) => e.id === sel.id) ?? null : null;
  const selR = sel?.type === 'roof' ? (scene.roofs ?? []).find((r) => r.id === sel.id) ?? null : null;
  const selT = sel?.type === 'trigger' ? scene.triggers.find((t) => t.id === sel.id) ?? null : null;
  const zone = sel?.type === 'restZone' ? scene.restZones?.[sel.idx] ?? null : null;
  const efz = sel?.type === 'effectZone' ? scene.effectZones?.[sel.idx] ?? null : null;
  const setEfz = (z: SceneEffectZone) => {
    if (sel?.type !== 'effectZone') return;
    setScene({ ...scene, effectZones: (scene.effectZones ?? []).map((x, i) => (i === sel.idx ? z : x)) });
  };
  const entry = sel?.type === 'entry' ? scene.entryPoints?.[sel.id] ?? null : null;
  const selW = sel?.type === 'wall' ? scene.walls?.find((w) => w.x === sel.x && w.y === sel.y && w.side === sel.side && (w.z ?? 0) === sel.z) ?? null : null;
  const patchSelW = (patch: Partial<WallSeg>) => {
    if (sel?.type !== 'wall') return;
    setScene(patchWall(scene, sel.x, sel.y, sel.side, sel.z, patch));
  };

  const updateSel = (patch: Partial<SceneEntity>) =>
    setScene({ ...scene, entities: scene.entities.map((e) => (ent && e.id === ent.id ? { ...e, ...patch } : e)) });
  const updateSelR = (patch: Partial<Roof>) =>
    setScene({ ...scene, roofs: (scene.roofs ?? []).map((r) => (selR && r.id === selR.id ? { ...r, ...patch } : r)) });
  const updateSelT = (patch: Partial<Trigger>) =>
    setScene({ ...scene, triggers: scene.triggers.map((t) => (selT && t.id === selT.id ? { ...t, ...patch } : t)) });
  const updateZone = (patch: Partial<NonNullable<Scene['restZones']>[number]>) => {
    if (sel?.type !== 'restZone') return;
    setScene({ ...scene, restZones: (scene.restZones ?? []).map((z, i) => (i === sel.idx ? { ...z, ...patch } : z)) });
  };
  const removeSel = () => {
    setScene(deleteSel(scene, sel));
    setSel(null);
  };

  const title = ent
    ? <>{entIcon(ent)} {ent.label ?? ent.ref ?? KIND_LABEL[ent.kind]}</>
    : selR
      ? <><Icon id="rest/home" size="sm" /> {selR.label ?? selR.style}</>
      : selT
        ? <><Icon id="map-tool/zone" size="sm" /> {selT.id}</>
        : zone
          ? <><Icon id="rest/camp" size="sm" /> Zone de repos</>
          : efz
            ? <><Icon id="ui/warning" size="sm" /> {efz.label || 'Piège'}</>
            : selW
              ? (selW.door ? <><Icon id="map-tool/door" size="sm" /> Porte</> : <><Icon id="map-tool/wall" size="sm" /> Cloison</>)
              : entry
                ? <><Icon id="nav/entry-point" size="sm" /> {sel?.type === 'entry' ? sel.id : ''}</>
                : null;

  return (
    <aside className="editor-inspector">
      {sel && title ? (
        <>
          <div className="insp-head">
            <span className="insp-title">{title}</span>
            <button className="btn small" onClick={() => setSel(null)} title="Désélectionner (Échap)">
              ✕
            </button>
          </div>

          {ent && <EntityPanel ent={ent} scene={scene} otherScenes={otherScenes} worldMap={worldMap} updateSel={updateSel} removeSel={removeSel} />}

          {ent && ent.kind === 'personnage' && (
            <Fold title={<><Icon id="action/attack" size="sm" /> Combat</>}>
              <p className="hint">Donne à ce personnage un rôle de COMBAT : profil, traits, et rattachement à une ou plusieurs rencontres. Un embusqué reste invisible jusqu'au combat.</p>
              <label className="ed-check">
                <input
                  type="checkbox"
                  checked={!!ent.combat?.hiddenUntilCombat}
                  onChange={(e) => updateSel({ combat: { ...ent.combat, hiddenUntilCombat: e.target.checked || undefined } })}
                />{' '}
                <Icon id="flag/hidden" size="sm" /> Embusqué (invisible hors combat)
              </label>
              {ent.statblock ? (
                <>
                  <StatblockEditor stat={ent.statblock} onChange={(sb) => updateSel({ statblock: sb })} />
                  <button className="btn small" onClick={() => updateSel({ statblock: undefined })}>↩ Utiliser une créature du bestiaire</button>
                </>
              ) : (
                <>
                  <label className="ed-field">
                    Créature (profil de combat)
                    <select value={ent.ref ?? ''} onChange={(e) => { const cid = e.target.value || undefined; updateSel({ ref: cid, label: ent.label ?? (cid ? creatureLabel(cid) : undefined) }); }}>
                      <option value="">— créature —</option>
                      {enemyCreatures.map((c) => (
                        <option key={c.id} value={c.id}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                  {(() => {
                    const cr = ent.ref ? findCreatureById(ent.ref) : undefined;
                    if (!cr) return null;
                    return (
                      <>
                        <CreatureProfile creature={cr} />
                        <OptionalTraitsPicker creature={cr} value={ent.combat?.optionals} onChange={(optionals) => updateSel({ combat: { ...ent.combat, optionals } })} />
                        <SpellsField value={ent.combat?.spells} onChange={(spells) => updateSel({ combat: { ...ent.combat, spells } })} />
                        <label className="ed-check" title="LDB 77 l.108 : « soustrayez -10 et ajoutez 2d10 ». Tirage stable au spawn (rejouable).">
                          <input
                            type="checkbox"
                            checked={ent.combat?.randomChars ?? false}
                            onChange={(e) => updateSel({ combat: { ...ent.combat, randomChars: e.target.checked || undefined } })}
                          />{' '}
                          <Icon id="nav/dice" size="sm" /> Caractéristiques aléatoires (LDB 77 l.108 : −10 + 2d10)
                        </label>
                      </>
                    );
                  })()}
                  <button className="btn small" onClick={() => updateSel({ statblock: emptyStatblock(ent.ref || ent.label || 'Ennemi') })}><Icon id="ui/settings" size="sm" /> Profil personnalisé…</button>
                </>
              )}
              <div className="mini-title">Rencontres</div>
              {scene.encounters.length === 0 && <p className="hint">Aucune rencontre — l'outil <Icon id="action/attack" size="sm" /> en crée une, ou utilisez le dock Logique.</p>}
              {scene.encounters.map((enc) => {
                const m = (enc.members ?? []).find((mm) => mm.entityId === ent.id);
                return (
                  <div key={enc.id} className="ed-subfield">
                    <label title="Enrôler ce personnage dans cette rencontre">
                      <input
                        type="checkbox"
                        checked={!!m}
                        onChange={(e) => setScene(e.target.checked ? addMember(scene, enc.id, ent.id).scene : removeMember(scene, enc.id, ent.id))}
                      />{' '}
                      {enc.id}
                    </label>
                    {m && (
                      <select value={m.side ?? 'enemy'} onChange={(e) => setScene(patchMember(scene, enc.id, ent.id, { side: e.target.value === 'ally' ? 'ally' : undefined }))}>
                        <option value="enemy">Ennemi</option>
                        <option value="ally">Allié</option>
                      </select>
                    )}
                  </div>
                );
              })}
            </Fold>
          )}

          {ent && !!ent.postes?.length && <EmplacementFold ent={ent} scene={scene} setScene={setScene} />}

          {selR && (
            <>
              <Fold title="Toit (bâtiment composé)" open>
                <p className="hint">Couverture d'un bâtiment composé. Ses MURS se tracent à l'outil <Icon id="map-tool/wall" size="sm" /> (cloison/porte/structure) : « bâtiment détruit » = ses murs abattus. L'intérieur est tout-en-scène (le toit se lève quand un allié entre dans l'empreinte).</p>
                <label className="ed-field">
                  Libellé
                  <input value={selR.label ?? ''} onChange={(e) => updateSelR({ label: e.target.value || undefined })} />
                </label>
                <p className="hint">
                  @ ({selR.foot.x}, {selR.foot.y}) · {selR.foot.w}×{selR.foot.h} — glisser sur la carte pour déplacer, poignée SE pour redimensionner.
                </p>
                <label className="ed-field">
                  Style
                  <select value={selR.style} onChange={(e) => updateSelR({ style: e.target.value })}>
                    {ROOF_STYLES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </label>
              </Fold>
              <Fold title="Couverture" open>
                <label className="ed-field">
                  Couverture
                  <select
                    value={selR.params?.roofMaterial ?? 'tuile'}
                    onChange={(e) => updateSelR({ params: { ...selR.params, roofMaterial: e.target.value as RoofParams['roofMaterial'] } })}
                  >
                    {ROOF_MATERIALS.map((m) => (
                      <option key={m.id} value={m.id}>{m.label}</option>
                    ))}
                  </select>
                </label>
              </Fold>
              <div className="insp-actions">
                <button className="btn small danger" onClick={removeSel}>
                  Supprimer
                </button>
              </div>
            </>
          )}

          {selT && (
            <>
              <Fold title="Zone trigger" open>
                <p className="hint">Déclenche ses effets quand le groupe entre dans le rectangle. Poignée au coin SE pour redimensionner.</p>
                <div className="ed-dim">
                  {(['x', 'y', 'w', 'h'] as const).map((k) => (
                    <label key={k}>
                      {k === 'w' ? 'L' : k === 'h' ? 'H' : k.toUpperCase()}
                      <input
                        type="number"
                        min={k === 'w' || k === 'h' ? 1 : 0}
                        value={selT.rect[k]}
                        onChange={(e) => updateSelT({ rect: { ...selT.rect, [k]: Math.max(k === 'w' || k === 'h' ? 1 : 0, Number(e.target.value)) } })}
                      />
                    </label>
                  ))}
                </div>
                <div className="ed-field">
                  <span>Condition de déclenchement</span>
                  <WhenEditor when={selT.when} onChange={(when) => updateSelT({ when })} />
                </div>
                <label className="ed-check">
                  <input type="checkbox" checked={selT.once ?? false} onChange={(e) => updateSelT({ once: e.target.checked })} /> Une seule fois
                </label>
              </Fold>
              <div className="insp-actions">
                <button className="btn small btn-primary" onClick={() => openLogic('triggers', selT.id)}>
                  <Icon id="ui/settings" size="sm" /> Effets ({flowEffects(selT.flow).length})…
                </button>
                <button className="btn small danger" onClick={removeSel}>
                  Supprimer
                </button>
              </div>
            </>
          )}

          {zone && (
            <>
              <Fold title="Zone de repos" open>
                <p className="hint">Offre de repos LOCALE (prioritaire sur celle de la scène quand le groupe s'y tient). Poignée au coin SE pour redimensionner.</p>
                <div className="ed-dim">
                  {(['x', 'y', 'w', 'h'] as const).map((k) => (
                    <label key={k}>
                      {k === 'w' ? 'L' : k === 'h' ? 'H' : k.toUpperCase()}
                      <input
                        type="number"
                        min={k === 'w' || k === 'h' ? 1 : 0}
                        value={zone.rect[k]}
                        onChange={(e) => updateZone({ rect: { ...zone.rect, [k]: Math.max(k === 'w' || k === 'h' ? 1 : 0, Number(e.target.value)) } })}
                      />
                    </label>
                  ))}
                </div>
                <div className="ed-rest-places">
                  {([['auberge', <><Icon id="rest/bed" size="sm" /> Auberge</>], ['maison', <><Icon id="rest/home" size="sm" /> Chez soi</>], ['camp', <><Icon id="rest/camp" size="sm" /> Camper</>]] as const).map(([k, label]) => (
                    <label key={k} className="ed-check">
                      <input type="checkbox" checked={zone.places[k] ?? false} onChange={(e) => updateZone({ places: { ...zone.places, [k]: e.target.checked } })} />
                      {label}
                    </label>
                  ))}
                  <label className="ed-check">
                    <input type="checkbox" checked={zone.quality === 'pietre'} onChange={(e) => updateZone({ quality: e.target.checked ? 'pietre' : undefined })} />
                    <Icon id="resource/gold-purse" size="sm" /> Piètre (½ prix, tambouille à risque)
                  </label>
                </div>
              </Fold>
              <div className="insp-actions">
                <button className="btn small danger" onClick={removeSel}>
                  Supprimer
                </button>
              </div>
            </>
          )}

          {efz && sel?.type === 'effectZone' && (() => {
            const r = effectZoneRect(efz.area);
            return (
              <>
                <Fold title="Piège / zone d'effet" open>
                  <p className="hint">Tout combattant qui TRAVERSE ou STATIONNE dans la zone y subit ses effets mécaniques (en combat). Poignée au coin SE pour redimensionner.</p>
                  <label className="ed-field">
                    Nom
                    <input value={efz.label} onChange={(e) => setEfz({ ...efz, label: e.target.value })} />
                  </label>
                  <div className="ed-dim">
                    {(['x', 'y', 'w', 'h'] as const).map((k) => (
                      <label key={k}>
                        {k === 'w' ? 'L' : k === 'h' ? 'H' : k.toUpperCase()}
                        <input
                          type="number"
                          min={k === 'w' || k === 'h' ? 1 : 0}
                          value={r[k]}
                          onChange={(e) => setEfz({ ...efz, area: { kind: 'rect', ...r, [k]: Math.max(k === 'w' || k === 'h' ? 1 : 0, Number(e.target.value)) } })}
                        />
                      </label>
                    ))}
                  </div>
                  <div className="mini-title"><Icon id="resource/movement" size="sm" /> À la traversée (effets mécaniques)</div>
                  <p className="hint">Dégâts mitigés BE+PA : op « Blessures », forme Dés, puis cocher « déduit BE / PA ». État entretenu : op « Poser un État » + paramètre <code>unlessCondition</code> (= le même État).</p>
                  <GameOpEditor ops={efz.onCross ?? []} onChange={(onCross) => setEfz({ ...efz, onCross: onCross.length ? onCross : undefined })} />
                  <div className="mini-title"><Icon id="ui/wait" size="sm" /> Au stationnement (chaque round)</div>
                  <GameOpEditor ops={efz.perRound ?? []} onChange={(perRound) => setEfz({ ...efz, perRound: perRound.length ? perRound : undefined })} />
                  <label className="ed-check">
                    <input type="checkbox" checked={!!efz.blocksLoS} onChange={(e) => setEfz({ ...efz, blocksLoS: e.target.checked || undefined })} />
                    <Icon id="ui/eye" size="sm" /> Masque la ligne de vue (fumée, ténèbres)
                  </label>
                  <label className="ed-check">
                    <input type="checkbox" checked={!!efz.barrier} onChange={(e) => setEfz({ ...efz, barrier: e.target.checked ? { blockGroups: efz.barrier?.blockGroups } : undefined })} />
                    <Icon id="mechanic/ward" size="sm" /> Barrière infranchissable (mur magique, cercle de ward)
                  </label>
                  {efz.barrier && (
                    <label className="ed-field">
                      Bloque les groupes (vide = tout le monde)
                      <input
                        value={(efz.barrier.blockGroups ?? []).join(', ')}
                        placeholder="Démon, Mort-vivant"
                        onChange={(e) => {
                          const blockGroups = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
                          setEfz({ ...efz, barrier: { blockGroups: blockGroups.length ? blockGroups : undefined } });
                        }}
                      />
                    </label>
                  )}
                </Fold>
                <div className="insp-actions">
                  <button className="btn small danger" onClick={removeSel}>
                    Supprimer
                  </button>
                </div>
              </>
            );
          })()}

          {selW && sel?.type === 'wall' && (
            <>
              <Fold title={selW.door ? <><Icon id="map-tool/door" size="sm" /> Porte</> : <><Icon id="map-tool/wall" size="sm" /> Cloison</>} open>
                <p className="hint">Arête @ ({sel.x},{sel.y}) {sel.side}{sel.z ? ` · étage ${sel.z}` : ''}.</p>
                <div className="ed-field">
                  <span>Type</span>
                  <div className="row-flex">
                    <button className={`btn small ${selW.door ? '' : 'btn-primary'}`} title="Cloison pleine (bloque vue et passage)" onClick={() => patchSelW({ door: undefined, closed: undefined })}>
                      ▮ Cloison
                    </button>
                    <button className={`btn small ${selW.door ? 'btn-primary' : ''}`} title="Arête franchissable (porte)" onClick={() => patchSelW({ door: true })}>
                      <Icon id="map-tool/door" size="sm" /> Porte
                    </button>
                  </div>
                </div>
                {selW.door && (
                  <label className="ed-check">
                    <input type="checkbox" checked={!!selW.closed} onChange={(e) => patchSelW({ closed: e.target.checked || undefined })} />
                    <Icon id="ui/lock" size="sm" /> Fermée au départ
                  </label>
                )}
                <RefField
                  cfg={{ ds: 'structures', single: true }}
                  fieldKey="Structure destructible"
                  value={selW.structure}
                  onChange={(v) => patchSelW({ structure: (v as string | null) || undefined })}
                  nullable
                />
                <p className="hint">Posée, l'arête tient (bloque vue + passage) jusqu'à être abattue en combat ; elle devient alors une brèche franchissable. « — (aucun) — » = pas de structure. La HAUTEUR d'un rempart se peint désormais à l'outil <Icon id="map-tool/height" size="sm" /> (hauteur des cases qu'il borde), plus de réglage par segment.</p>
                <div className="ed-field">
                  <span>Escaladable</span>
                  <div className="row-flex">
                    <button className={`btn small ${selW.climb ? '' : 'btn-primary'}`} title="Arête non grimpable" onClick={() => patchSelW({ climb: undefined })}>Non</button>
                    <button className={`btn small ${selW.climb?.kind === 'ladder' ? 'btn-primary' : ''}`} title="Échelle / surface facile : pas de Test (LDB 15 l.53)" onClick={() => patchSelW({ climb: { kind: 'ladder' } })}>Échelle</button>
                    <button className={`btn small ${selW.climb?.kind === 'surface' ? 'btn-primary' : ''}`} title="Paroi à prises : Test d'Escalade (LDB 15 l.57)" onClick={() => patchSelW({ climb: { kind: 'surface', ...(selW.climb?.kind === 'surface' ? selW.climb : {}) } })}>Paroi</button>
                  </div>
                </div>
                {selW.climb?.kind === 'surface' && (
                  <>
                    <div className="ed-field">
                      <span>Difficulté du Test</span>
                      <select value={selW.climb.difficulty ?? 'intermediaire'} onChange={(e) => patchSelW({ climb: { ...selW.climb!, difficulty: e.target.value as import('../../engine/types').Difficulty } })}>
                        {Object.entries(DIFFICULTY_LABELS).map(([k, lbl]) => (<option key={k} value={k}>{lbl}</option>))}
                      </select>
                    </div>
                    <label className="ed-check">
                      <input type="checkbox" checked={!!selW.climb.requiresGrimpeur} onChange={(e) => patchSelW({ climb: { ...selW.climb!, requiresGrimpeur: e.target.checked || undefined } })} />
                      Talent Grimpeur requis (LDB 15 l.57)
                    </label>
                  </>
                )}
                <p className="hint">Une arête escaladable borde deux surfaces de hauteurs différentes (falaise) : cliquer le marqueur pointillé grimpe vers la case d'en face. « Non » = mur/porte ordinaire.</p>
              </Fold>
              <div className="insp-actions">
                <button className="btn small danger" onClick={removeSel}>
                  Supprimer
                </button>
              </div>
            </>
          )}

          {entry && sel?.type === 'entry' && (
            <>
              <Fold title="Point d'entrée" open>
                <p className="hint">Cible nommée des transitions (« Vers scène @ entrée ») et des arrivées de voyage.</p>
                <EntryRename
                  key={sel.id}
                  label={sel.id}
                  onRename={(next) => {
                    const out = renameEntry(scene, sel.id, next);
                    if (out !== scene) {
                      setScene(out);
                      setSel({ type: 'entry', id: next.trim() });
                    }
                  }}
                />
                <div className="ed-dim">
                  <label>
                    X
                    <input
                      type="number"
                      value={entry.x}
                      onChange={(e) => setScene({ ...scene, entryPoints: { ...scene.entryPoints, [sel.id]: { ...entry, x: Number(e.target.value) } } })}
                    />
                  </label>
                  <label>
                    Y
                    <input
                      type="number"
                      value={entry.y}
                      onChange={(e) => setScene({ ...scene, entryPoints: { ...scene.entryPoints, [sel.id]: { ...entry, y: Number(e.target.value) } } })}
                    />
                  </label>
                </div>
              </Fold>
              <div className="insp-actions">
                <button className="btn small danger" onClick={removeSel}>
                  Supprimer
                </button>
              </div>
            </>
          )}
        </>
      ) : (
        <SceneProps scene={scene} setScene={setScene} setSel={setSel} resizeScene={resizeScene} />
      )}
    </aside>
  );
}

/** Renommage de point d'entrée — champ local appliqué au blur/Entrée (la clé doit rester unique). */
function EntryRename({ label, onRename }: { label: string; onRename: (next: string) => void }) {
  const [val, setVal] = useState(label);
  return (
    <label className="ed-field">
      Nom (référencé par les transitions)
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => val.trim() && val !== label && onRename(val)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
      />
    </label>
  );
}

/** Panneau d'une ENTITÉ sélectionnée (personnage / décor / départ héros). */
function EntityPanel({
  ent,
  scene,
  otherScenes,
  worldMap,
  updateSel,
  removeSel,
}: {
  ent: SceneEntity;
  scene: Scene;
  otherScenes: Scene[];
  worldMap: WorldMap | null;
  updateSel: (patch: Partial<SceneEntity>) => void;
  removeSel: () => void;
}) {
  return (
    <>
      <div className="ent-preview">
        <svg viewBox="0 0 120 150" width="84" height="105">
          {ent.kind === 'heroStart' ? (
            <text x="60" y="92" textAnchor="middle" fontSize="44" fill="#2ecc71">
              ★
            </text>
          ) : (
            // Aperçu unifié via le MÊME classifieur que le canvas (pickBackend).
            pickBackend({ kind: 'sceneEntity', ent }).body
          )}
        </svg>
        <span className="hint">
          {KIND_LABEL[ent.kind]} @ ({ent.pos.x}, {ent.pos.y})
        </span>
      </div>
      <Fold title="Identité" open>
        <label className="ed-field">
          Libellé
          <input value={ent.label ?? ''} onChange={(e) => updateSel({ label: e.target.value })} />
        </label>
        <label className="ed-field">
          Orientation
          <select value={ent.facing ?? 'S'} onChange={(e) => updateSel({ facing: e.target.value as SceneEntity['facing'] })}>
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
        {scene.layers.length > 1 && (
          <label className="ed-field">
            Couche
            <select value={ent.z ?? 0} onChange={(e) => { const v = Number(e.target.value); updateSel({ z: v || undefined }); }}>
              {[...scene.layers].sort((a, b) => a.z - b.z).map((l) => (
                <option key={l.z} value={l.z}>{l.z === 0 ? 'Base (0)' : `Couche ${l.z}`}</option>
              ))}
            </select>
          </label>
        )}
      </Fold>
      {ent.kind === 'personnage' && (
        <>
          <Fold title="Apparence" open>
            <label className="ed-field">
              Espèce (rig)
              {/* Espèce EXPLICITE de rendu (`appearance.species`) — découple l'apparence du nom/ref
                  (cf. scene.ts). Vide = bipède Humain par défaut. Le profil de stats se choisit via la
                  réf de créature (fold Rôle/Combat), distincte de l'apparence. */}
              <select value={ent.appearance?.species ?? ''} onChange={(e) => updateSel({ appearance: { ...ent.appearance, species: e.target.value || undefined } })}>
                <option value="">(par défaut : Humain)</option>
                {creatureSpeciesOptions().map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="ed-field">
              Animation d'ambiance
              <select value={ent.anim ?? ''} onChange={(e) => updateSel({ anim: e.target.value || undefined })}>
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
                onClick={() => updateSel({ appearance: { ...ent.appearance, seed: hashSeed(ent.id + ':' + Math.floor(performance.now())) } })}
              >
                <Icon id="nav/dice" size="sm" /> Relancer
              </button>
            </div>
            <MonsterPartsFields
              monster={ent.appearance?.monster}
              weapon={ent.weapon}
              colors={ent.appearance?.colors}
              sex={ent.appearance?.sex}
              build={ent.appearance?.build}
              parts={ent.appearance?.parts}
              tenue={ent.appearance?.tenue}
              onMonster={(patch) => updateSel({ appearance: { ...ent.appearance, monster: { ...(ent.appearance?.monster ?? {}), ...patch } } })}
              onWeapon={(w) => updateSel({ weapon: w })}
              onColors={(patch) => updateSel({ appearance: { ...ent.appearance, colors: { ...(ent.appearance?.colors ?? {}), ...patch } } })}
              onSex={(s) => updateSel({ appearance: { ...ent.appearance, sex: s } })}
              onBuild={(b) => updateSel({ appearance: { ...ent.appearance, build: b } })}
              onParts={(patch) => updateSel({ appearance: { ...ent.appearance, parts: { ...(ent.appearance?.parts ?? {}), ...patch } } })}
              onTenue={(c) => updateSel({ appearance: { ...ent.appearance, tenue: c } })}
              eyes={ent.appearance?.eyes}
              onEyes={(patch) => updateSel({ appearance: { ...ent.appearance, eyes: { ...(ent.appearance?.eyes ?? {}), ...patch } } })}
              features={ent.appearance?.features}
              onFeatures={(f) => updateSel({ appearance: { ...ent.appearance, features: f.length ? f : undefined } })}
            />
          </Fold>
          <Fold title="Rôle (dialogue, marchand)">
            <label className="ed-field">
              Dialogue / quête
              <select value={ent.dialogueId ?? ''} onChange={(e) => updateSel({ dialogueId: e.target.value || undefined })}>
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
              <select value={ent.merchant?.archetype ?? ''} onChange={(e) => updateSel({ merchant: e.target.value ? { ...ent.merchant, archetype: e.target.value } : undefined })}>
                <option value="">— aucun —</option>
                {Object.values(MERCHANTS).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>
            {ent.merchant && (
              <>
                <label className="ed-field">
                  ↳ Bourg (override Disponibilité)
                  <select
                    value={ent.merchant.settlement ?? ''}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, settlement: (e.target.value || undefined) as Settlement | undefined } })}
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
                    value={ent.merchant.resaleRate ?? ''}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, resaleRate: e.target.value === '' ? undefined : Number(e.target.value) } })}
                  />
                </label>
                <label className="ed-field">
                  ↳ Majoration d'achat (override, 1 = prix listé ; 1.25 = +25 %)
                  <input
                    type="number"
                    step="0.05"
                    min="0"
                    placeholder="défaut archétype (1)"
                    value={ent.merchant.buyMarkup ?? ''}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, buyMarkup: e.target.value === '' ? undefined : Number(e.target.value) } })}
                  />
                </label>
                <label className="ed-field">
                  ↳ Réassort (jours, override — défaut 1)
                  <input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="défaut archétype (1 j)"
                    value={ent.merchant.restockDays ?? ''}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, restockDays: e.target.value === '' ? undefined : Number(e.target.value) } })}
                  />
                </label>
                <label className="ed-field">
                  ↳ Système d'achat / vente (override, LDB 59 l.15)
                  <select
                    value={ent.merchant.marketMode ?? ''}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, marketMode: (e.target.value || undefined) as NonNullable<SceneEntity['merchant']>['marketMode'] } })}
                  >
                    <option value="">— (hériter du global) —</option>
                    <option value="complet">Complet (Disponibilité + Marchandage)</option>
                    <option value="sans-disponibilite">Sans Disponibilité (tout en stock)</option>
                    <option value="sans-marchandage">Sans Marchandage (prix fixes)</option>
                    <option value="simplifie">Simplifié (les deux désactivés)</option>
                  </select>
                </label>
                <label className="ed-field">
                  ↳ Guildes d'Artisans (override, LDB 60 l.38)
                  <select
                    value={ent.merchant.guild == null ? '' : String(ent.merchant.guild)}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, guild: e.target.value === '' ? undefined : e.target.value === 'true' } })}
                  >
                    <option value="">— (hériter du global) —</option>
                    <option value="true">Activées</option>
                    <option value="false">Désactivées</option>
                  </select>
                </label>
                <label className="ed-field">
                  ↳ Tenir les comptes (override, LDB 59 l.9)
                  <select
                    value={ent.merchant.tenirComptes == null ? '' : String(ent.merchant.tenirComptes)}
                    onChange={(e) => updateSel({ merchant: { ...ent.merchant!, tenirComptes: e.target.value === '' ? undefined : e.target.value === 'true' } })}
                  >
                    <option value="">— (hériter du global) —</option>
                    <option value="true">Activé</option>
                    <option value="false">Désactivé</option>
                  </select>
                </label>
              </>
            )}
          </Fold>
        </>
      )}
      {ent.kind === 'prop' && (
        <Fold title="Décor & interaction" open>
          <label className="ed-field">
            Décor
            <select value={ent.ref ?? 'tonneau'} onChange={(e) => updateSel(propRefPatch(e.target.value, !!ent.interact))}>
              {Object.values(PROPS).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="ed-field">
            Empreinte (cases L×H) — couvre/bloque toutes ses cases (1×1 = aucune)
            <span className="ed-foot-inputs">
              <input
                type="number"
                min={1}
                value={ent.foot?.w ?? 1}
                onChange={(e) => {
                  const w = Math.max(1, Number(e.target.value));
                  const h = ent.foot?.h ?? 1;
                  updateSel({ foot: w > 1 || h > 1 ? { w, h } : undefined });
                }}
              />
              <input
                type="number"
                min={1}
                value={ent.foot?.h ?? 1}
                onChange={(e) => {
                  const h = Math.max(1, Number(e.target.value));
                  const w = ent.foot?.w ?? 1;
                  updateSel({ foot: w > 1 || h > 1 ? { w, h } : undefined });
                }}
              />
            </span>
          </label>
          <label className="ed-check">
            <input
              type="checkbox"
              checked={!!ent.interact}
              onChange={(e) => updateSel({ interact: e.target.checked ? (ent.interact ?? { flow: EMPTY_FLOW }) : undefined })}
            />{' '}
            Interactif (fouille / ramassage)
          </label>
          {ent.interact && (
            <>
              <label className="ed-check">
                <input
                  type="checkbox"
                  checked={!!ent.interact.consume}
                  onChange={(e) => updateSel({ interact: { ...ent.interact!, consume: e.target.checked } })}
                />{' '}
                Disparaît quand pris (butin) — sinon reste, fouillé une fois
              </label>
              <div className="ed-field">
                <span className="mini-title">Fouille / ramassage (effets · conditions · tests)</span>
                <FlowEditor
                  flow={ent.interact.flow}
                  onChange={(flow) => updateSel({ interact: { ...ent.interact!, flow } })}
                  ctx={{ encounters: scene.encounters, dialogues: scene.dialogues, ...effectCtxOf(scene, otherScenes, worldMap ?? undefined) }}
                />
              </div>
            </>
          )}
        </Fold>
      )}
      <div className="insp-actions">
        <button className="btn small danger" onClick={removeSel}>
          Supprimer
        </button>
      </div>
    </>
  );
}

/** Emplacement de siège — édite le poste UNIQUE porté par l'entité (engin, créneau, équipage) EN PLACE
 *  (doctrine éditeur v2, pas de modale) ; chaque changement passe par `setScene` → undo global. */
function EmplacementFold({ ent, scene, setScene }: { ent: SceneEntity; scene: Scene; setScene: (s: Scene) => void }) {
  const poste = ent.postes![0];
  const directional = !!poste.side;
  return (
    <Fold title={<><Icon id="scenario/siege" size="sm" /> Emplacement de siège</>} open>
      <p className="hint">Pièce d'artillerie servie par un équipage. Enrôlez l'emplacement ET ses servants dans une rencontre (fold <Icon id="action/attack" size="sm" /> Combat) ; au combat, le chef (1ᵉʳ servant) sert la pièce et tire.</p>
      <label className="ed-field">
        Engin
        <select value={poste.trappingId ?? poste.item?.trappingId ?? ''} onChange={(e) => setScene(setPosteEngine(scene, ent.id, e.target.value))}>
          {SIEGE_ENGINES.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
      </label>
      <div className="ed-field">
        <span>Créneau de tir</span>
        <div className="row-flex">
          <button className={`btn small ${directional ? '' : 'btn-primary'}`} title="Pivot libre — tire dans toutes les directions" onClick={() => setScene(setPosteSide(scene, ent.id, undefined))}>
            ↻ Omni
          </button>
          <button className={`btn small ${directional ? 'btn-primary' : ''}`} title="Arc fixe, relatif à l'orientation-monde du chef de pièce" onClick={() => setScene(setPosteSide(scene, ent.id, poste.side ?? 'proue'))}>
            → Directionnel
          </button>
        </div>
      </div>
      {directional && (
        <label className="ed-field">
          Arc (relatif au cap du chef de pièce)
          <select value={poste.side} onChange={(e) => setScene(setPosteSide(scene, ent.id, e.target.value as FireArc))}>
            {FIRE_ARCS.map((a) => (
              <option key={a.side} value={a.side}>{a.label}</option>
            ))}
          </select>
        </label>
      )}
      <CrewPicker ent={ent} scene={scene} setScene={setScene} />
    </Fold>
  );
}

/** Équipage du poste = picker multi-réf des SceneEntity-personnages (JAMAIS d'id tapé), ordre = chef en
 *  tête (`crewIds[0]`). Promotion par ▲, retrait par ✕ ; candidats = autres personnages de la scène. */
function CrewPicker({ ent, scene, setScene }: { ent: SceneEntity; scene: Scene; setScene: (s: Scene) => void }) {
  const crew = ent.postes![0].crewIds ?? [];
  const candidates = scene.entities.filter((e) => e.kind === 'personnage' && e.id !== ent.id);
  const labelOf = (id: string) => {
    const e = scene.entities.find((x) => x.id === id);
    return e ? e.label ?? e.ref ?? e.id : `${id} (supprimé)`;
  };
  const setCrew = (next: string[]) => setScene(setPosteCrew(scene, ent.id, next));
  const addable = candidates.filter((c) => !crew.includes(c.id));
  return (
    <div className="ed-field">
      <span>Équipage <em className="de-hint">(le 1ᵉʳ = chef de pièce ★)</em></span>
      {crew.map((id, i) => (
        <div key={`${id}-${i}`} className="de-reflrow">
          <span className="chip" title={i === 0 ? 'Chef de pièce' : `Servant ${i + 1}`}>{i === 0 ? '★' : i + 1}</span>
          <select value={id} onChange={(e) => setCrew(crew.map((c, j) => (j === i ? e.target.value : c)))}>
            {!candidates.some((c) => c.id === id) && <option value={id}>{labelOf(id)}</option>}
            {candidates.map((c) => (
              <option key={c.id} value={c.id} disabled={crew.includes(c.id) && c.id !== id}>
                {c.label ?? c.ref ?? c.id}
              </option>
            ))}
          </select>
          <button className="btn small" title="Promouvoir (vers le chef)" disabled={i === 0} onClick={() => { const n = [...crew]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; setCrew(n); }}>
            ▲
          </button>
          <button className="btn small danger" title="Retirer du poste" onClick={() => setCrew(crew.filter((_, j) => j !== i))}>
            ✕
          </button>
        </div>
      ))}
      {addable.length > 0 ? (
        <button className="btn small" onClick={() => setCrew([...crew, addable[0].id])}>+ Affecter un servant</button>
      ) : candidates.length === 0 ? (
        <p className="hint">Posez des personnages (servants) sur la carte, puis affectez-les ici.</p>
      ) : null}
      {crew.length > 0 && (
        <p className="hint">
          Un servant affecté ici GARDE sa position sur la carte : la formation en anneau (ADE II 8 l.258)
          ne se pose automatiquement qu'au spawn de combat, et seulement si sa position COÏNCIDE encore avec
          celle de la pièce (un placement d'auteur distinct n'est jamais déplacé, #255). Pour une formation
          visible dès l'éditeur, posez le servant sur la case de la pièce avant de l'affecter, ou déplacez-le
          vous-même autour après affectation.
        </p>
      )}
    </div>
  );
}

/** Propriétés de la SCÈNE (rien de sélectionné) + liste filtrable du contenu. */
function SceneProps({
  scene,
  setScene,
  setSel,
  resizeScene,
}: {
  scene: Scene;
  setScene: (s: Scene) => void;
  setSel: (s: Sel) => void;
  resizeScene: (w: number, h: number) => void;
}) {
  const [filter, setFilter] = useState('');
  const ents = filterByLabel(scene.entities, (e) => `${e.label ?? ''} ${e.ref ?? ''} ${e.id}`, filter);
  const roofs = filterByLabel(scene.roofs ?? [], (r) => `${r.label ?? ''} ${r.style} ${r.id}`, filter);
  const entries = filterByLabel(Object.entries(scene.entryPoints ?? {}), ([name]) => name, filter);
  return (
    <>
      <div className="insp-head">
        <span className="insp-title"><Icon id="file/document" size="sm" /> {scene.nom || scene.id}</span>
      </div>
      <Fold title="Identité" open>
        <label className="ed-field">
          Identifiant (référencé par les transitions et la carte du monde)
          <input value={scene.id} onChange={(e) => setScene({ ...scene, id: e.target.value })} />
        </label>
        <label className="ed-field">
          Nom
          <input value={scene.nom} onChange={(e) => setScene({ ...scene, nom: e.target.value })} />
        </label>
        <label className="ed-field">
          Description (notes d'auteur)
          <textarea value={scene.description ?? ''} onChange={(e) => setScene({ ...scene, description: e.target.value })} />
        </label>
        <div className="ed-dim">
          <label>
            L
            <input type="number" value={scene.dimensions.w} min={5} max={40} onChange={(e) => resizeScene(Number(e.target.value) || 5, scene.dimensions.h)} />
          </label>
          <label>
            H
            <input type="number" value={scene.dimensions.h} min={5} max={40} onChange={(e) => resizeScene(scene.dimensions.w, Number(e.target.value) || 5)} />
          </label>
        </div>
      </Fold>
      <Fold title="Ambiance & météo">
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
      </Fold>
      <Fold title="Repos sur place">
        <p className="hint">Offre du bouton <Icon id="time/night" size="sm" /> d'exploration. Affinable PAR ZONE : outil <Icon id="map-tool/zone" size="sm" /> → Zone de repos (dessinée sur la carte).</p>
        <div className="ed-rest-places">
          {([['auberge', <><Icon id="rest/bed" size="sm" /> Auberge</>], ['maison', <><Icon id="rest/home" size="sm" /> Chez soi</>], ['camp', <><Icon id="rest/camp" size="sm" /> Camper</>]] as const).map(([k, label]) => (
            <label key={k} className="ed-check">
              <input
                type="checkbox"
                checked={(scene.rest ?? { camp: true })[k] ?? false}
                onChange={(e) => setScene({ ...scene, rest: { ...(scene.rest ?? { camp: true }), [k]: e.target.checked } })}
              />
              {label}
            </label>
          ))}
          <label className="ed-check">
            <input
              type="checkbox"
              checked={scene.rest?.quality === 'pietre'}
              onChange={(e) => setScene({ ...scene, rest: { ...(scene.rest ?? { camp: true }), quality: e.target.checked ? 'pietre' : undefined } })}
            />
            <Icon id="resource/gold-purse" size="sm" /> Piètre (½ prix, tambouille à risque)
          </label>
        </div>
        {(scene.restZones ?? []).length > 0 && (
          <div className="stack">
            {(scene.restZones ?? []).map((z, i) => (
              <button key={i} className="listrow insp-row" onClick={() => setSel({ type: 'restZone', idx: i })}>
                <span className="lr-name"><Icon id="rest/camp" size="sm" /> Zone ({z.rect.x},{z.rect.y}) {z.rect.w}×{z.rect.h}</span>
              </button>
            ))}
          </div>
        )}
      </Fold>
      <Fold title={`Points d'entrée (${Object.keys(scene.entryPoints ?? {}).length})`}>
        <p className="hint">Cibles nommées des transitions. Posez-en avec l'outil <Icon id="nav/entry-point" size="sm" />.</p>
        <div className="stack">
          {Object.entries(scene.entryPoints ?? {}).map(([name, pos]) => (
            <button key={name} className="listrow insp-row" onClick={() => setSel({ type: 'entry', id: name })}>
              <span className="lr-name"><Icon id="nav/entry-point" size="sm" /> {name}</span>
              <span className="chip">
                ({pos.x},{pos.y})
              </span>
            </button>
          ))}
        </div>
      </Fold>
      <Fold title={`Contenu (${scene.entities.length + (scene.roofs ?? []).length})`}>
        <SearchFilterField icon className="pal-search" placeholder="filtrer…" value={filter} onChange={setFilter} />
        <div className="stack insp-content">
          {roofs.map((r) => (
            <button key={r.id} className="listrow insp-row" onClick={() => setSel({ type: 'roof', id: r.id })}>
              <span className="lr-name"><Icon id="rest/home" size="sm" /> {r.label ?? r.style}</span>
              <span className="chip">
                ({r.foot.x},{r.foot.y})
              </span>
            </button>
          ))}
          {ents.map((e) => (
            <button key={e.id} className="listrow insp-row" onClick={() => setSel({ type: 'entity', id: e.id })}>
              <span className="lr-name">
                {entIcon(e)} {e.label ?? e.ref ?? e.id}
              </span>
              <span className="chip">
                ({e.pos.x},{e.pos.y})
              </span>
            </button>
          ))}
          {entries.map(([name, pos]) => (
            <button key={name} className="listrow insp-row" onClick={() => setSel({ type: 'entry', id: name })}>
              <span className="lr-name"><Icon id="nav/entry-point" size="sm" /> {name}</span>
              <span className="chip">
                ({pos.x},{pos.y})
              </span>
            </button>
          ))}
        </div>
      </Fold>
    </>
  );
}
