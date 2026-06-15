/**
 * ÉDITEUR DE CONDITION — l'algèbre CLOSE de `Condition` (flag / créneau horaire / ET / OU / NON),
 * récursive. SOURCE UNIQUE de l'édition des conditions : le `when` d'un trigger / d'un choix de
 * dialogue (où « Toujours » = pas de condition → `undefined`) ET le nœud `si` d'un Flow. Remplace les
 * adaptateurs plats `whenFlag/whenWindow/buildWhen` (qui n'exprimaient que « flag ET créneau »).
 */
import type { Condition } from '../../state/flow';
import type { TemporalCondition } from '../../state/scene';

const ALWAYS: Condition = { kind: 'always' };

const KIND_OPTIONS: [Condition['kind'], string][] = [
  ['always', 'Toujours'],
  ['flag', 'Flag(s)'],
  ['time', 'Créneau horaire'],
  ['all', 'TOUS (ET)'],
  ['any', 'AU MOINS UN (OU)'],
  ['not', 'NON'],
];

const pad = (n?: number) => (n == null ? '··' : String(n).padStart(2, '0'));
const winSummary = (w: TemporalCondition) => {
  const a = w.afterHour != null ? `${pad(w.afterHour)}:${pad(w.afterMinute ?? 0)}` : null;
  const b = w.beforeHour != null ? `${pad(w.beforeHour)}:${pad(w.beforeMinute ?? 0)}` : null;
  return a && b ? `${a}–${b}` : a ? `dès ${a}` : b ? `avant ${b}` : 'créneau';
};

/** Résumé HUMAIN compact d'une Condition (rangées repliées, listes). */
export function condSummary(c: Condition | undefined): string {
  if (!c) return '';
  switch (c.kind) {
    case 'always': return 'toujours';
    case 'flag': return c.expr || '(flag ?)';
    case 'time': return winSummary(c.window);
    case 'all': return c.of.length ? c.of.map(condSummary).join(' ET ') : 'toujours';
    case 'any': return c.of.length ? c.of.map(condSummary).join(' OU ') : 'jamais';
    case 'not': return `NON(${condSummary(c.of)})`;
  }
}

/** Préserve le travail en CHANGEANT de type : composer (ET/OU/NON) ENVELOPPE la condition courante. */
function recast(cond: Condition, kind: Condition['kind']): Condition {
  switch (kind) {
    case 'always': return ALWAYS;
    case 'flag': return { kind: 'flag', expr: cond.kind === 'flag' ? cond.expr : '' };
    case 'time': return { kind: 'time', window: cond.kind === 'time' ? cond.window : {} };
    case 'all': return { kind: 'all', of: cond.kind === 'all' || cond.kind === 'any' ? cond.of : cond.kind === 'always' ? [] : [cond] };
    case 'any': return { kind: 'any', of: cond.kind === 'all' || cond.kind === 'any' ? cond.of : cond.kind === 'always' ? [] : [cond] };
    case 'not': return { kind: 'not', of: cond.kind === 'not' ? cond.of : cond };
  }
}

function TimeWindowFields({ window: w, onChange }: { window: TemporalCondition; onChange: (w: TemporalCondition) => void }) {
  const set = (patch: Partial<TemporalCondition>) => {
    const m = { ...w, ...patch };
    onChange(Object.fromEntries(Object.entries(m).filter(([, v]) => v != null)) as TemporalCondition);
  };
  const field = (key: 'afterHour' | 'afterMinute' | 'beforeHour' | 'beforeMinute', max: number, title: string) => (
    <input
      type="number" min={0} max={max} title={title} style={{ width: '3.2em' }}
      value={w[key] ?? ''}
      onChange={(e) => set({ [key]: e.target.value === '' ? undefined : Number(e.target.value) })}
    />
  );
  return (
    <span className="cond-time">
      après {field('afterHour', 23, 'heure (0-23)')}:{field('afterMinute', 59, 'minute (0-59)')} avant {field('beforeHour', 23, 'heure (0-23)')}:{field('beforeMinute', 59, 'minute (0-59)')}
    </span>
  );
}

export function ConditionEditor({ cond, onChange }: { cond: Condition; onChange: (c: Condition) => void }) {
  return (
    <div className="cond-node tf-row">
      <select className="cond-kind" value={cond.kind} onChange={(e) => onChange(recast(cond, e.target.value as Condition['kind']))}>
        {KIND_OPTIONS.map(([k, l]) => (
          <option key={k} value={k}>{l}</option>
        ))}
      </select>
      {cond.kind === 'flag' && (
        <input className="cond-flag" value={cond.expr} placeholder="flag, !flag2 (ET de drapeaux)" onChange={(e) => onChange({ kind: 'flag', expr: e.target.value })} />
      )}
      {cond.kind === 'time' && <TimeWindowFields window={cond.window} onChange={(window) => onChange({ kind: 'time', window })} />}
      {(cond.kind === 'all' || cond.kind === 'any') && (
        <div className={`cond-children ${cond.kind}`}>
          {cond.of.map((c, i) => (
            <div className="cond-child" key={i}>
              <ConditionEditor cond={c} onChange={(nc) => onChange({ ...cond, of: cond.of.map((x, j) => (j === i ? nc : x)) })} />
              <button className="btn small danger" title="Retirer cette sous-condition" onClick={() => onChange({ ...cond, of: cond.of.filter((_, j) => j !== i) })}>✕</button>
            </div>
          ))}
          <button className="btn small" onClick={() => onChange({ ...cond, of: [...cond.of, { kind: 'flag', expr: '' }] })}>
            + {cond.kind === 'all' ? 'ET' : 'OU'}
          </button>
        </div>
      )}
      {cond.kind === 'not' && (
        <div className="cond-children not">
          <ConditionEditor cond={cond.of} onChange={(nc) => onChange({ kind: 'not', of: nc })} />
        </div>
      )}
    </div>
  );
}

/** Variante pour un `when` OPTIONNEL : « Toujours » ↔ `undefined` (pas de condition). */
export function WhenEditor({ when, onChange }: { when?: Condition; onChange: (c: Condition | undefined) => void }) {
  return <ConditionEditor cond={when ?? ALWAYS} onChange={(c) => onChange(c.kind === 'always' ? undefined : c)} />;
}
