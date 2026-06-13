/**
 * PANNEAU LOGIQUE — dock bas repliable/redimensionnable remplaçant les 3 modales du POC
 * (Triggers / Dialogues / Rencontres) + l'onglet Validation. MASTER-DÉTAIL : liste à gauche,
 * détail de l'élément sélectionné à droite. Édition LIVE via `setScene` → un seul historique
 * d'undo (fini le modèle copie locale + Annuler/Appliquer).
 */
import { useRef } from 'react';
import { Scene, Trigger, EncounterDef, Dialogue } from '../../state/scene';
import type { Warning } from '../../state/validateScene';
import { nextEntityId } from '../../state/entityId';
import { CreatureData } from '../../data';
import { addEnemyMember, removeMember, patchMember } from './editorState';
import { EffectList, effectCtxOf, Ctx } from './EffectList';
import { DialogueDetail } from './DialogueDetail';
import { ValidationPanel } from './ValidationPanel';

export type LogicTab = 'triggers' | 'dialogues' | 'encounters' | 'validation';

export function LogicDock({
  scene,
  otherScenes,
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
  const ctx: Ctx = { encounters: scene.encounters, dialogues: scene.dialogues, ...effectCtxOf(scene, otherScenes) };
  const dragRef = useRef<{ sy: number; sh: number } | null>(null);

  const errors = warnings.filter((w) => w.level === 'error').length;
  const tabs: { key: LogicTab; label: string; count: number; alert?: boolean }[] = [
    { key: 'triggers', label: '🟦 Triggers', count: scene.triggers.length },
    { key: 'dialogues', label: '💬 Dialogues', count: scene.dialogues.length },
    { key: 'encounters', label: '⚔️ Rencontres', count: scene.encounters.length },
    { key: 'validation', label: '⚠ Validation', count: warnings.length, alert: errors > 0 },
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
      <div className="logic-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={open && tab === t.key}
            className={`logic-tab${open && tab === t.key ? ' active' : ''}${t.alert ? ' alert' : ''}`}
            onClick={() => clickTab(t.key)}
          >
            {t.label} <span className="count">{t.count}</span>
          </button>
        ))}
        <button className="logic-collapse btn small" onClick={() => setOpen(!open)} title={open ? 'Replier' : 'Déplier'}>
          {open ? '▾' : '▴'}
        </button>
      </div>

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
              {x.condition ? ` · si ${x.condition}` : ''}
            </span>
            <span className="count">{x.effects.length}</span>
          </button>
        ))}
        <button
          className="btn small"
          onClick={() => {
            const id = nextEntityId('trig', scene.triggers.map((x) => x.id));
            setScene({ ...scene, triggers: [...scene.triggers, { id, rect: { x: 0, y: 0, w: 2, h: 2 }, once: true, effects: [] }] });
            setSel(id);
          }}
        >
          + Nouveau trigger
        </button>
        <p className="hint">Astuce : outil 🟦 → glisser sur la carte pour dessiner la zone directement.</p>
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
            <input
              className="trig-cond"
              value={t.condition ?? ''}
              onChange={(e) => upd({ condition: e.target.value || undefined })}
              placeholder="condition (flag, !flag)"
            />
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
          <div className="mini-title">Effets au déclenchement</div>
          <EffectList effects={t.effects} onChange={(eff) => upd({ effects: eff })} ctx={ctx} />
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
        <p className="hint">Astuce : outil ⚔️ pour poser les combattants directement sur la carte.</p>
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
                      {e ? `${e.label ?? e.ref ?? m.entityId} · (${e.pos.x},${e.pos.y})` : `⚠ ${m.entityId} (entité manquante)`}
                    </button>
                    <button className="btn small danger" onClick={() => setScene(removeMember(scene, enc.id, m.entityId))} title="Retirer de la rencontre (l'entité reste sur la carte)">
                      ✕
                    </button>
                  </div>
                  <div className="enemy-mount">
                    <label title="Cette créature est une monture rideable (peut être enfourchée — LDB 14).">
                      <input type="checkbox" checked={!!m.mount} onChange={(e2) => setScene(patchMember(scene, enc.id, m.entityId, { mount: e2.target.checked || undefined }))} /> 🐎 Monture
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
          <div className="mini-title">À la victoire (récompenses : PX, butin, flag…)</div>
          <EffectList effects={enc.onVictory ?? []} onChange={(eff) => upd({ onVictory: eff })} ctx={ctx} />
        </div>
      ) : (
        <div className="logic-detail hint">Une rencontre = des ennemis du bestiaire placés sur la grille. Référencée par un effet « Démarrer un combat ».</div>
      )}
    </div>
  );
}
