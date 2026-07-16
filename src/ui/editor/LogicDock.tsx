/**
 * PANNEAU LOGIQUE — dock bas repliable/redimensionnable remplaçant les 3 modales du POC
 * (Triggers / Dialogues / Rencontres) + l'onglet Validation. MASTER-DÉTAIL : liste à gauche,
 * détail de l'élément sélectionné à droite. Édition LIVE via `setScene` → un seul historique
 * d'undo (fini le modèle copie locale + Annuler/Appliquer).
 */
import { useRef } from 'react';
import { Scene, Trigger, EncounterDef, Dialogue } from '../../state/scene';
import type { WorldMap } from '../../state/worldMap';
import type { ThreatTier } from '../../engine/advantagePool';
import { EMPTY_FLOW } from '../../state/flow';
import type { Warning } from '../../state/validateScene';
import { nextEntityId } from '../../state/entityId';
import { CreatureData } from '../../data';
import { addEnemyMember, removeMember, patchMember, flowEffects } from './editorState';
import { effectCtxOf, Ctx } from './EffectList';
import { FlowEditor } from './FlowEditor';
import { WhenEditor, condSummary } from './ConditionEditor';
import { DialogueDetail } from './DialogueDetail';
import { ValidationPanel } from './ValidationPanel';
import { Icon } from '../Icon';
import { Tabs } from '../Tabs';

export type LogicTab = 'triggers' | 'dialogues' | 'encounters' | 'validation';

export function LogicDock({
  scene,
  otherScenes,
  worldMap,
  setScene,
  enemyCreatures,
  warnings,
  onSelectWarning,
  tab,
  setTab,
  open,
  setOpen,
  height,
  setHeight,
  trigSel,
  setTrigSel,
  dlgSel,
  setDlgSel,
  encSel,
  setEncSel,
  onSelectEntity,
}: {
  scene: Scene;
  otherScenes: Scene[];
  /** Carte du monde du projet (id + label des lieux) pour `openPort` — absente ⇒ fallback texte. */
  worldMap: WorldMap | null;
  setScene: (s: Scene) => void;
  enemyCreatures: CreatureData[];
  warnings: Warning[];
  onSelectWarning: (w: Warning) => void;
  /** Sélectionne une entité sur la carte (chip de membre → inspecteur). */
  onSelectEntity: (id: string) => void;
  tab: LogicTab;
  setTab: (t: LogicTab) => void;
  open: boolean;
  setOpen: (b: boolean) => void;
  height: number;
  setHeight: (h: number) => void;
  /** Trigger sélectionné = la sélection CANVAS (synchro carte ⇄ dock). */
  trigSel: string | null;
  setTrigSel: (id: string | null) => void;
  dlgSel: string | null;
  setDlgSel: (id: string | null) => void;
  encSel: string | null;
  setEncSel: (id: string | null) => void;
}) {
  const ctx: Ctx = { encounters: scene.encounters, dialogues: scene.dialogues, ...effectCtxOf(scene, otherScenes, worldMap ?? undefined) };
  const dragRef = useRef<{ sy: number; sh: number } | null>(null);

  const errors = warnings.filter((w) => w.level === 'error').length;
  const tabs: { key: LogicTab; label: string | JSX.Element; count: number; alert?: boolean }[] = [
    { key: 'triggers', label: <><Icon id="map-tool/zone" size="sm" /> Triggers</>, count: scene.triggers.length },
    { key: 'dialogues', label: <><Icon id="merchant/haggle" size="sm" /> Dialogues</>, count: scene.dialogues.length },
    { key: 'encounters', label: <><Icon id="action/attack" size="sm" /> Rencontres</>, count: scene.encounters.length },
    { key: 'validation', label: <><Icon id="ui/warning" size="sm" /> Validation</>, count: warnings.length, alert: errors > 0 },
  ];
  const clickTab = (t: LogicTab) => {
    if (open && t === tab) setOpen(false);
    else {
      setTab(t);
      setOpen(true);
    }
  };

  return (
    <div className={`logic-dock${open ? ' open' : ''}`} style={open ? { height } : undefined}>
      <div
        className="logic-resize"
        title="Glisser pour redimensionner"
        onPointerDown={(e) => {
          if (!open) return;
          dragRef.current = { sy: e.clientY, sh: height };
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!dragRef.current) return;
          setHeight(Math.max(160, Math.min(window.innerHeight * 0.75, dragRef.current.sh + (dragRef.current.sy - e.clientY))));
        }}
        onPointerUp={() => (dragRef.current = null)}
      />
      <Tabs
        tabs={tabs}
        active={open ? tab : null}
        onChange={clickTab}
        trailing={
          <button className="tabs-trailing btn small" onClick={() => setOpen(!open)} title={open ? 'Replier' : 'Déplier'}>
            {open ? '▾' : '▴'}
          </button>
        }
      />

      {open && (
        <div className="logic-body">
          {tab === 'triggers' && (
            <TriggersTab scene={scene} setScene={setScene} ctx={ctx} sel={trigSel} setSel={setTrigSel} />
          )}
          {tab === 'dialogues' && (
            <DialoguesTab scene={scene} setScene={setScene} ctx={ctx} sel={dlgSel} setSel={setDlgSel} />
          )}
          {tab === 'encounters' && (
            <EncountersTab scene={scene} setScene={setScene} ctx={ctx} creatures={enemyCreatures} sel={encSel} setSel={setEncSel} onSelectEntity={onSelectEntity} />
          )}
          {tab === 'validation' && (
            <div className="logic-validation">
              <ValidationPanel warnings={warnings} onSelect={onSelectWarning} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TriggersTab({
  scene,
  setScene,
  ctx,
  sel,
  setSel,
}: {
  scene: Scene;
  setScene: (s: Scene) => void;
  ctx: Ctx;
  sel: string | null;
  setSel: (id: string | null) => void;
}) {
  const t = scene.triggers.find((x) => x.id === sel) ?? null;
  const upd = (patch: Partial<Trigger>) => setScene({ ...scene, triggers: scene.triggers.map((x) => (t && x.id === t.id ? { ...x, ...patch } : x)) });
  return (
    <div className="logic-split">
      <div className="logic-list">
        {scene.triggers.map((x) => (
          <button key={x.id} className={`listrow insp-row${x.id === sel ? ' active' : ''}`} onClick={() => setSel(x.id)}>
            <span className="lr-name">
              <b>{x.id}</b> ({x.rect.x},{x.rect.y}) {x.rect.w}×{x.rect.h}
              {condSummary(x.when) ? ` · si ${condSummary(x.when)}` : ''}
            </span>
            <span className="count">{flowEffects(x.flow).length}</span>
          </button>
        ))}
        <button
          className="btn small"
          onClick={() => {
            const id = nextEntityId('trig', scene.triggers.map((x) => x.id));
            setScene({ ...scene, triggers: [...scene.triggers, { id, rect: { x: 0, y: 0, w: 2, h: 2 }, once: true, flow: EMPTY_FLOW }] });
            setSel(id);
          }}
        >
          + Nouveau trigger
        </button>
        <p className="hint">Astuce : outil <Icon id="map-tool/zone" size="sm" /> → glisser sur la carte pour dessiner la zone directement.</p>
      </div>
      {t ? (
        <div className="logic-detail">
          <div className="row-flex">
            <label className="ed-field">
              Id
              <input
                value={t.id}
                onChange={(e) => {
                  upd({ id: e.target.value });
                  setSel(e.target.value);
                }}
              />
            </label>
            <div className="ed-dim">
              {(['x', 'y', 'w', 'h'] as const).map((k) => (
                <label key={k}>
                  {k === 'w' ? 'L' : k === 'h' ? 'H' : k.toUpperCase()}
                  <input
                    type="number"
                    value={t.rect[k]}
                    onChange={(e) => upd({ rect: { ...t.rect, [k]: Math.max(k === 'w' || k === 'h' ? 1 : 0, Number(e.target.value)) } })}
                  />
                </label>
              ))}
            </div>
            <label className="ed-check">
              <input type="checkbox" checked={!!t.once} onChange={(e) => upd({ once: e.target.checked })} /> une fois
            </label>
            <button
              className="btn small danger"
              onClick={() => {
                setScene({ ...scene, triggers: scene.triggers.filter((x) => x.id !== t.id) });
                setSel(null);
              }}
            >
              Supprimer
            </button>
          </div>
          <div className="mini-title" title="Le trigger ne se déclenche qu'en entrant dans la zone si la condition est vraie (flag, créneau horaire, ET/OU/NON).">Condition de déclenchement</div>
          <WhenEditor when={t.when} onChange={(when) => upd({ when })} />
          <div className="mini-title">Au déclenchement (effets · conditions · tests)</div>
          <FlowEditor flow={t.flow} onChange={(flow) => upd({ flow })} ctx={ctx} />
        </div>
      ) : (
        <div className="logic-detail hint">Sélectionnez un trigger (liste ou carte) pour éditer ses effets.</div>
      )}
    </div>
  );
}

function DialoguesTab({
  scene,
  setScene,
  ctx,
  sel,
  setSel,
}: {
  scene: Scene;
  setScene: (s: Scene) => void;
  ctx: Ctx;
  sel: string | null;
  setSel: (id: string | null) => void;
}) {
  const d = scene.dialogues.find((x) => x.id === sel) ?? null;
  return (
    <div className="logic-split">
      <div className="logic-list">
        {scene.dialogues.map((x) => (
          <button key={x.id} className={`listrow insp-row${x.id === sel ? ' active' : ''}`} onClick={() => setSel(x.id)}>
            <span className="lr-name">
              <b>{x.id}</b>
            </span>
            <span className="count">{x.nodes.length} nœud(s)</span>
          </button>
        ))}
        <button
          className="btn small"
          onClick={() => {
            const id = nextEntityId('dlg', scene.dialogues.map((x) => x.id));
            setScene({ ...scene, dialogues: [...scene.dialogues, { id, start: 'n1', nodes: [{ id: 'n1', text: '', choices: [] }] }] });
            setSel(id);
          }}
        >
          + Nouveau dialogue
        </button>
      </div>
      {d ? (
        <div className="logic-detail">
          <div className="row-flex logic-detail-bar">
            <button
              className="btn small danger"
              onClick={() => {
                setScene({ ...scene, dialogues: scene.dialogues.filter((x) => x.id !== d.id) });
                setSel(null);
              }}
            >
              Supprimer le dialogue
            </button>
          </div>
          <DialogueDetail
            key={d.id}
            dialogue={d}
            ctx={ctx}
            onChange={(nd: Dialogue) => {
              setScene({ ...scene, dialogues: scene.dialogues.map((x) => (x.id === d.id ? nd : x)) });
              if (nd.id !== d.id) setSel(nd.id);
            }}
          />
        </div>
      ) : (
        <div className="logic-detail hint">Un dialogue = des nœuds (répliques) ; chaque choix mène à un autre nœud et/ou déclenche des effets. Attachez-le à un PNJ via l'inspecteur.</div>
      )}
    </div>
  );
}

function EncountersTab({
  scene,
  setScene,
  ctx,
  creatures,
  sel,
  setSel,
  onSelectEntity,
}: {
  scene: Scene;
  setScene: (s: Scene) => void;
  ctx: Ctx;
  creatures: CreatureData[];
  sel: string | null;
  setSel: (id: string | null) => void;
  onSelectEntity: (id: string) => void;
}) {
  const enc = scene.encounters.find((x) => x.id === sel) ?? null;
  const upd = (patch: Partial<EncounterDef>) =>
    setScene({ ...scene, encounters: scene.encounters.map((x) => (enc && x.id === enc.id ? { ...x, ...patch } : x)) });
  const byId = new Map(scene.entities.map((e) => [e.id, e]));
  const members = enc?.members ?? [];
  return (
    <div className="logic-split">
      <div className="logic-list">
        {scene.encounters.map((x) => (
          <button key={x.id} className={`listrow insp-row${x.id === sel ? ' active' : ''}`} onClick={() => setSel(x.id)}>
            <span className="lr-name">
              <b>{x.id}</b>
              {x.surprise ? ' · embuscade' : ''}
            </span>
            <span className="count">{(x.members ?? []).length} membre(s)</span>
          </button>
        ))}
        <button
          className="btn small"
          onClick={() => {
            const id = nextEntityId('enc', scene.encounters.map((x) => x.id));
            setScene({ ...scene, encounters: [...scene.encounters, { id, members: [] }] });
            setSel(id);
          }}
        >
          + Nouvelle rencontre
        </button>
        <p className="hint">Astuce : outil <Icon id="action/attack" size="sm" /> pour poser les combattants directement sur la carte.</p>
      </div>
      {enc ? (
        <div className="logic-detail">
          <div className="row-flex">
            <label className="ed-field">
              Id (référencé par « Démarrer un combat »)
              <input
                value={enc.id}
                onChange={(e) => {
                  upd({ id: e.target.value });
                  setSel(e.target.value);
                }}
              />
            </label>
            <button
              className="btn small danger"
              onClick={() => {
                setScene({ ...scene, encounters: scene.encounters.filter((x) => x.id !== enc.id) });
                setSel(null);
              }}
            >
              Supprimer
            </button>
          </div>
          <div className="mini-title">Combattants (membres)</div>
          <div className="enemy-list">
            {members.map((m) => {
              const e = byId.get(m.entityId);
              const mounts = members.filter((mm) => mm.entityId !== m.entityId && (mm.mount || m.ridesEntityId === mm.entityId));
              return (
                <div key={m.entityId}>
                  <div className="enemy-row">
                    <button
                      className="listrow insp-row"
                      onClick={() => onSelectEntity(m.entityId)}
                      title="Sélectionner sur la carte → éditer le profil/apparence dans l'inspecteur"
                    >
                      {e ? `${e.label ?? e.ref ?? m.entityId} · (${e.pos.x},${e.pos.y})` : <><Icon id="ui/warning" size="sm" /> {m.entityId} (entité manquante)</>}
                    </button>
                    <button className="btn small danger" onClick={() => setScene(removeMember(scene, enc.id, m.entityId))} title="Retirer de la rencontre (l'entité reste sur la carte)">
                      ✕
                    </button>
                  </div>
                  <div className="enemy-mount">
                    <label title="Cette créature est une monture rideable (peut être enfourchée — LDB 14).">
                      <input type="checkbox" checked={!!m.mount} onChange={(e2) => setScene(patchMember(scene, enc.id, m.entityId, { mount: e2.target.checked || undefined }))} /> <Icon id="travel/mount" size="sm" /> Monture
                    </label>
                    <label title="Monture (de cette rencontre) que cet acteur chevauche au spawn (référence stable par entité).">
                      Chevauche{' '}
                      <select value={m.ridesEntityId ?? ''} onChange={(e2) => setScene(patchMember(scene, enc.id, m.entityId, { ridesEntityId: e2.target.value || undefined }))}>
                        <option value="">— aucune —</option>
                        {mounts.map((mm) => (
                          <option key={mm.entityId} value={mm.entityId}>
                            {byId.get(mm.entityId)?.label ?? byId.get(mm.entityId)?.ref ?? mm.entityId}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label title="Camp au spawn : « Allié » place la créature du côté du groupe (monture libre prêtable). Défaut : Ennemi.">
                      Camp{' '}
                      <select value={m.side ?? 'enemy'} onChange={(e2) => setScene(patchMember(scene, enc.id, m.entityId, { side: e2.target.value === 'ally' ? 'ally' : undefined }))}>
                        <option value="enemy">Ennemi</option>
                        <option value="ally">Allié</option>
                      </select>
                    </label>
                  </div>
                </div>
              );
            })}
            <button
              className="btn small"
              onClick={() => {
                const r = addEnemyMember(scene, enc.id, creatures[0]?.label ?? 'Mutant', { x: 0, y: 0 });
                setScene(r.scene);
                onSelectEntity(r.entityId);
              }}
            >
              + Combattant
            </button>
          </div>
          <div className="mini-title">Surprise (embuscade, LDB 13)</div>
          <select
            value={enc.surprise ?? ''}
            onChange={(e) => upd({ surprise: (e.target.value || undefined) as 'party' | 'enemies' | undefined })}
            title="Camp pris en embuscade au début du combat : Test opposé Perception vs Discrétion ; les vaincus gagnent l'État Surpris."
          >
            <option value="">Aucune surprise</option>
            <option value="enemies">Les ennemis sont surpris (le groupe embusque)</option>
            <option value="party">Le groupe est surpris (les ennemis embusquent)</option>
          </select>
          <div className="mini-title">Avantage initial — Manœuvrabilité / Menace / Terrain (AA 11 l.53-65)</div>
          <div className="enemy-mount">
            <label title="Un camp possède un avantage de mouvement (monté, terrain arboricole/aérien favorable…) : +2 à sa réserve d'Avantage.">
              Manœuvrabilité{' '}
              <select
                value={enc.maneuverability ?? ''}
                onChange={(e) => upd({ maneuverability: (e.target.value || undefined) as 'party' | 'enemies' | undefined })}
              >
                <option value="">Aucune</option>
                <option value="party">Le groupe</option>
                <option value="enemies">Les ennemis</option>
              </select>
            </label>
          </div>
          <div className="enemy-mount">
            <label title="Un camp affronte une menace notoire (ogre, manticore, dragon…) : +1/+3/+5 à sa réserve selon le palier.">
              Menace{' '}
              <select
                value={enc.threat?.camp ?? ''}
                onChange={(e) => {
                  const camp = e.target.value as 'party' | 'enemies' | '';
                  upd({ threat: camp ? { camp, tier: enc.threat?.tier ?? 'dangereuse' } : undefined });
                }}
              >
                <option value="">Aucune</option>
                <option value="party">Le groupe</option>
                <option value="enemies">Les ennemis</option>
              </select>
            </label>
            {enc.threat && (
              <label>
                Palier{' '}
                <select value={enc.threat.tier} onChange={(e) => upd({ threat: { ...enc.threat!, tier: e.target.value as ThreatTier } })}>
                  <option value="dangereuse">Dangereuse (+1)</option>
                  <option value="tresDangereuse">Très dangereuse (+3)</option>
                  <option value="extreme">Extrême (+5)</option>
                </select>
              </label>
            )}
          </div>
          <div className="enemy-mount">
            <label title="Un camp tient une position avantageuse (fortifications, couvert, hauteur, pont…) : +1 (léger) ou +2 (lourd) à sa réserve.">
              Terrain{' '}
              <select
                value={enc.terrain?.camp ?? ''}
                onChange={(e) => {
                  const camp = e.target.value as 'party' | 'enemies' | '';
                  upd({ terrain: camp ? { camp, heavy: enc.terrain?.heavy } : undefined });
                }}
              >
                <option value="">Aucun</option>
                <option value="party">Le groupe</option>
                <option value="enemies">Les ennemis</option>
              </select>
            </label>
            {enc.terrain && (
              <label>
                <input type="checkbox" checked={!!enc.terrain.heavy} onChange={(e) => upd({ terrain: { ...enc.terrain!, heavy: e.target.checked || undefined } })} />{' '}
                Couvert lourd / position décisive (+2 au lieu de +1)
              </label>
            )}
          </div>
          <div className="mini-title">Objectif de victoire</div>
          <div className="enemy-mount">
            <label title="Comment le combat se GAGNE. Défaut : tous les ennemis hors d'action (comportement historique).">
              Type{' '}
              <select
                value={enc.victoryCondition?.type ?? 'allEnemiesDead'}
                onChange={(e) => {
                  const t = e.target.value;
                  if (t === 'allEnemiesDead') upd({ victoryCondition: undefined });
                  else if (t === 'destroyStructure') upd({ victoryCondition: { type: 'destroyStructure', edge: { x: 0, y: 0, side: 'N' } } });
                  else if (t === 'surviveRounds') upd({ victoryCondition: { type: 'surviveRounds', rounds: 3 } });
                  else if (t === 'reachZone') upd({ victoryCondition: { type: 'reachZone', rect: { x: 0, y: 0, w: 1, h: 1 } } });
                  else if (t === 'woundsThreshold') upd({ victoryCondition: { type: 'woundsThreshold', targetId: members[0]?.entityId ?? '', belowPercent: 50 } });
                  else if (t === 'firstBlood') upd({ victoryCondition: { type: 'firstBlood', threshold: 3 } });
                }}
              >
                <option value="allEnemiesDead">Tous les ennemis hors d'action</option>
                <option value="destroyStructure">Détruire une structure (brèche)</option>
                <option value="surviveRounds">Survivre N Rounds</option>
                <option value="reachZone">Atteindre une zone</option>
                <option value="woundsThreshold">Reddition à seuil de dommage</option>
                <option value="firstBlood">Duel judiciaire — premier sang</option>
              </select>
            </label>
          </div>
          {enc.victoryCondition?.type === 'destroyStructure' && (() => {
            const vc = enc.victoryCondition!;
            return (
              <div className="enemy-mount">
                <label>X <input type="number" value={vc.edge.x} onChange={(e) => upd({ victoryCondition: { type: 'destroyStructure', edge: { ...vc.edge, x: Number(e.target.value) } } })} /></label>
                <label>Y <input type="number" value={vc.edge.y} onChange={(e) => upd({ victoryCondition: { type: 'destroyStructure', edge: { ...vc.edge, y: Number(e.target.value) } } })} /></label>
                <label>
                  Arête{' '}
                  <select
                    value={vc.edge.side}
                    onChange={(e) => upd({ victoryCondition: { type: 'destroyStructure', edge: { ...vc.edge, side: e.target.value as 'N' | 'E' | '\\' | '/' } } })}
                  >
                    <option value="N">N</option>
                    <option value="E">E</option>
                    <option value="\">\</option>
                    <option value="/">/</option>
                  </select>
                </label>
                <label>Z <input type="number" value={vc.edge.z ?? 0} onChange={(e) => upd({ victoryCondition: { type: 'destroyStructure', edge: { ...vc.edge, z: Number(e.target.value) || undefined } } })} /></label>
              </div>
            );
          })()}
          {enc.victoryCondition?.type === 'surviveRounds' && (() => {
            const vc = enc.victoryCondition!;
            return (
              <div className="enemy-mount">
                <label>Rounds à tenir <input type="number" min={1} value={vc.rounds} onChange={(e) => upd({ victoryCondition: { type: 'surviveRounds', rounds: Math.max(1, Number(e.target.value)) } })} /></label>
              </div>
            );
          })()}
          {enc.victoryCondition?.type === 'reachZone' && (() => {
            const vc = enc.victoryCondition!;
            return (
              <div className="enemy-mount">
                <label>X <input type="number" value={vc.rect.x} onChange={(e) => upd({ victoryCondition: { type: 'reachZone', camp: vc.camp, rect: { ...vc.rect, x: Number(e.target.value) } } })} /></label>
                <label>Y <input type="number" value={vc.rect.y} onChange={(e) => upd({ victoryCondition: { type: 'reachZone', camp: vc.camp, rect: { ...vc.rect, y: Number(e.target.value) } } })} /></label>
                <label>L <input type="number" min={1} value={vc.rect.w} onChange={(e) => upd({ victoryCondition: { type: 'reachZone', camp: vc.camp, rect: { ...vc.rect, w: Math.max(1, Number(e.target.value)) } } })} /></label>
                <label>H <input type="number" min={1} value={vc.rect.h} onChange={(e) => upd({ victoryCondition: { type: 'reachZone', camp: vc.camp, rect: { ...vc.rect, h: Math.max(1, Number(e.target.value)) } } })} /></label>
                <label>
                  Camp{' '}
                  <select
                    value={vc.camp ?? 'party'}
                    onChange={(e) => upd({ victoryCondition: { type: 'reachZone', rect: vc.rect, camp: e.target.value as 'party' | 'enemies' } })}
                  >
                    <option value="party">Le groupe</option>
                    <option value="enemies">Les ennemis</option>
                  </select>
                </label>
              </div>
            );
          })()}
          {enc.victoryCondition?.type === 'woundsThreshold' && (() => {
            const vc = enc.victoryCondition!;
            return (
              <div className="enemy-mount">
                <label title="Cible dont les Blessures sont surveillées : sous le seuil, elle amène son pavillon et sort du combat (reddition, #215).">
                  Cible{' '}
                  <select value={vc.targetId} onChange={(e) => upd({ victoryCondition: { type: 'woundsThreshold', targetId: e.target.value, belowPercent: vc.belowPercent } })}>
                    <option value="">— aucune —</option>
                    {members.map((m) => (
                      <option key={m.entityId} value={m.entityId}>
                        {byId.get(m.entityId)?.label ?? byId.get(m.entityId)?.ref ?? m.entityId}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sous{' '}
                  <input
                    type="number" min={1} max={99} value={vc.belowPercent}
                    onChange={(e) => upd({ victoryCondition: { type: 'woundsThreshold', targetId: vc.targetId, belowPercent: Math.min(99, Math.max(1, Number(e.target.value))) } })}
                  />
                  % de ses Blessures
                </label>
              </div>
            );
          })()}
          {enc.victoryCondition?.type === 'firstBlood' && (() => {
            const vc = enc.victoryCondition!;
            return (
              <div className="enemy-mount">
                <label title="Le premier coup qui cause une perte de plus de ce nombre de Blessures met fin au duel (NADAJ 06 l.175-177). Défaut 3 Blessures (seule valeur chiffrée par le RAW).">
                  Seuil{' '}
                  <input
                    type="number" min={1} value={vc.threshold ?? 3}
                    onChange={(e) => upd({ victoryCondition: { type: 'firstBlood', threshold: Math.max(1, Number(e.target.value)) } })}
                  />
                  {' '}Blessures en un coup
                </label>
              </div>
            );
          })()}
          <div className="enemy-mount">
            <label title="Duel judiciaire (NADAJ 06 l.181) : « la plupart des lois locales interdisent de faire appel à des projectiles ». Dérogeable (variante locale) — champ indépendant de l'objectif de victoire.">
              <input type="checkbox" checked={!!enc.banRanged} onChange={(e) => upd({ banRanged: e.target.checked || undefined })} />{' '}
              Armes à distance interdites
            </label>
          </div>
          <div className="mini-title">À la victoire (récompenses : PX, butin, flag…)</div>
          <FlowEditor flow={enc.onVictory ?? EMPTY_FLOW} onChange={(flow) => upd({ onVictory: flow })} ctx={ctx} />
        </div>
      ) : (
        <div className="logic-detail hint">Une rencontre = des ennemis du bestiaire placés sur la grille. Référencée par un effet « Démarrer un combat ».</div>
      )}
    </div>
  );
}
