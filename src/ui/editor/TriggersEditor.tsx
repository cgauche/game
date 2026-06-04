/**
 * Éditeur structuré de Triggers + Effets (remplace le JSON brut).
 * Permet de câbler la logique de scène : zones déclencheuses et effets
 * (flags, journal, documents, objets, argent, combats, transitions, TESTS de
 * compétence avec branches, dialogues).
 */
import { useState } from 'react';
import { Effect, Trigger, EncounterDef, Dialogue } from '../../state/scene';
import { DIFFICULTY_LABELS, Difficulty } from '../../engine/types';

const EFFECT_TYPES: Effect['type'][] = [
  'journal',
  'setFlag',
  'document',
  'giveItem',
  'giveMoney',
  'startCombat',
  'transition',
  'startDialogue',
  'test',
  'endDialogue',
];
const EFFECT_LABEL: Record<Effect['type'], string> = {
  journal: 'Journal',
  setFlag: 'Définir un flag',
  document: 'Document (handout)',
  giveItem: 'Donner un objet',
  giveMoney: 'Donner/retirer de l’argent',
  startCombat: 'Démarrer un combat',
  transition: 'Transition de scène',
  startDialogue: 'Ouvrir un dialogue',
  test: 'Test de compétence',
  endDialogue: 'Fermer le dialogue',
};

function newEffect(type: Effect['type']): Effect {
  switch (type) {
    case 'setFlag':
      return { type: 'setFlag', flag: '', value: true };
    case 'document':
      return { type: 'document', title: '', text: '' };
    case 'giveItem':
      return { type: 'giveItem', item: '' };
    case 'giveMoney':
      return { type: 'giveMoney', gold: 0, silver: 0, brass: 0 };
    case 'startCombat':
      return { type: 'startCombat', encounter: '' };
    case 'transition':
      return { type: 'transition', scene: '', entry: '' };
    case 'startDialogue':
      return { type: 'startDialogue', dialogue: '' };
    case 'test':
      return { type: 'test', skill: '', difficulty: 'intermediaire', requireSL: 0, onSuccess: [], onFailure: [] };
    case 'endDialogue':
      return { type: 'endDialogue' };
    default:
      return { type: 'journal', text: '' };
  }
}

interface Ctx {
  encounters: EncounterDef[];
  dialogues: Dialogue[];
}

function EffectEditor({ effect, onChange, onRemove, ctx }: { effect: Effect; onChange: (e: Effect) => void; onRemove: () => void; ctx: Ctx }) {
  const e = effect as any;
  const upd = (patch: any) => onChange({ ...e, ...patch });
  return (
    <div className="eff-row">
      <div className="eff-head">
        <select value={effect.type} onChange={(ev) => onChange(newEffect(ev.target.value as Effect['type']))}>
          {EFFECT_TYPES.map((t) => (
            <option key={t} value={t}>
              {EFFECT_LABEL[t]}
            </option>
          ))}
        </select>
        <button className="btn small danger" onClick={onRemove}>
          ✕
        </button>
      </div>
      <div className="eff-fields">
        {effect.type === 'journal' && <input placeholder="Texte du journal" value={e.text ?? ''} onChange={(ev) => upd({ text: ev.target.value })} />}
        {effect.type === 'setFlag' && (
          <>
            <input placeholder="nom_du_flag" value={e.flag ?? ''} onChange={(ev) => upd({ flag: ev.target.value })} />
            <label className="radio">
              <input type="checkbox" checked={e.value !== false} onChange={(ev) => upd({ value: ev.target.checked })} /> vrai
            </label>
          </>
        )}
        {effect.type === 'document' && (
          <>
            <input placeholder="Titre" value={e.title ?? ''} onChange={(ev) => upd({ title: ev.target.value })} />
            <textarea placeholder="Texte du document (sauts de ligne autorisés)" value={e.text ?? ''} onChange={(ev) => upd({ text: ev.target.value })} />
          </>
        )}
        {effect.type === 'giveItem' && <input placeholder="Nom de l’objet" value={e.item ?? ''} onChange={(ev) => upd({ item: ev.target.value })} />}
        {effect.type === 'giveMoney' && (
          <div className="money-fields">
            <label>CO<input type="number" value={e.gold ?? 0} onChange={(ev) => upd({ gold: Number(ev.target.value) })} /></label>
            <label>SC<input type="number" value={e.silver ?? 0} onChange={(ev) => upd({ silver: Number(ev.target.value) })} /></label>
            <label>PA<input type="number" value={e.brass ?? 0} onChange={(ev) => upd({ brass: Number(ev.target.value) })} /></label>
          </div>
        )}
        {effect.type === 'startCombat' && (
          <select value={e.encounter ?? ''} onChange={(ev) => upd({ encounter: ev.target.value })}>
            <option value="">— rencontre —</option>
            {ctx.encounters.map((en) => (
              <option key={en.id} value={en.id}>
                {en.id}
              </option>
            ))}
          </select>
        )}
        {effect.type === 'transition' && (
          <>
            <input placeholder="id de la scène cible" value={e.scene ?? ''} onChange={(ev) => upd({ scene: ev.target.value })} />
            <input placeholder="point d’entrée (optionnel)" value={e.entry ?? ''} onChange={(ev) => upd({ entry: ev.target.value })} />
          </>
        )}
        {effect.type === 'startDialogue' && (
          <select value={e.dialogue ?? ''} onChange={(ev) => upd({ dialogue: ev.target.value })}>
            <option value="">— dialogue —</option>
            {ctx.dialogues.map((d) => (
              <option key={d.id} value={d.id}>
                {d.id}
              </option>
            ))}
          </select>
        )}
        {effect.type === 'test' && (
          <div className="test-fields">
            <div className="tf-row">
              <input placeholder="Compétence (ex. Marchandage)" value={e.skill ?? ''} onChange={(ev) => upd({ skill: ev.target.value })} />
              <select value={e.difficulty ?? 'intermediaire'} onChange={(ev) => upd({ difficulty: ev.target.value as Difficulty })}>
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
                  <option key={d} value={d}>
                    {DIFFICULTY_LABELS[d]}
                  </option>
                ))}
              </select>
              <label className="dr">DR≥<input type="number" value={e.requireSL ?? 0} onChange={(ev) => upd({ requireSL: Number(ev.target.value) })} /></label>
            </div>
            <div className="branch">
              <span className="branch-label ok">Si RÉUSSITE :</span>
              <EffectList effects={e.onSuccess ?? []} onChange={(x) => upd({ onSuccess: x })} ctx={ctx} />
            </div>
            <div className="branch">
              <span className="branch-label fail">Si ÉCHEC :</span>
              <EffectList effects={e.onFailure ?? []} onChange={(x) => upd({ onFailure: x })} ctx={ctx} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EffectList({ effects, onChange, ctx }: { effects: Effect[]; onChange: (e: Effect[]) => void; ctx: Ctx }) {
  return (
    <div className="eff-list">
      {effects.map((eff, i) => (
        <EffectEditor
          key={i}
          effect={eff}
          ctx={ctx}
          onChange={(ne) => onChange(effects.map((x, j) => (j === i ? ne : x)))}
          onRemove={() => onChange(effects.filter((_, j) => j !== i))}
        />
      ))}
      <button className="btn small" onClick={() => onChange([...effects, newEffect('journal')])}>
        + Effet
      </button>
    </div>
  );
}

export function TriggersEditor({
  triggers,
  encounters,
  dialogues,
  onSave,
  onClose,
}: {
  triggers: Trigger[];
  encounters: EncounterDef[];
  dialogues: Dialogue[];
  onSave: (t: Trigger[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<Trigger[]>(() => JSON.parse(JSON.stringify(triggers)));
  const ctx: Ctx = { encounters, dialogues };
  const upd = (i: number, patch: Partial<Trigger>) => setList(list.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal wide trig-modal" onClick={(ev) => ev.stopPropagation()}>
        <h3>Triggers & effets</h3>
        <p className="hint">Une zone (rectangle de tuiles) qui déclenche des effets quand le groupe y entre.</p>
        <div className="trig-list">
          {list.map((t, i) => (
            <div className="trig-card" key={i}>
              <div className="trig-top">
                <input className="trig-id" value={t.id} onChange={(e) => upd(i, { id: e.target.value })} placeholder="id" />
                <div className="rect-fields">
                  <label>x<input type="number" value={t.rect.x} onChange={(e) => upd(i, { rect: { ...t.rect, x: Number(e.target.value) } })} /></label>
                  <label>y<input type="number" value={t.rect.y} onChange={(e) => upd(i, { rect: { ...t.rect, y: Number(e.target.value) } })} /></label>
                  <label>l<input type="number" value={t.rect.w} onChange={(e) => upd(i, { rect: { ...t.rect, w: Number(e.target.value) } })} /></label>
                  <label>h<input type="number" value={t.rect.h} onChange={(e) => upd(i, { rect: { ...t.rect, h: Number(e.target.value) } })} /></label>
                </div>
                <label className="radio">
                  <input type="checkbox" checked={!!t.once} onChange={(e) => upd(i, { once: e.target.checked })} /> une fois
                </label>
                <input className="trig-cond" value={t.condition ?? ''} onChange={(e) => upd(i, { condition: e.target.value || undefined })} placeholder="condition (flag, !flag)" />
                <button className="btn small danger" onClick={() => setList(list.filter((_, j) => j !== i))}>
                  Supprimer
                </button>
              </div>
              <EffectList effects={t.effects} onChange={(eff) => upd(i, { effects: eff })} ctx={ctx} />
            </div>
          ))}
        </div>
        <button
          className="btn"
          onClick={() => setList([...list, { id: `trig-${Date.now().toString(36)}`, rect: { x: 0, y: 0, w: 2, h: 2 }, once: true, effects: [] }])}
        >
          + Nouveau trigger
        </button>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>
            Annuler
          </button>
          <button
            className="btn btn-primary"
            onClick={() => {
              onSave(list);
              onClose();
            }}
          >
            Appliquer
          </button>
        </div>
      </div>
    </div>
  );
}
