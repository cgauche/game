/**
 * Inspecteur v2 — volet droit DOCKÉ (fini la modale du POC qui masquait le canvas) :
 * la sélection s'édite EN PLACE, en sections repliables `.fold`, pendant que la carte reste
 * visible. Rien de sélectionné → PROPRIÉTÉS DE LA SCÈNE (identité, dimensions, ambiance,
 * musique, repos, points d'entrée) + liste filtrable du contenu (sélection au clic).
 * Composant de PRÉSENTATION : la scène et la sélection vivent dans Editor.
 */
import { useState, type ReactNode } from 'react';
import { Scene, SceneEntity, BuildingFeature, Trigger, SceneEffectZone } from '../../state/scene';
import type { ZoneEffect } from '../../engine/zones';
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
import { allMusicDefs } from '../../audio/music';
import { findCreature } from '../../data';
import { MonsterPartsFields } from './MonsterPartsFields';
import { ParamFields } from './ParamFields';
import { EffectList, effectCtxOf } from './EffectList';
import { StatblockEditor, emptyStatblock } from './StatblockEditor';
import { CreatureProfile, OptionalTraitsPicker, SpellsField } from './OptionalTraitsPicker';
import { propRefPatch } from './propDefaults';
import { KIND_LABEL, Sel, deleteSel, renameEntry, addMember, removeMember, patchMember, effectZoneRect, whenFlag, whenWindow, buildWhen, flowEffects } from './editorState';

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

const ENT_ICON: Record<string, string> = { heroStart: '🏁', personnage: '🙂', prop: '🌳' };

export function Inspector({
  scene,
  otherScenes,
  setScene,
  sel,
  setSel,
  enemyCreatures,
  openLogic,
  resizeScene,
}: {
  scene: Scene;
  otherScenes: Scene[];
  setScene: (s: Scene) => void;
  sel: Sel;
  setSel: (s: Sel) => void;
  enemyCreatures: { label: string }[];
  /** Ouvre le panneau Logique sur un onglet (+ élément). */
  openLogic: (tab: 'triggers' | 'dialogues' | 'encounters', id?: string) => void;
  resizeScene: (w: number, h: number) => void;
}) {
  const ent = sel?.type === 'entity' ? scene.entities.find((e) => e.id === sel.id) ?? null : null;
  const selB = sel?.type === 'building' ? (scene.buildings ?? []).find((b) => b.id === sel.id) ?? null : null;
  const selT = sel?.type === 'trigger' ? scene.triggers.find((t) => t.id === sel.id) ?? null : null;
  const zone = sel?.type === 'restZone' ? scene.restZones?.[sel.idx] ?? null : null;
  const efz = sel?.type === 'effectZone' ? scene.effectZones?.[sel.idx] ?? null : null;
  const setEfz = (z: SceneEffectZone) => {
    if (sel?.type !== 'effectZone') return;
    setScene({ ...scene, effectZones: (scene.effectZones ?? []).map((x, i) => (i === sel.idx ? z : x)) });
  };
  const entry = sel?.type === 'entry' ? scene.entryPoints?.[sel.id] ?? null : null;

  const updateSel = (patch: Partial<SceneEntity>) =>
    setScene({ ...scene, entities: scene.entities.map((e) => (ent && e.id === ent.id ? { ...e, ...patch } : e)) });
  const updateSelB = (patch: Partial<BuildingFeature>) =>
    setScene({ ...scene, buildings: (scene.buildings ?? []).map((b) => (selB && b.id === selB.id ? { ...b, ...patch } : b)) });
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
    ? `${ENT_ICON[ent.kind] ?? '•'} ${ent.label ?? ent.ref ?? KIND_LABEL[ent.kind]}`
    : selB
      ? `🏠 ${selB.label ?? BUILDINGS_META[selB.type]?.label ?? selB.type}`
      : selT
        ? `🟦 ${selT.id}`
        : zone
          ? '⛺ Zone de repos'
          : efz
            ? `⚠️ ${efz.label || 'Piège'}`
            : entry
              ? `⚑ ${sel?.type === 'entry' ? sel.id : ''}`
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

          {ent && <EntityPanel ent={ent} scene={scene} otherScenes={otherScenes} updateSel={updateSel} removeSel={removeSel} />}

          {ent && ent.kind === 'personnage' && (
            <Fold title="⚔️ Combat">
              <p className="hint">Donne à ce personnage un rôle de COMBAT : profil, traits, et rattachement à une ou plusieurs rencontres. Un embusqué reste invisible jusqu'au combat.</p>
              <label className="ed-check">
                <input
                  type="checkbox"
                  checked={!!ent.combat?.hiddenUntilCombat}
                  onChange={(e) => updateSel({ combat: { ...ent.combat, hiddenUntilCombat: e.target.checked || undefined } })}
                />{' '}
                🥷 Embusqué (invisible hors combat)
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
                    <select value={ent.ref ?? ''} onChange={(e) => updateSel({ ref: e.target.value || undefined, label: ent.label ?? e.target.value })}>
                      <option value="">— créature —</option>
                      {enemyCreatures.map((c) => (
                        <option key={c.label} value={c.label}>{c.label}</option>
                      ))}
                    </select>
                  </label>
                  {(() => {
                    const cr = ent.ref ? findCreature(ent.ref) : undefined;
                    if (!cr) return null;
                    return (
                      <>
                        <CreatureProfile creature={cr} />
                        <OptionalTraitsPicker creature={cr} value={ent.combat?.optionals} onChange={(optionals) => updateSel({ combat: { ...ent.combat, optionals } })} />
                        <SpellsField value={ent.combat?.spells} onChange={(spells) => updateSel({ combat: { ...ent.combat, spells } })} />
                        <label className="ed-check" title="LDB 78 : « soustrayez -10 et ajoutez 2d10 ». Tirage stable au spawn (rejouable).">
                          <input
                            type="checkbox"
                            checked={ent.combat?.randomChars ?? false}
                            onChange={(e) => updateSel({ combat: { ...ent.combat, randomChars: e.target.checked || undefined } })}
                          />{' '}
                          🎲 Caractéristiques aléatoires (LDB 78 : −10 + 2d10)
                        </label>
                      </>
                    );
                  })()}
                  <button className="btn small" onClick={() => updateSel({ statblock: emptyStatblock(ent.ref || ent.label || 'Ennemi') })}>⚙️ Profil personnalisé…</button>
                </>
              )}
              <div className="mini-title">Rencontres</div>
              {scene.encounters.length === 0 && <p className="hint">Aucune rencontre — l'outil ⚔️ en crée une, ou utilisez le dock Logique.</p>}
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

          {selB && (
            <>
              <Fold title="Identité & porte" open>
                <label className="ed-field">
                  Libellé
                  <input value={selB.label ?? ''} onChange={(e) => updateSelB({ label: e.target.value })} />
                </label>
                <p className="hint">
                  @ ({selB.foot.x}, {selB.foot.y}) · {selB.foot.w}×{selB.foot.h} — glisser sur la carte pour déplacer.
                </p>
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
              </Fold>
              <Fold title="Révélation & intérieur" open>
                <label className="ed-field">
                  Révélation
                  <select value={selB.reveal} onChange={(e) => updateSelB({ reveal: e.target.value as BuildingFeature['reveal'] })}>
                    <option value="cutaway">Toit qui se lève (intérieur in-scene)</option>
                    <option value="door">Façade pleine + porte → intérieur</option>
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
                      Point d'arrivée (entry de la scène d'intérieur)
                      <select value={selB.entry ?? ''} onChange={(e) => updateSelB({ entry: e.target.value || undefined })}>
                        <option value="">— départ par défaut —</option>
                        {Object.keys([scene, ...otherScenes].find((s) => s.id === selB.interiorScene)?.entryPoints ?? {}).map((en) => (
                          <option key={en} value={en}>
                            {en}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
              </Fold>
              {(BUILDINGS[selB.type]?.paramsSchema ?? []).length > 0 && (
                <Fold title="Paramètres">
                  <ParamFields
                    schema={BUILDINGS[selB.type]?.paramsSchema ?? []}
                    values={(selB.params ?? {}) as Record<string, unknown>}
                    onChange={(key, value) =>
                      setScene({
                        ...scene,
                        buildings: (scene.buildings ?? []).map((b) => (b.id === selB.id ? { ...b, params: { ...b.params, [key]: value } } : b)),
                      })
                    }
                  />
                </Fold>
              )}
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
                <label className="ed-field">
                  Condition (flag ; « ! » pour nié)
                  <input value={whenFlag(selT.when)} onChange={(e) => updateSelT({ when: buildWhen(e.target.value, whenWindow(selT.when)) })} />
                </label>
                <label className="ed-check">
                  <input type="checkbox" checked={selT.once ?? false} onChange={(e) => updateSelT({ once: e.target.checked })} /> Une seule fois
                </label>
              </Fold>
              <div className="insp-actions">
                <button className="btn small btn-primary" onClick={() => openLogic('triggers', selT.id)}>
                  ⚙ Effets ({flowEffects(selT.flow).length})…
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
                  {([['auberge', '🛏 Auberge'], ['maison', '🏠 Chez soi'], ['camp', '⛺ Camper']] as const).map(([k, label]) => (
                    <label key={k} className="ed-check">
                      <input type="checkbox" checked={zone.places[k] ?? false} onChange={(e) => updateZone({ places: { ...zone.places, [k]: e.target.checked } })} />
                      {label}
                    </label>
                  ))}
                  <label className="ed-check">
                    <input type="checkbox" checked={zone.quality === 'pietre'} onChange={(e) => updateZone({ quality: e.target.checked ? 'pietre' : undefined })} />
                    💸 Piètre (½ prix, tambouille à risque)
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
            const eff = efz.onCross ?? efz.perRound;
            const dmg = typeof eff?.damage?.amount === 'number' ? eff.damage.amount : 0;
            const ignoreAP = !!eff?.damage?.ignoreAP;
            const condStr = (eff?.conditions ?? []).map((c) => c.name).join(', ');
            const buildEff = (d: number, iap: boolean, cs: string): ZoneEffect => {
              const conditions = cs.split(',').map((s) => s.trim()).filter(Boolean).map((name) => ({ name }));
              const e: ZoneEffect = {};
              if (d > 0) e.damage = { amount: d, ignoreAP: iap };
              if (conditions.length) e.conditions = conditions;
              return e;
            };
            const apply = (onCross: boolean, perRound: boolean, e: ZoneEffect) =>
              setEfz({ ...efz, onCross: onCross ? e : undefined, perRound: perRound ? e : undefined });
            return (
              <>
                <Fold title="Piège / zone d'effet" open>
                  <p className="hint">Tout combattant qui TRAVERSE ou STATIONNE dans la zone y subit l'effet (en combat). Poignée au coin SE pour redimensionner.</p>
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
                  <div className="mini-title">Déclenchement</div>
                  <label className="ed-check">
                    <input type="checkbox" checked={!!efz.onCross} onChange={(e) => apply(e.target.checked, !!efz.perRound, buildEff(dmg, ignoreAP, condStr))} />
                    🚶 À la traversée
                  </label>
                  <label className="ed-check">
                    <input type="checkbox" checked={!!efz.perRound} onChange={(e) => apply(!!efz.onCross, e.target.checked, buildEff(dmg, ignoreAP, condStr))} />
                    ⏱ Au stationnement (chaque round)
                  </label>
                  <label className="ed-field">
                    Dégâts
                    <input type="number" min={0} value={dmg} onChange={(e) => apply(!!efz.onCross || !efz.perRound, !!efz.perRound, buildEff(Math.max(0, Number(e.target.value)), ignoreAP, condStr))} />
                  </label>
                  <label className="ed-check">
                    <input type="checkbox" checked={ignoreAP} onChange={(e) => apply(!!efz.onCross, !!efz.perRound, buildEff(dmg, e.target.checked, condStr))} />
                    Ignore l'armure
                  </label>
                  <label className="ed-field">
                    États infligés (séparés par des virgules)
                    <input value={condStr} placeholder="Empoisonné, En flammes" onChange={(e) => apply(!!efz.onCross || !efz.perRound, !!efz.perRound, buildEff(dmg, ignoreAP, e.target.value))} />
                  </label>
                  <label className="ed-check">
                    <input type="checkbox" checked={!!efz.blocksLoS} onChange={(e) => setEfz({ ...efz, blocksLoS: e.target.checked || undefined })} />
                    🌫 Masque la ligne de vue (fumée, ténèbres)
                  </label>
                  <label className="ed-check">
                    <input type="checkbox" checked={!!efz.barrier} onChange={(e) => setEfz({ ...efz, barrier: e.target.checked ? { blockGroups: efz.barrier?.blockGroups } : undefined })} />
                    🧱 Barrière infranchissable (mur magique, cercle de ward)
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

          {entry && sel?.type === 'entry' && (
            <>
              <Fold title="Point d'entrée" open>
                <p className="hint">Cible nommée des transitions (« Vers scène @ entrée ») et des arrivées de voyage.</p>
                <EntryRename
                  key={sel.id}
                  name={sel.id}
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
function EntryRename({ name, onRename }: { name: string; onRename: (next: string) => void }) {
  const [val, setVal] = useState(name);
  return (
    <label className="ed-field">
      Nom (référencé par les transitions)
      <input
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => val.trim() && val !== name && onRename(val)}
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
  updateSel,
  removeSel,
}: {
  ent: SceneEntity;
  scene: Scene;
  otherScenes: Scene[];
  updateSel: (patch: Partial<SceneEntity>) => void;
  removeSel: () => void;
}) {
  return (
    <>
      <div className="ent-preview">
        <svg viewBox="0 0 120 150" width="84" height="105">
          <defs dangerouslySetInnerHTML={{ __html: DEFS }} />
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
        {scene.levels.length > 1 && (
          <label className="ed-field">
            Étage
            <select value={ent.z ?? 0} onChange={(e) => { const v = Number(e.target.value); updateSel({ z: v || undefined }); }}>
              {[...scene.levels].sort((a, b) => a.z - b.z).map((l) => (
                <option key={l.z} value={l.z}>{l.z === 0 ? 'Sol (0)' : `Étage ${l.z}`}</option>
              ))}
            </select>
          </label>
        )}
      </Fold>
      {ent.kind === 'personnage' && (
        <>
          <Fold title="Apparence" open>
            <label className="ed-field">
              Espèce / apparence
              <select value={ent.ref ?? 'Villageois'} onChange={(e) => updateSel({ ref: e.target.value })}>
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
                🎲 Relancer
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
                  <option key={a.name} value={a.name}>
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
              onChange={(e) => updateSel({ interact: e.target.checked ? (ent.interact ?? { effects: [] }) : undefined })}
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
                <span className="mini-title">Effets de la fouille / du ramassage</span>
                <EffectList
                  effects={ent.interact.effects}
                  onChange={(eff) => updateSel({ interact: { ...ent.interact!, effects: eff } })}
                  ctx={{ encounters: scene.encounters, dialogues: scene.dialogues, ...effectCtxOf(scene, otherScenes) }}
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
  const f = filter.toLowerCase();
  const ents = scene.entities.filter((e) => `${e.label ?? ''} ${e.ref ?? ''} ${e.id}`.toLowerCase().includes(f));
  const builds = (scene.buildings ?? []).filter((b) => `${b.label ?? ''} ${b.type} ${b.id}`.toLowerCase().includes(f));
  const entries = Object.entries(scene.entryPoints ?? {}).filter(([name]) => name.toLowerCase().includes(f));
  return (
    <>
      <div className="insp-head">
        <span className="insp-title">📄 {scene.nom || scene.id}</span>
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
        <p className="hint">Offre du bouton 🌙 d'exploration. Affinable PAR ZONE : outil 🟦 → Zone de repos (dessinée sur la carte).</p>
        <div className="ed-rest-places">
          {([['auberge', '🛏 Auberge'], ['maison', '🏠 Chez soi'], ['camp', '⛺ Camper']] as const).map(([k, label]) => (
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
            💸 Piètre (½ prix, tambouille à risque)
          </label>
        </div>
        {(scene.restZones ?? []).length > 0 && (
          <div className="stack">
            {(scene.restZones ?? []).map((z, i) => (
              <button key={i} className="listrow insp-row" onClick={() => setSel({ type: 'restZone', idx: i })}>
                <span className="lr-name">⛺ Zone ({z.rect.x},{z.rect.y}) {z.rect.w}×{z.rect.h}</span>
              </button>
            ))}
          </div>
        )}
      </Fold>
      <Fold title={`Points d'entrée (${Object.keys(scene.entryPoints ?? {}).length})`}>
        <p className="hint">Cibles nommées des transitions. Posez-en avec l'outil ⚑.</p>
        <div className="stack">
          {Object.entries(scene.entryPoints ?? {}).map(([name, pos]) => (
            <button key={name} className="listrow insp-row" onClick={() => setSel({ type: 'entry', id: name })}>
              <span className="lr-name">⚑ {name}</span>
              <span className="chip">
                ({pos.x},{pos.y})
              </span>
            </button>
          ))}
        </div>
      </Fold>
      <Fold title={`Contenu (${scene.entities.length + (scene.buildings ?? []).length})`}>
        <input className="pal-search" placeholder="🔎 filtrer…" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <div className="stack insp-content">
          {builds.map((b) => (
            <button key={b.id} className="listrow insp-row" onClick={() => setSel({ type: 'building', id: b.id })}>
              <span className="lr-name">🏠 {b.label ?? BUILDINGS_META[b.type]?.label ?? b.type}</span>
              <span className="chip">
                ({b.foot.x},{b.foot.y})
              </span>
            </button>
          ))}
          {ents.map((e) => (
            <button key={e.id} className="listrow insp-row" onClick={() => setSel({ type: 'entity', id: e.id })}>
              <span className="lr-name">
                {ENT_ICON[e.kind] ?? '•'} {e.label ?? e.ref ?? e.id}
              </span>
              <span className="chip">
                ({e.pos.x},{e.pos.y})
              </span>
            </button>
          ))}
          {entries.map(([name, pos]) => (
            <button key={name} className="listrow insp-row" onClick={() => setSel({ type: 'entry', id: name })}>
              <span className="lr-name">⚑ {name}</span>
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
