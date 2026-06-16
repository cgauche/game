/**
 * ÉDITEUR DE CONDITION — l'algèbre CLOSE de `Condition` (flag / créneau horaire / ET / OU / NON),
 * récursive. SOURCE UNIQUE de l'édition des conditions : le `when` d'un trigger / d'un choix de
 * dialogue (où « Toujours » = pas de condition → `undefined`) ET le nœud `si` d'un Flow. Remplace les
 * adaptateurs plats `whenFlag/whenWindow/buildWhen` (qui n'exprimaient que « flag ET créneau »).
 */
import type { Condition, ActorRef, ActorField, CompareOp } from '../../state/flow';
import type { TemporalCondition } from '../../state/scene';

const ALWAYS: Condition = { kind: 'always' };

/** Données fixes d'un acteur comparables (Condition `compare`) — libellés des sélecteurs. */
const FIELD_LABEL: Record<ActorField, string> = { woundsCurrent: 'PB courants', woundsMax: 'PB max', size: 'Taille', advantage: 'Avantage' };
const WHO_LABEL: Record<ActorRef, string> = { target: 'la cible', caster: 'le lanceur' };
const COMPARE_OPS: CompareOp[] = ['>=', '<=', '==', '<', '>'];

const KIND_OPTIONS: [Condition['kind'], string][] = [
  ['always', 'Toujours'],
  ['flag', 'Flag(s)'],
  ['time', 'Créneau horaire'],
  ['hasItem', 'Possède un objet'],
  ['money', 'Bourse ≥'],
  ['partyDead', 'Héros mort'],
  ['compare', 'État du porteur (comparaison)'],
  ['slThreshold', 'Seuil de marge (DR ≥)'],
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
const moneyStr = (m: { gold?: number; silver?: number; brass?: number }) =>
  [m.gold ? `${m.gold} CO` : '', m.silver ? `${m.silver} pa` : '', m.brass ? `${m.brass} sc` : ''].filter(Boolean).join(' ') || '0';

/** Résumé HUMAIN compact d'une Condition (rangées repliées, listes). */
export function condSummary(c: Condition | undefined): string {
  if (!c) return '';
  switch (c.kind) {
    case 'always': return 'toujours';
    case 'flag': return c.expr || '(flag ?)';
    case 'time': return winSummary(c.window);
    case 'hasItem': return `a « ${c.trapping || '?'} »${c.count && c.count > 1 ? ` ×${c.count}` : ''}`;
    case 'money': return `bourse ≥ ${moneyStr(c.atLeast)}`;
    case 'partyDead': return c.who === 'all' ? 'tout le groupe mort' : 'un héros mort';
    case 'compare': {
      const subj = 'condition' in c.subject ? `État « ${c.subject.condition || '?'} »` : FIELD_LABEL[c.subject.field];
      const val = typeof c.value === 'number' ? `${c.value}` : `${WHO_LABEL[c.value.who]} ${FIELD_LABEL[c.value.field]}`;
      return `${WHO_LABEL[c.subject.who]} : ${subj} ${c.op} ${val}`;
    }
    case 'slThreshold': return `marge ≥ ${c.atLeast} DR`;
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
    case 'hasItem': return { kind: 'hasItem', trapping: cond.kind === 'hasItem' ? cond.trapping : '' };
    case 'money': return { kind: 'money', atLeast: cond.kind === 'money' ? cond.atLeast : { gold: 1 } };
    case 'partyDead': return { kind: 'partyDead', who: cond.kind === 'partyDead' ? cond.who : 'any' };
    case 'compare': return cond.kind === 'compare' ? cond : { kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 1 };
    case 'slThreshold': return { kind: 'slThreshold', atLeast: cond.kind === 'slThreshold' ? cond.atLeast : 6 };
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
      {cond.kind === 'hasItem' && (
        <>
          <input className="cond-flag" value={cond.trapping} placeholder="nom de l'objet (ex. Clé en fer)" onChange={(e) => onChange({ kind: 'hasItem', trapping: e.target.value, count: cond.count })} />
          <label className="dr">×<input type="number" min={1} style={{ width: '3em' }} value={cond.count ?? 1} onChange={(e) => onChange({ kind: 'hasItem', trapping: cond.trapping, count: Math.max(1, Number(e.target.value) || 1) })} /></label>
        </>
      )}
      {cond.kind === 'money' && (
        <span className="cond-time">≥
          {(['gold', 'silver', 'brass'] as const).map((k) => (
            <label className="dr" key={k}>
              {k === 'gold' ? 'CO' : k === 'silver' ? 'pa' : 'sc'}
              <input type="number" min={0} style={{ width: '3.4em' }} value={cond.atLeast[k] ?? ''} onChange={(e) => onChange({ kind: 'money', atLeast: { ...cond.atLeast, [k]: e.target.value === '' ? undefined : Number(e.target.value) } })} />
            </label>
          ))}
        </span>
      )}
      {cond.kind === 'partyDead' && (
        <select className="cond-kind" value={cond.who} onChange={(e) => onChange({ kind: 'partyDead', who: e.target.value === 'all' ? 'all' : 'any' })}>
          <option value="any">un héros au moins</option>
          <option value="all">tout le groupe</option>
        </select>
      )}
      {cond.kind === 'compare' && (
        <span className="cond-time">
          <select className="cond-kind" value={cond.subject.who} onChange={(e) => onChange({ ...cond, subject: { ...cond.subject, who: e.target.value as ActorRef } })}>
            {(Object.keys(WHO_LABEL) as ActorRef[]).map((w) => <option key={w} value={w}>{WHO_LABEL[w]}</option>)}
          </select>
          <select className="cond-kind" value={'condition' in cond.subject ? 'condition' : cond.subject.field}
            onChange={(e) => onChange({ ...cond, subject: e.target.value === 'condition' ? { who: cond.subject.who, condition: '' } : { who: cond.subject.who, field: e.target.value as ActorField } })}>
            {(Object.keys(FIELD_LABEL) as ActorField[]).map((s) => <option key={s} value={s}>{FIELD_LABEL[s]}</option>)}
            <option value="condition">valeur d’un État</option>
          </select>
          {'condition' in cond.subject && (
            <input className="cond-flag" value={cond.subject.condition} placeholder="nom de l'État (ex. Brisé)" onChange={(e) => onChange({ ...cond, subject: { who: cond.subject.who, condition: e.target.value } })} />
          )}
          <select className="cond-kind" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          {/* Valeur comparée : une CONSTANTE, ou la donnée d'un AUTRE acteur (Taille cible < Taille attaquant). */}
          <select className="cond-kind" value={typeof cond.value === 'number' ? 'const' : 'actor'}
            onChange={(e) => onChange({ ...cond, value: e.target.value === 'const' ? 0 : { who: 'caster', field: 'woundsCurrent' } })}>
            <option value="const">une valeur</option>
            <option value="actor">donnée d’un acteur</option>
          </select>
          {typeof cond.value === 'number' ? (
            <input type="number" style={{ width: '3.4em' }} value={cond.value} onChange={(e) => onChange({ ...cond, value: Number(e.target.value) || 0 })} />
          ) : (
            <>
              <select className="cond-kind" value={cond.value.who} onChange={(e) => onChange({ ...cond, value: { who: e.target.value as ActorRef, field: (cond.value as { field: ActorField }).field } })}>
                {(Object.keys(WHO_LABEL) as ActorRef[]).map((w) => <option key={w} value={w}>{WHO_LABEL[w]}</option>)}
              </select>
              <select className="cond-kind" value={cond.value.field} onChange={(e) => onChange({ ...cond, value: { who: (cond.value as { who: ActorRef }).who, field: e.target.value as ActorField } })}>
                {(Object.keys(FIELD_LABEL) as ActorField[]).map((s) => <option key={s} value={s}>{FIELD_LABEL[s]}</option>)}
              </select>
            </>
          )}
        </span>
      )}
      {cond.kind === 'slThreshold' && (
        <label className="dr">marge ≥ <input type="number" min={0} style={{ width: '3.4em' }} value={cond.atLeast} onChange={(e) => onChange({ kind: 'slThreshold', atLeast: Math.max(0, Number(e.target.value) || 0) })} /> DR</label>
      )}
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
