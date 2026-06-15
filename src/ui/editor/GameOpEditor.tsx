/**
 * ÉDITEUR D'OPS MÉCANIQUES — `GameOp[]` (engine/ops), le vocabulaire PARTAGÉ par les sorts ET les
 * pièges (EffectOp). Liste de lignes op-type + champs, façon `EffectList`. Sous-ensemble CURÉ des ops
 * authorables (les leaves mécaniques courantes) ; les ops à formule complexe (`{bonusOf}`/dés) ou de
 * contrôle (`test`/`perRound`/gates) ne sont PAS proposées ici — le branchement vit dans le Flow.
 * Réutilisable : feuille `do` d'un EffectOp de scène (pièges) aujourd'hui, effets de sort custom demain.
 */
import { GameOp } from '../../engine/ops';
import { CHAR_LABELS, CharKey } from '../../engine/types';
import { etats } from '../../data';
import { closeDetails } from './EffectList';

/** Sous-ensemble CURÉ d'ops authorables (leaves mécaniques) — pas de test/perRound/gates (→ Flow). */
const OP_LABEL: Record<string, string> = {
  wounds: '💥 Blessures (ignore BE/PA)',
  heal: '❤️ Soin (Blessures rendues)',
  condition: '🌀 Poser un État',
  removeCondition: '🌬️ Retirer un État',
  charMod: '📊 Modif. de caractéristique',
  corruption: '🧬 Points de Corruption',
};
const OP_KEYS = Object.keys(OP_LABEL);
const CHARS = Object.keys(CHAR_LABELS) as CharKey[];

/** Lit un nombre depuis une `Formula` (l'éditeur curé n'authore que des littéraux ; formules avancées conservées telles quelles). */
const num = (f: unknown): number => (typeof f === 'number' ? f : 0);

function newOp(op: string): GameOp {
  switch (op) {
    case 'heal': return { op: 'heal', amount: 3 };
    case 'condition': return { op: 'condition', name: etats[0]?.label ?? 'Sonné', value: 1 };
    case 'removeCondition': return { op: 'removeCondition' };
    case 'charMod': return { op: 'charMod', char: 'F', mod: -10 };
    case 'corruption': return { op: 'corruption', amount: 1 };
    default: return { op: 'wounds', amount: 5 };
  }
}

export function opSummary(o: GameOp): string {
  const L = OP_LABEL[o.op]?.split(' ')[0] ?? '•';
  switch (o.op) {
    case 'wounds': return `${L} ${num(o.amount)} Blessure(s)`;
    case 'heal': return `${L} +${num(o.amount)} PB`;
    case 'condition': return `${L} ${o.name}${num(o.value) > 1 ? ` ×${num(o.value)}` : ''}`;
    case 'removeCondition': return `${L} ${o.name ?? '(au choix)'}`;
    case 'charMod': return `${L} ${o.mod >= 0 ? '+' : ''}${o.mod} ${CHAR_LABELS[o.char] ?? o.char}`;
    case 'corruption': return `${L} +${o.amount}`;
    default: return `⚙️ ${o.op}`;
  }
}

function OpFields({ op, onChange }: { op: GameOp; onChange: (o: GameOp) => void }) {
  const o = op as any;
  const upd = (patch: any) => onChange({ ...o, ...patch });
  return (
    <div className="eff-body">
      <select className="eff-type" value={op.op} onChange={(e) => onChange(newOp(e.target.value))}>
        {OP_KEYS.map((k) => (
          <option key={k} value={k}>{OP_LABEL[k]}</option>
        ))}
      </select>
      <div className="tf-row">
        {(op.op === 'wounds' || op.op === 'heal') && (
          <label className="dr">Quantité<input type="number" min={0} value={num(o.amount)} onChange={(e) => upd({ amount: Number(e.target.value) })} /></label>
        )}
        {op.op === 'corruption' && (
          <label className="dr">Points<input type="number" min={1} value={o.amount ?? 1} onChange={(e) => upd({ amount: Math.max(1, Number(e.target.value) || 1) })} /></label>
        )}
        {(op.op === 'condition' || op.op === 'removeCondition') && (
          <>
            <select value={o.name ?? ''} onChange={(e) => upd({ name: e.target.value || undefined })}>
              {op.op === 'removeCondition' && <option value="">— au choix (1er État) —</option>}
              {etats.map((s) => (
                <option key={s.label} value={s.label}>{s.label}</option>
              ))}
            </select>
            <label className="dr">Intensité<input type="number" min={1} value={num(o.value) || 1} onChange={(e) => upd({ value: Math.max(1, Number(e.target.value) || 1) })} /></label>
          </>
        )}
        {op.op === 'charMod' && (
          <>
            <select value={o.char} onChange={(e) => upd({ char: e.target.value as CharKey })}>
              {CHARS.map((c) => (
                <option key={c} value={c}>{CHAR_LABELS[c]}</option>
              ))}
            </select>
            <label className="dr">Modif.<input type="number" value={o.mod} onChange={(e) => upd({ mod: Number(e.target.value) })} /></label>
            <label className="dr">Rounds<input type="number" min={1} placeholder="durée" value={o.durationRounds ?? ''} onChange={(e) => upd({ durationRounds: e.target.value === '' ? undefined : Math.max(1, Number(e.target.value)) })} /></label>
          </>
        )}
      </div>
    </div>
  );
}

export function GameOpEditor({ ops, onChange }: { ops: GameOp[]; onChange: (ops: GameOp[]) => void }) {
  const swap = (i: number, j: number) => {
    if (j < 0 || j >= ops.length) return;
    const next = [...ops];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  return (
    <div className="eff-list">
      {ops.map((o, i) => (
        <details className="eff-row" key={i}>
          <summary>
            <span className="eff-summary">{opSummary(o)}</span>
            <span className="eff-actions" onClick={(e) => e.preventDefault()}>
              <button className="btn small" title="Monter" disabled={i === 0} onClick={() => swap(i, i - 1)}>↑</button>
              <button className="btn small" title="Descendre" disabled={i === ops.length - 1} onClick={() => swap(i, i + 1)}>↓</button>
              <button className="btn small danger" title="Supprimer l'op" onClick={() => onChange(ops.filter((_, j) => j !== i))}>✕</button>
            </span>
          </summary>
          <OpFields op={o} onChange={(no) => onChange(ops.map((x, j) => (j === i ? no : x)))} />
        </details>
      ))}
      <details className="eff-add">
        <summary className="btn small">+ Op mécanique</summary>
        <div className="eff-add-menu panel">
          <div className="eff-add-group">
            {OP_KEYS.map((k) => (
              <button key={k} className="eff-add-item" onClick={(e) => { onChange([...ops, newOp(k)]); closeDetails(e.currentTarget); }}>
                {OP_LABEL[k]}
              </button>
            ))}
          </div>
        </div>
      </details>
    </div>
  );
}
