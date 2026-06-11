/**
 * Éditeur structuré de Triggers (zones déclencheuses + effets).
 */
import { useRef, useState } from 'react';
import { Trigger, EncounterDef, Dialogue } from '../../state/scene';
import { useModalA11y } from '../Modal';
import { EffectList, Ctx } from './EffectList';

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
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef); // piège de focus seul — pas d'Échap (champs de saisie)
  const ctx: Ctx = { encounters, dialogues };
  const upd = (i: number, patch: Partial<Trigger>) => setList(list.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={boxRef} role="dialog" aria-modal="true" className="modal wide trig-modal" onClick={(ev) => ev.stopPropagation()}>
        <h3>Triggers &amp; effets</h3>
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
