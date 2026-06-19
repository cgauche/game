/**
 * ÉDITEUR DE FLOW — la « liste de blocs imbriqués » (façon RPG Maker / ink) qui authore la LOGIQUE
 * d'un trigger / choix de dialogue / piège / sort : une séquence de blocs
 *   · do   (un effet)
 *   · si   (condition → ALORS / SINON)
 *   · test (jet de compétence → RÉUSSITE / ÉCHEC)
 * chaque branche étant elle-même un Flow (récursif). SOURCE UNIQUE du branchement authoré : remplace
 * l'ancien `Effect.test` ET le round-trip plat `flowEffects`/`flowFromEffects`. La feuille `do`
 * réutilise `EffectFields` (privée de `test`, devenu un nœud Flow) ; le `si` réutilise `ConditionEditor`
 * (algèbre flag/horaire/ET/OU/NON, partagé avec le `when` des triggers/dialogues).
 */
import type { MouseEvent } from 'react';
import { Flow, FlowTest, EMPTY_FLOW } from '../../state/flow';
import { DIFFICULTY_LABELS, Difficulty } from '../../engine/types';
import { isSocialTest } from '../../engine/skills';
import { RefField } from '../compendium/RefField';
import {
  EffectFields,
  Ctx,
  EFFECT_GROUPS,
  EFFECT_ICON,
  EFFECT_LABEL,
  newEffect,
  effectSummary,
  closeDetails,
} from './EffectList';
import { ConditionEditor, condSummary } from './ConditionEditor';

/** Normalise un Flow en liste de blocs éditables (un `seq` expose ses étapes ; sinon bloc unique). */
function asSteps(flow: Flow): Flow[] {
  return flow.kind === 'seq' ? flow.steps : [flow];
}
const seqOf = (steps: Flow[]): Flow => ({ kind: 'seq', steps });

/** Résumé HUMAIN d'un nœud Flow (rangée repliée). */
function nodeSummary(node: Flow, ctx: Ctx): string {
  switch (node.kind) {
    case 'do': return effectSummary(node.effect, ctx);
    case 'if': return `🔀 Si ${condSummary(node.cond)}${node.else != null ? ' · sinon…' : ''}`;
    case 'test': return `🎲 Test ${node.test.skill || node.test.characteristic || '?'} → ✓ / ✗`;
    case 'seq': return `▸ ${node.steps.length} bloc(s)`;
  }
}

/** Éditeur du jet d'un nœud `test` (FlowTest : compétence/caractéristique, difficulté, DR, outil, groupes, easierIf). */
function TestFields({ test, onChange }: { test: FlowTest; onChange: (t: FlowTest) => void }) {
  const upd = (patch: Partial<FlowTest>) => onChange({ ...test, ...patch });
  const setEase = (patch: Partial<NonNullable<FlowTest['easierIf']>>) => {
    const m = { ...(test.easierIf ?? {}), ...patch };
    upd({ easierIf: m.hasSkill || m.hasTalent ? m : undefined });
  };
  return (
    <>
      <div className="tf-row">
        <input placeholder="Compétence (ex. Crochetage)" value={test.skill ?? ''} onChange={(e) => upd({ skill: e.target.value })} />
        <select value={test.difficulty ?? 'intermediaire'} onChange={(e) => upd({ difficulty: e.target.value as Difficulty })}>
          {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((d) => (
            <option key={d} value={d}>{DIFFICULTY_LABELS[d]}</option>
          ))}
        </select>
        <label className="dr">DR≥<input type="number" value={test.requireSL ?? 0} onChange={(e) => upd({ requireSL: Number(e.target.value) })} /></label>
        <input placeholder="Outil (ex. Rossignols — qualité Pratique/Bâclé…)" value={test.tool ?? ''} onChange={(e) => upd({ tool: e.target.value || undefined })} />
      </div>
      {isSocialTest(test.skill, test.characteristic) && (
        <div className="tf-row">
          <input
            placeholder="Interlocuteur — groupes (Sociabilité : Animosité/Préjugé −20/−10, ex. « Elfe, Mort-vivant »)"
            value={(test.vsGroups ?? []).join(', ')}
            onChange={(e) => {
              const g = e.target.value.split(',').map((s) => s.trim()).filter(Boolean);
              upd({ vsGroups: g.length ? g : undefined });
            }}
          />
        </div>
      )}
      <div className="tf-row">
        <span className="dr">Plus facile si</span>
        <RefField cfg={{ ds: 'skills', single: true, spec: true }} fieldKey="compétence" value={test.easierIf?.hasSkill} onChange={(v) => setEase({ hasSkill: (v as { id: string; spec?: string } | null) ?? undefined })} nullable />
        <input placeholder="ou talent" value={test.easierIf?.hasTalent ?? ''} onChange={(e) => setEase({ hasTalent: e.target.value || undefined })} />
        <label className="dr">−<input type="number" min={1} value={test.easierIf?.steps ?? 1} onChange={(e) => setEase({ steps: Number(e.target.value) })} /> cran(s)</label>
      </div>
    </>
  );
}

/** Menu « + Bloc » : un nœud logique (si/test) ou une feuille d'effet (do, par catégorie). */
function FlowAddMenu({ onAdd }: { onAdd: (node: Flow) => void }) {
  const pick = (node: Flow) => (e: MouseEvent<HTMLButtonElement>) => {
    onAdd(node);
    closeDetails(e.currentTarget);
  };
  return (
    <details className="eff-add">
      <summary className="btn small">+ Bloc</summary>
      <div className="eff-add-menu panel">
        <div className="eff-add-group">
          <div className="mini-title">🔀 Logique</div>
          <button className="eff-add-item" onClick={pick({ kind: 'if', cond: { kind: 'flag', expr: '' }, then: EMPTY_FLOW })}>🔀 Condition (si…)</button>
          <button className="eff-add-item" onClick={pick({ kind: 'test', test: { skill: '', difficulty: 'intermediaire', requireSL: 0 }, success: EMPTY_FLOW, fail: EMPTY_FLOW })}>🎲 Test de compétence</button>
        </div>
        {EFFECT_GROUPS.map(([g, types]) => (
          <div key={g} className="eff-add-group">
            <div className="mini-title">{g}</div>
            {types.map((t) => (
              <button key={t} className="eff-add-item" onClick={pick({ kind: 'do', effect: newEffect(t) })}>
                {EFFECT_ICON[t]} {EFFECT_LABEL[t]}
              </button>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}

export function FlowEditor({ flow, onChange, ctx }: { flow: Flow; onChange: (f: Flow) => void; ctx: Ctx }) {
  const steps = asSteps(flow);
  const set = (next: Flow[]) => onChange(seqOf(next));
  const updAt = (i: number, node: Flow) => set(steps.map((s, j) => (j === i ? node : s)));
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= steps.length) return;
    const next = [...steps];
    [next[i], next[j]] = [next[j], next[i]];
    set(next);
  };
  return (
    <div className="flow-list eff-list">
      {steps.map((node, i) => (
        <details className={`eff-row flow-node flow-${node.kind}`} key={i} open={node.kind !== 'do'}>
          <summary>
            <span className="eff-summary">{nodeSummary(node, ctx)}</span>
            <span className="eff-actions" onClick={(e) => e.preventDefault()}>
              <button className="btn small" title="Monter (l'ordre compte)" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
              <button className="btn small" title="Descendre" disabled={i === steps.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
              <button className="btn small danger" title="Supprimer le bloc" onClick={() => set(steps.filter((_, j) => j !== i))}>✕</button>
            </span>
          </summary>
          {node.kind === 'do' && (
            <EffectFields effect={node.effect} ctx={ctx} onChange={(eff) => updAt(i, { kind: 'do', effect: eff })} />
          )}
          {node.kind === 'if' && (
            <div className="eff-body flow-branch">
              <ConditionEditor cond={node.cond} onChange={(c) => updAt(i, { ...node, cond: c })} />
              <div className="branch">
                <span className="branch-label ok">ALORS :</span>
                <FlowEditor flow={node.then} ctx={ctx} onChange={(f) => updAt(i, { ...node, then: f })} />
              </div>
              <label className="ed-check">
                <input type="checkbox" checked={node.else != null} onChange={(e) => updAt(i, { ...node, else: e.target.checked ? EMPTY_FLOW : undefined })} /> sinon…
              </label>
              {node.else != null && (
                <div className="branch">
                  <span className="branch-label fail">SINON :</span>
                  <FlowEditor flow={node.else} ctx={ctx} onChange={(f) => updAt(i, { ...node, else: f })} />
                </div>
              )}
            </div>
          )}
          {node.kind === 'test' && (
            <div className="eff-body flow-branch">
              <TestFields test={node.test} onChange={(t) => updAt(i, { ...node, test: t })} />
              <div className="branch">
                <span className="branch-label ok">Si RÉUSSITE :</span>
                <FlowEditor flow={node.success} ctx={ctx} onChange={(f) => updAt(i, { ...node, success: f })} />
              </div>
              <div className="branch">
                <span className="branch-label fail">Si ÉCHEC :</span>
                <FlowEditor flow={node.fail} ctx={ctx} onChange={(f) => updAt(i, { ...node, fail: f })} />
              </div>
            </div>
          )}
          {node.kind === 'seq' && (
            <div className="eff-body">
              <FlowEditor flow={node} ctx={ctx} onChange={(f) => updAt(i, f)} />
            </div>
          )}
        </details>
      ))}
      <FlowAddMenu onAdd={(node) => set([...steps, node])} />
    </div>
  );
}
