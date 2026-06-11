/**
 * Éditeur d'arbres de dialogue : dialogues → nœuds → choix → effets/conditions.
 * Dernière brique d'authoring : permet de construire des scènes sociales
 * entièrement dans l'éditeur (sans JSON).
 */
import { useRef, useState } from 'react';
import { Dialogue, DialogueNode, DialogueChoice, EncounterDef } from '../../state/scene';
import { useModalA11y } from '../Modal';
import { EffectList, Ctx } from './EffectList';

export function DialogueEditor({
  dialogues,
  encounters,
  onSave,
  onClose,
}: {
  dialogues: Dialogue[];
  encounters: EncounterDef[];
  onSave: (d: Dialogue[]) => void;
  onClose: () => void;
}) {
  const [list, setList] = useState<Dialogue[]>(() => JSON.parse(JSON.stringify(dialogues)));
  const boxRef = useRef<HTMLDivElement>(null);
  useModalA11y(boxRef); // piège de focus seul — PAS d'Échap (champs texte : ne pas jeter les modifs sur un réflexe)
  const ctx: Ctx = { encounters, dialogues: list };

  const updDlg = (di: number, patch: Partial<Dialogue>) => setList(list.map((d, i) => (i === di ? { ...d, ...patch } : d)));
  const updNode = (di: number, ni: number, patch: Partial<DialogueNode>) =>
    updDlg(di, { nodes: list[di].nodes.map((n, i) => (i === ni ? { ...n, ...patch } : n)) });
  const updChoice = (di: number, ni: number, ci: number, patch: Partial<DialogueChoice>) =>
    updNode(di, ni, { choices: list[di].nodes[ni].choices.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div ref={boxRef} role="dialog" aria-modal="true" className="modal wide dlg-edit-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Dialogues</h3>
        <p className="hint">Un dialogue = des nœuds (répliques) ; chaque choix mène à un autre nœud et/ou déclenche des effets.</p>

        <div className="dlg-list">
          {list.map((d, di) => (
            <div className="dlg-card" key={di}>
              <div className="dlg-head">
                <input className="dlg-id" value={d.id} onChange={(e) => updDlg(di, { id: e.target.value })} placeholder="id du dialogue" />
                <label className="dlg-start">
                  début
                  <select value={d.start} onChange={(e) => updDlg(di, { start: e.target.value })}>
                    {d.nodes.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.id}
                      </option>
                    ))}
                  </select>
                </label>
                <button className="btn small danger" onClick={() => setList(list.filter((_, i) => i !== di))}>
                  Supprimer dialogue
                </button>
              </div>

              {d.nodes.map((n, ni) => (
                <div className="node-card" key={ni}>
                  <div className="node-head">
                    <input className="node-id" value={n.id} onChange={(e) => updNode(di, ni, { id: e.target.value })} placeholder="id nœud" />
                    <input className="node-speaker" value={n.speaker ?? ''} onChange={(e) => updNode(di, ni, { speaker: e.target.value || undefined })} placeholder="locuteur (optionnel)" />
                    <button className="btn small danger" onClick={() => updDlg(di, { nodes: d.nodes.filter((_, i) => i !== ni) })}>
                      ✕ nœud
                    </button>
                  </div>
                  <textarea className="node-text" value={n.text} onChange={(e) => updNode(di, ni, { text: e.target.value })} placeholder="Texte de la réplique" />

                  <div className="choices">
                    {n.choices.map((c, ci) => (
                      <div className="choice-card" key={ci}>
                        <div className="choice-top">
                          <input className="choice-text" value={c.text} onChange={(e) => updChoice(di, ni, ci, { text: e.target.value })} placeholder="Texte du choix" />
                          <label className="choice-next">
                            →
                            <select value={c.next ?? ''} onChange={(e) => updChoice(di, ni, ci, { next: e.target.value || undefined })}>
                              <option value="">(fin / effets)</option>
                              {d.nodes.map((nn) => (
                                <option key={nn.id} value={nn.id}>
                                  {nn.id}
                                </option>
                              ))}
                            </select>
                          </label>
                          <input className="choice-cond" value={c.condition ?? ''} onChange={(e) => updChoice(di, ni, ci, { condition: e.target.value || undefined })} placeholder="condition" />
                          <span className="choice-cost" title="Coût de l’option (service payant : auberge, péage, pot-de-vin) — CO / pa / sc">
                            💰
                            {(['gold', 'silver', 'brass'] as const).map((k) => (
                              <input
                                key={k}
                                type="number"
                                min={0}
                                style={{ width: 38 }}
                                placeholder={k === 'gold' ? 'CO' : k === 'silver' ? 'pa' : 'sc'}
                                value={c.cost?.[k] ?? ''}
                                onChange={(e) => {
                                  const merged = { ...c.cost, [k]: e.target.value === '' ? undefined : Number(e.target.value) };
                                  const any = merged.gold || merged.silver || merged.brass;
                                  updChoice(di, ni, ci, { cost: any ? merged : undefined });
                                }}
                              />
                            ))}
                          </span>
                          <button className="btn small danger" onClick={() => updNode(di, ni, { choices: n.choices.filter((_, i) => i !== ci) })}>
                            ✕
                          </button>
                        </div>
                        <EffectList effects={c.effects ?? []} onChange={(eff) => updChoice(di, ni, ci, { effects: eff })} ctx={ctx} />
                      </div>
                    ))}
                    <button className="btn small" onClick={() => updNode(di, ni, { choices: [...n.choices, { text: '' }] })}>
                      + Choix
                    </button>
                  </div>
                </div>
              ))}

              <button
                className="btn small"
                onClick={() => {
                  const id = `n${d.nodes.length + 1}`;
                  updDlg(di, { nodes: [...d.nodes, { id, text: '', choices: [] }] });
                }}
              >
                + Nœud
              </button>
            </div>
          ))}
        </div>

        <button
          className="btn"
          onClick={() => {
            const id = `dlg-${Date.now().toString(36)}`;
            setList([...list, { id, start: 'n1', nodes: [{ id: 'n1', text: '', choices: [] }] }]);
          }}
        >
          + Nouveau dialogue
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
