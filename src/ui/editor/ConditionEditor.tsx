/**
 * ÉDITEUR DE CONDITION — l'algèbre CLOSE de `Condition` (flag / créneau horaire / ET / OU / NON),
 * récursive. SOURCE UNIQUE de l'édition des conditions : le `when` d'un trigger / d'un choix de
 * dialogue (où « Toujours » = pas de condition → `undefined`) ET le nœud `si` d'un Flow. Remplace les
 * adaptateurs plats `whenFlag/whenWindow/buildWhen` (qui n'exprimaient que « flag ET créneau »).
 */
import type { Condition, ActorRef, ActorField, CompareOp, CompareSubject } from '../../state/flow';
import type { TemporalCondition } from '../../state/scene';
import { HIT_LOCATION_LABELS, type HitLocation } from '../../engine/types';
import { ATTACK_LABEL } from '../../engine/creatureAttacks';
import type { Camp, Relation } from '../../engine/relations';
import { findTrappingById } from '../../data';
import { formatMoney } from '../../engine/money';
import { RefField } from '../compendium/RefField';

/** Libellé d'affichage d'un `trappingId` (objet catalogué) — repli sur l'id brut (objet CUSTOM par nom). */
const trappingLabelOrId = (id?: string): string => (id ? findTrappingById(id)?.label ?? id : '');

/** Libellés des valeurs de la Condition `relation` : RELATIF au lanceur (allié/adversaire) + camp ABSOLU. */
const REL_LABEL: Record<Relation | Camp, string> = {
  self: 'soi-même', ally: 'allié (même camp)', opponent: 'adversaire (camp ≠)',
  party: 'du groupe (joueur)', neutral: 'neutre (PNJ)', hostile: 'hostile (ennemi)',
};
/** Nature de l'appartenance testée par la Condition `has`. */
const WHAT_LABEL: Record<'group' | 'talent' | 'trait' | 'psych', string> = { group: 'le Groupe', talent: 'le Talent', trait: 'le Trait', psych: 'l’état psy' };

const ALWAYS: Condition = { kind: 'always' };

/** Kinds d'attaque (cf. `creatureAttackKind`) — libellés du sélecteur de la Condition `attackKind` :
 *  les `AttackKind` catalogués (source unique `ATTACK_LABEL`, engine) + `pietinement` (Piétinement =
 *  manœuvre de Taille, hors type `AttackKind` mais valeur runtime de `creatureAttackKind`). */
const ATTACK_KIND_LABELS: Record<string, string> = { ...ATTACK_LABEL, pietinement: 'Piétinement' };

/** Causes d'effarouchement (cf. Nerveux, LDB 85 l.197) — libellés du sélecteur de la Condition `startleCause`. */
const STARTLE_CAUSE_LABELS: Record<'noise' | 'magic', string> = { noise: 'Bruits forts', magic: 'Magie' };

/** Données fixes d'un acteur comparables (Condition `compare`) — libellés des sélecteurs. */
const FIELD_LABEL: Record<ActorField, string> = { woundsCurrent: 'PB courants', woundsMax: 'PB max', size: 'Taille', advantage: 'Avantage' };
const WHO_LABEL: Record<ActorRef, string> = { target: 'la cible', caster: 'le lanceur' };
const COMPARE_OPS: CompareOp[] = ['>=', '<=', '==', '<', '>'];
/** Libellé du SUJET/valeur d'une comparaison : donnée fixe, valeur d'un État nommé, ou Caractéristique. */
const subjectLabel = (s: CompareSubject): string =>
  'condition' in s ? `État « ${s.condition || '?'} »`
    : 'char' in s ? `Carac. ${s.char}${s.bonus ? ' (Bonus)' : ''}`
      : FIELD_LABEL[s.field];

const KIND_OPTIONS: [Condition['kind'], string][] = [
  ['always', 'Toujours'],
  ['flag', 'Flag(s)'],
  ['time', 'Créneau horaire'],
  ['hasItem', 'Possède un objet'],
  ['money', 'Bourse ≥'],
  ['partyDead', 'Héros mort'],
  ['compare', 'État du porteur (comparaison)'],
  ['slThreshold', 'Marge (DR)'],
  ['location', 'Localisation touchée'],
  ['attackKind', 'Type d’attaque'],
  ['startleCause', 'Cause d’effarouchement'],
  ['woundsDealt', 'Blessures infligées'],
  ['engagedAdvantageGap', 'Écart d’Avantage (engagés)'],
  ['engagedAdvantageLead', 'Avance d’Avantage (sur tous les engagés)'],
  ['foeInLoS', 'Ennemi en Ligne de Vue'],
  ['hiddenFromFoes', 'Caché de l’ennemi (hors de vue)'],
  ['engaged', 'Engagé avec un ennemi'],
  ['crewTest', 'Au sein d’un Test d’équipage (à bord)'],
  ['nearestFoe', 'Distance à l’ennemi le plus proche'],
  ['capability', 'Capacité de combat'],
  ['relation', 'Camp / relation'],
  ['has', 'Possède (Groupe/Talent/Trait)'],
  ['casterChaosDomain', 'Domaine du Chaos du lanceur'],
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
    case 'hasItem': return `a « ${trappingLabelOrId(c.trappingId) || '?'} »${c.count && c.count > 1 ? ` ×${c.count}` : ''}`;
    case 'money': return `bourse ≥ ${formatMoney({ gold: c.atLeast.gold ?? 0, silver: c.atLeast.silver ?? 0, brass: c.atLeast.brass ?? 0 })}`;
    case 'partyDead': return c.who === 'all' ? 'tout le groupe mort' : 'un héros mort';
    case 'compare': {
      const val = typeof c.value === 'number' ? `${c.value}` : `${WHO_LABEL[c.value.who]} ${subjectLabel(c.value)}`;
      return `${WHO_LABEL[c.subject.who]} : ${subjectLabel(c.subject)} ${c.op} ${val}`;
    }
    case 'slThreshold': return `marge ${c.op} ${c.value} DR`;
    case 'location': return `touche ${HIT_LOCATION_LABELS[c.is]}`;
    case 'attackKind': return `attaque = ${ATTACK_KIND_LABELS[c.is] ?? (c.is || '?')}`;
    case 'startleCause': return `effarouché par ${STARTLE_CAUSE_LABELS[c.is]}`;
    case 'woundsDealt': return `PB infligés ${c.op} ${c.value}`;
    case 'engagedAdvantageGap': return `écart d’Avantage ${c.op} ${c.value}`;
    case 'engagedAdvantageLead': return `avance d’Avantage ${c.op} ${c.value}`;
    case 'foeInLoS': return 'ennemi en Ligne de Vue';
    case 'hiddenFromFoes': return 'caché (hors de vue de l’ennemi)';
    case 'engaged': return 'engagé avec un ennemi';
    case 'crewTest': return 'au sein d’un Test d’équipage';
    case 'nearestFoe': return `ennemi le + proche ${c.op} ${c.value} cases`;
    case 'capability': return `${WHO_LABEL[c.who]} : capacité « ${c.id || '?'} » ${c.op ?? '>='} ${c.value ?? 1}`;
    case 'relation': return `${WHO_LABEL[c.who]} : ${REL_LABEL[c.is]}`;
    case 'has': return `${WHO_LABEL[c.who]} a ${WHAT_LABEL[c.what]} « ${c.value || '?'}${c.spec ? ` (${c.spec})` : ''} »`;
    case 'casterChaosDomain': return `Domaine du Chaos du lanceur = ${c.is || '?'}`;
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
    case 'hasItem': return { kind: 'hasItem', trappingId: cond.kind === 'hasItem' ? cond.trappingId : '' };
    case 'money': return { kind: 'money', atLeast: cond.kind === 'money' ? cond.atLeast : { gold: 1 } };
    case 'partyDead': return { kind: 'partyDead', who: cond.kind === 'partyDead' ? cond.who : 'any' };
    case 'compare': return cond.kind === 'compare' ? cond : { kind: 'compare', subject: { who: 'target', field: 'woundsCurrent' }, op: '>=', value: 1 };
    case 'slThreshold': return cond.kind === 'slThreshold' ? cond : { kind: 'slThreshold', op: '>=', value: 6 };
    case 'location': return { kind: 'location', is: cond.kind === 'location' ? cond.is : 'tete' };
    case 'attackKind': return { kind: 'attackKind', is: cond.kind === 'attackKind' ? cond.is : 'morsure' };
    case 'startleCause': return { kind: 'startleCause', is: cond.kind === 'startleCause' ? cond.is : 'noise' };
    case 'woundsDealt': return cond.kind === 'woundsDealt' ? cond : { kind: 'woundsDealt', op: '>', value: 0 };
    case 'engagedAdvantageGap': return cond.kind === 'engagedAdvantageGap' ? cond : { kind: 'engagedAdvantageGap', op: '>', value: 0 };
    case 'engagedAdvantageLead': return cond.kind === 'engagedAdvantageLead' ? cond : { kind: 'engagedAdvantageLead', op: '>', value: 0 };
    case 'foeInLoS': return { kind: 'foeInLoS' };
    case 'hiddenFromFoes': return { kind: 'hiddenFromFoes' };
    case 'engaged': return { kind: 'engaged' };
    case 'crewTest': return { kind: 'crewTest' };
    case 'nearestFoe': return cond.kind === 'nearestFoe' ? cond : { kind: 'nearestFoe', op: '<=', value: 3 };
    case 'capability': return cond.kind === 'capability' ? cond : { kind: 'capability', who: 'target', id: 'braveheart', op: '>=', value: 1 };
    case 'relation': return cond.kind === 'relation' ? cond : { kind: 'relation', who: 'target', is: 'opponent' };
    case 'has': return cond.kind === 'has' ? cond : { kind: 'has', who: 'target', what: 'group', value: '' };
    case 'casterChaosDomain': return cond.kind === 'casterChaosDomain' ? cond : { kind: 'casterChaosDomain', is: 'nurgle' };
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
      type="number" min={0} max={max} title={title} className="dr"
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
          {/* L'objet catalogué se choisit par LIBELLÉ mais on stocke son `id` ; un nom hors catalogue
              (objet CUSTOM) est stocké tel quel → repli `it.name` côté runtime (evalCondition). */}
          <RefField
            cfg={{ ds: 'trappings', freeText: true }}
            value={cond.trappingId}
            onChange={(v) => onChange({ kind: 'hasItem', trappingId: (v as string) ?? '', count: cond.count })}
          />
          <label className="dr">×<input type="number" min={1} value={cond.count ?? 1} onChange={(e) => onChange({ kind: 'hasItem', trappingId: cond.trappingId, count: Math.max(1, Number(e.target.value) || 1) })} /></label>
        </>
      )}
      {cond.kind === 'money' && (
        <span className="cond-time">≥
          {(['gold', 'silver', 'brass'] as const).map((k) => (
            <label className="dr" key={k}>
              {k === 'gold' ? 'CO' : k === 'silver' ? 'pa' : 'sc'}
              <input type="number" min={0} value={cond.atLeast[k] ?? ''} onChange={(e) => onChange({ kind: 'money', atLeast: { ...cond.atLeast, [k]: e.target.value === '' ? undefined : Number(e.target.value) } })} />
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
          <select className="cond-kind" value={'field' in cond.subject ? cond.subject.field : 'condition'}
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
            <input type="number" className="dr" value={cond.value} onChange={(e) => onChange({ ...cond, value: Number(e.target.value) || 0 })} />
          ) : (
            <>
              <select className="cond-kind" value={cond.value.who} onChange={(e) => onChange({ ...cond, value: { who: e.target.value as ActorRef, field: (cond.value as { field: ActorField }).field } })}>
                {(Object.keys(WHO_LABEL) as ActorRef[]).map((w) => <option key={w} value={w}>{WHO_LABEL[w]}</option>)}
              </select>
              <select className="cond-kind" value={'field' in cond.value ? cond.value.field : 'woundsCurrent'} onChange={(e) => onChange({ ...cond, value: { who: (cond.value as { who: ActorRef }).who, field: e.target.value as ActorField } })}>
                {(Object.keys(FIELD_LABEL) as ActorField[]).map((s) => <option key={s} value={s}>{FIELD_LABEL[s]}</option>)}
              </select>
            </>
          )}
        </span>
      )}
      {cond.kind === 'slThreshold' && (
        <span className="cond-time">marge
          <select className="cond-kind" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input type="number" min={0} className="dr" value={cond.value} onChange={(e) => onChange({ ...cond, value: Math.max(0, Number(e.target.value) || 0) })} /> DR
        </span>
      )}
      {cond.kind === 'nearestFoe' && (
        <span className="cond-time">ennemi proche
          <select className="cond-kind" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input type="number" min={0} className="dr" value={cond.value} onChange={(e) => onChange({ ...cond, value: Math.max(0, Number(e.target.value) || 0) })} /> cases
        </span>
      )}
      {cond.kind === 'capability' && (
        <span className="cond-time">
          <select className="cond-kind" value={cond.who} onChange={(e) => onChange({ ...cond, who: e.target.value as ActorRef })}>
            {(['target', 'caster'] as ActorRef[]).map((w) => <option key={w} value={w}>{WHO_LABEL[w]}</option>)}
          </select>
          <input className="cond-flag" value={cond.id} placeholder="capacité (ex. braveheart)" onChange={(e) => onChange({ ...cond, id: e.target.value.trim() })} />
          <select className="cond-kind" value={cond.op ?? '>='} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input type="number" min={0} className="dr" value={cond.value ?? 1} onChange={(e) => onChange({ ...cond, value: Math.max(0, Number(e.target.value) || 0) })} />
        </span>
      )}
      {cond.kind === 'location' && (
        <select className="cond-kind" value={cond.is} onChange={(e) => onChange({ kind: 'location', is: e.target.value as HitLocation })}>
          {(Object.keys(HIT_LOCATION_LABELS) as HitLocation[]).map((l) => <option key={l} value={l}>{HIT_LOCATION_LABELS[l]}</option>)}
        </select>
      )}
      {cond.kind === 'attackKind' && (
        <select className="cond-kind" value={cond.is} onChange={(e) => onChange({ kind: 'attackKind', is: e.target.value })}>
          {Object.keys(ATTACK_KIND_LABELS).map((k) => <option key={k} value={k}>{ATTACK_KIND_LABELS[k]}</option>)}
        </select>
      )}
      {cond.kind === 'startleCause' && (
        <select className="cond-kind" value={cond.is} onChange={(e) => onChange({ kind: 'startleCause', is: e.target.value as 'noise' | 'magic' })}>
          {(Object.keys(STARTLE_CAUSE_LABELS) as ('noise' | 'magic')[]).map((k) => <option key={k} value={k}>{STARTLE_CAUSE_LABELS[k]}</option>)}
        </select>
      )}
      {cond.kind === 'woundsDealt' && (
        <span className="cond-time">PB infligés
          <select className="cond-kind" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input type="number" min={0} className="dr" value={cond.value} onChange={(e) => onChange({ ...cond, value: Math.max(0, Number(e.target.value) || 0) })} />
        </span>
      )}
      {cond.kind === 'engagedAdvantageGap' && (
        <span className="cond-time">écart d’Avantage
          <select className="cond-kind" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input type="number" min={0} className="dr" value={cond.value} onChange={(e) => onChange({ ...cond, value: Math.max(0, Number(e.target.value) || 0) })} />
        </span>
      )}
      {cond.kind === 'engagedAdvantageLead' && (
        <span className="cond-time">avance d’Avantage
          <select className="cond-kind" value={cond.op} onChange={(e) => onChange({ ...cond, op: e.target.value as CompareOp })}>
            {COMPARE_OPS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <input type="number" className="dr" value={cond.value} onChange={(e) => onChange({ ...cond, value: Number(e.target.value) || 0 })} />
        </span>
      )}
      {cond.kind === 'relation' && (
        <span className="cond-time">
          <select className="cond-kind" value={cond.who} onChange={(e) => onChange({ ...cond, who: e.target.value as ActorRef })}>
            {(Object.keys(WHO_LABEL) as ActorRef[]).map((w) => <option key={w} value={w}>{WHO_LABEL[w]}</option>)}
          </select>
          est
          <select className="cond-kind" value={cond.is} onChange={(e) => onChange({ ...cond, is: e.target.value as Relation | Camp })}>
            <optgroup label="relatif au lanceur">
              {(['self', 'ally', 'opponent'] as const).map((r) => <option key={r} value={r}>{REL_LABEL[r]}</option>)}
            </optgroup>
            <optgroup label="camp absolu">
              {(['party', 'neutral', 'hostile'] as const).map((r) => <option key={r} value={r}>{REL_LABEL[r]}</option>)}
            </optgroup>
          </select>
        </span>
      )}
      {cond.kind === 'has' && (
        <span className="cond-time">
          <select className="cond-kind" value={cond.who} onChange={(e) => onChange({ ...cond, who: e.target.value as ActorRef })}>
            {(Object.keys(WHO_LABEL) as ActorRef[]).map((w) => <option key={w} value={w}>{WHO_LABEL[w]}</option>)}
          </select>
          a
          <select className="cond-kind" value={cond.what} onChange={(e) => onChange({ ...cond, what: e.target.value as 'group' | 'talent' | 'trait' | 'psych' })}>
            {(Object.keys(WHAT_LABEL) as ('group' | 'talent' | 'trait' | 'psych')[]).map((w) => <option key={w} value={w}>{WHAT_LABEL[w]}</option>)}
          </select>
          <input className="cond-flag" value={cond.value} placeholder={cond.what === 'group' ? 'Groupe (ex. Morts-vivants)' : cond.what === 'talent' ? 'id Talent (ex. magie-des-arcanes)' : cond.what === 'psych' ? 'type psy (ex. frenesie)' : 'id Trait (ex. mort-vivant)'} onChange={(e) => onChange({ ...cond, value: e.target.value })} />
          {cond.what === 'talent' && (
            <input style={{ width: '6em' }} value={cond.spec ?? ''} placeholder="spéc. (Feu…)" onChange={(e) => onChange({ ...cond, spec: e.target.value || undefined })} />
          )}
        </span>
      )}
      {cond.kind === 'casterChaosDomain' && (
        <span className="cond-time">
          Domaine du Chaos du lanceur =
          <input className="cond-flag" value={cond.is} placeholder="nurgle / slaanesh / tzeentch / indivisible" onChange={(e) => onChange({ ...cond, is: e.target.value })} />
        </span>
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
