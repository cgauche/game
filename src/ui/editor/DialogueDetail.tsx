/**
 * Détail d'UN dialogue (panneau Logique) en MASTER-DÉTAIL : liste des nœuds (▶ départ,
 * résumé des choix « → n2, n3 ») → édition d'UN nœud à la fois — fini les cartes imbriquées
 * toutes dépliées du POC. Les choix sont repliés avec résumé (texte + cible + coût), dépliables
 * pour condition/coût/effets.
 */
import { useState } from 'react';
import { Dialogue, DialogueNode, DialogueChoice } from '../../state/scene';
import { EMPTY_FLOW, type Flow } from '../../state/flow';
import { Ctx } from './EffectList';
import { Icon } from '../Icon';
import { FlowEditor } from './FlowEditor';
import { WhenEditor, condSummary } from './ConditionEditor';

/** Nombre de blocs de PREMIER niveau d'un Flow (badge du choix). */
const flowLen = (flow?: Flow): number => (!flow ? 0 : flow.kind === 'seq' ? flow.steps.length : 1);

export function DialogueDetail({ dialogue, onChange, ctx }: { dialogue: Dialogue; onChange: (d: Dialogue) => void; ctx: Ctx }) {
  const [nodeId, setNodeId] = useState<string>(dialogue.start);
  const node = dialogue.nodes.find((n) => n.id === nodeId) ?? dialogue.nodes[0] ?? null;

  const updNode = (patch: Partial<DialogueNode>) =>
    onChange({ ...dialogue, nodes: dialogue.nodes.map((n) => (node && n.id === node.id ? { ...n, ...patch } : n)) });
  const updChoice = (ci: number, patch: Partial<DialogueChoice>) =>
    updNode({ choices: node!.choices.map((c, i) => (i === ci ? { ...c, ...patch } : c)) });
  const addNode = () => {
    let n = dialogue.nodes.length + 1;
    while (dialogue.nodes.some((x) => x.id === `n${n}`)) n++;
    const id = `n${n}`;
    onChange({ ...dialogue, nodes: [...dialogue.nodes, { id, text: '', choices: [] }] });
    setNodeId(id);
  };

  return (
    <div className="dlg-detail">
      <div className="row-flex">
        <label className="ed-field dlg-id-field">
          Id du dialogue
          <input value={dialogue.id} onChange={(e) => onChange({ ...dialogue, id: e.target.value })} />
        </label>
        <label className="ed-field">
          Nœud de départ
          <select value={dialogue.start} onChange={(e) => onChange({ ...dialogue, start: e.target.value })}>
            {dialogue.nodes.map((n) => (
              <option key={n.id} value={n.id}>
                {n.id}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="dlg-split">
        <div className="dlg-nodes">
          <div className="mini-title">Nœuds ({dialogue.nodes.length})</div>
          {dialogue.nodes.map((n) => {
            const targets = [...new Set(n.choices.map((c) => c.next).filter(Boolean))];
            return (
              <button key={n.id} className={`listrow insp-row${node?.id === n.id ? ' active' : ''}`} onClick={() => setNodeId(n.id)}>
                <span className="lr-name">
                  {dialogue.start === n.id ? '▶ ' : ''}
                  <b>{n.id}</b> {n.text ? `· ${n.text.slice(0, 24)}${n.text.length > 24 ? '…' : ''}` : ''}
                </span>
                {targets.length > 0 && <span className="chip">→ {targets.join(', ')}</span>}
              </button>
            );
          })}
          <button className="btn small" onClick={addNode}>
            + Nœud
          </button>
        </div>

        {node && (
          <div className="dlg-node-edit panel sunken">
            <div className="row-flex">
              <input className="node-id" value={node.id} placeholder="id nœud" onChange={(e) => {
                const id = e.target.value;
                // renomme le nœud ET les références (start, choix → next)
                onChange({
                  ...dialogue,
                  start: dialogue.start === node.id ? id : dialogue.start,
                  nodes: dialogue.nodes.map((n) =>
                    n.id === node.id
                      ? { ...n, id }
                      : { ...n, choices: n.choices.map((c) => (c.next === node.id ? { ...c, next: id } : c)) },
                  ),
                });
                setNodeId(id);
              }} />
              <input className="node-speaker" value={node.speaker ?? ''} onChange={(e) => updNode({ speaker: e.target.value || undefined })} placeholder="locuteur (optionnel)" />
              <button
                className="btn small danger"
                title="Supprimer ce nœud"
                onClick={() => {
                  onChange({ ...dialogue, nodes: dialogue.nodes.filter((n) => n.id !== node.id) });
                  setNodeId(dialogue.start);
                }}
              >
                ✕ nœud
              </button>
            </div>
            <textarea className="node-text" value={node.text} onChange={(e) => updNode({ text: e.target.value })} placeholder="Texte de la réplique" />

            <div className="mini-title">Choix ({node.choices.length})</div>
            <div className="stack">
              {node.choices.map((c, ci) => (
                <details className="eff-row dlg-choice" key={ci}>
                  <summary>
                    <span className="eff-summary">
                      {c.text ? `« ${c.text.slice(0, 38)}${c.text.length > 38 ? '…' : ''} »` : '(choix sans texte)'}
                      {c.next ? ` → ${c.next}` : ' → fin'}
                      {c.cost?.gold || c.cost?.silver || c.cost?.brass ? <> · <Icon id="resource/gold-purse" size="sm" /></> : ''}
                      {condSummary(c.when) ? ' · si ' + condSummary(c.when) : ''}
                      {flowLen(c.flow) ? ` · ${flowLen(c.flow)} bloc(s)` : ''}
                    </span>
                    <span className="eff-actions" onClick={(e) => e.preventDefault()}>
                      <button className="btn small danger" title="Supprimer le choix" onClick={() => updNode({ choices: node.choices.filter((_, i) => i !== ci) })}>
                        ✕
                      </button>
                    </span>
                  </summary>
                  <div className="eff-body">
                    <input className="choice-text" value={c.text} onChange={(e) => updChoice(ci, { text: e.target.value })} placeholder="Texte du choix" />
                    <div className="row-flex">
                      <label className="dr">
                        →
                        <select value={c.next ?? ''} onChange={(e) => updChoice(ci, { next: e.target.value || undefined })}>
                          <option value="">(fin / effets)</option>
                          {dialogue.nodes.map((nn) => (
                            <option key={nn.id} value={nn.id}>
                              {nn.id}
                            </option>
                          ))}
                        </select>
                      </label>
                      <span className="choice-cost" title="Coût de l’option (service payant : auberge, péage, pot-de-vin) — CO / pa / sc">
                        <Icon id="resource/gold-purse" size="sm" />
                        {(['gold', 'silver', 'brass'] as const).map((k) => (
                          <input
                            key={k}
                            type="number"
                            min={0}
                            placeholder={k === 'gold' ? 'CO' : k === 'silver' ? 'pa' : 'sc'}
                            value={c.cost?.[k] ?? ''}
                            onChange={(e) => {
                              const merged = { ...c.cost, [k]: e.target.value === '' ? undefined : Number(e.target.value) };
                              const any = merged.gold || merged.silver || merged.brass;
                              updChoice(ci, { cost: any ? merged : undefined });
                            }}
                          />
                        ))}
                      </span>
                    </div>
                    <div className="mini-title" title="Le choix n'apparaît que si la condition est vraie (flag, créneau horaire, ET/OU/NON).">Affiché si</div>
                    <WhenEditor when={c.when} onChange={(when) => updChoice(ci, { when })} />
                    <div className="mini-title">À la sélection (effets · conditions · tests)</div>
                    <FlowEditor flow={c.flow ?? EMPTY_FLOW} ctx={ctx} onChange={(flow) => updChoice(ci, { flow: flowLen(flow) ? flow : undefined })} />
                  </div>
                </details>
              ))}
              <button className="btn small" onClick={() => updNode({ choices: [...node.choices, { text: '' }] })}>
                + Choix
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
