import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollFlowShell } from './RollFlowShell';
import { RollPanel } from './RollPanel';
import type { CascadeStep } from '../state/pendings';
import type { Combatant } from '../engine/types';

/** Une étape DÉJÀ validée, empilée en lecture seule au-dessus de l'étape courante (jet verrouillé
 *  + conséquence). Même panneau de jet (`RollPanel`) que le flot de base. */
function DoneStep({ step, actor }: { step: CascadeStep; actor: Combatant }) {
  const res = step.result;
  if (!res) return null;
  const base = step.base ?? step.target ?? 0;
  return (
    <div className="cascade-done">
      <div className="cascade-step-label">{step.icon ?? '🎲'} {step.label}</div>
      <RollPanel rows={[{ combatant: actor, d: { label: step.rollLabel ?? 'Jet', base, modifier: (step.target ?? base) - base, target: step.target ?? base, roll: res.roll, success: res.success, sl: res.sl } }]} />
      <div className={`cs-outcome ${res.success ? 'ok-text' : 'muted'}`}>
        {res.success ? `réussite (+${res.sl} DR)` : `échec (${res.sl} DR)`}{step.outcome?.length ? ` · ${step.outcome.join(' ')}` : ''}
      </div>
    </div>
  );
}

/**
 * CASCADE séquentielle influençable (jets de NUIT / VOYAGE) — sur la COQUILLE de jet partagée
 * (`RollFlowShell`, comme Psychologie/Attaque) : l'étape COURANTE est un jet standard (Lancer →
 * Chance/+1 DR/Pacte/Résilience → « Valider »). Les jets DÉJÀ validés s'EMPILENT en lecture seule
 * au-dessus (slot `extra`) — on voit la chaîne se construire ; une défaillance impacte la suite.
 */
export function CascadeModal() {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const p = useGame((s) => s.pendingCascade);
  const roll = useGame((s) => s.cascadeRoll);
  const reroll = useGame((s) => s.cascadeReroll);
  const bonusSL = useGame((s) => s.cascadeBonusSL);
  const darkPact = useGame((s) => s.cascadeDarkPact);
  const force = useGame((s) => s.cascadeForceSuccess);
  const next = useGame((s) => s.cascadeNext);
  const cancel = useGame((s) => s.cascadeCancel);

  if (!p) return null;
  const cur = p.participants[p.cursor];
  if (!cur) return null;
  const pool: Combatant[] = battle?.combatants ?? party;
  const actor = cur.actorId ? pool.find((c) => c.id === cur.actorId) : undefined;
  if (!actor) return null;
  const res = cur.result;
  const curRolled = cur.target == null ? true : !!res;
  const failed = !!res && !res.success;
  const isLast = p.cursor + 1 >= p.participants.length;
  const base = cur.base ?? cur.target ?? 0;

  return (
    <RollFlowShell
      title={`${p.icon ?? '🎲'} ${p.title}`}
      subtitle={<>étape {p.cursor + 1} / {p.participants.length}</>}
      extra={
        <>
          {p.log.length > 0 && (
            <ul className="cascade-log">{p.log.slice(-4).map((l, i) => <li key={i}>{l}</li>)}</ul>
          )}
          {p.participants.slice(0, p.cursor).map((s) => {
            const a = s.actorId ? pool.find((c) => c.id === s.actorId) : undefined;
            return a ? <DoneStep key={s.id} step={s} actor={a} /> : null;
          })}
          <div className="cascade-step-label is-current">{cur.icon ?? '🎲'} {cur.label}</div>
        </>
      }
      rolled={curRolled}
      rollLabel="🎲 Lancer"
      onRoll={() => roll(cur.id)}
      onCancel={cancel}
      cancelLabel="Renoncer"
      cancelAfterRoll
      breakdown={res ? { label: cur.rollLabel ?? 'Jet', base, modifier: (cur.target ?? base) - base, target: cur.target ?? base, roll: res.roll, success: res.success, sl: res.sl } : undefined}
      pending={!res && cur.target != null ? { label: cur.rollLabel ?? 'Jet', base, mods: cur.base != null && cur.target !== cur.base ? [{ label: 'difficulté', value: cur.target - cur.base }] : [] } : undefined}
      outcome={res ? <div className={`cs-outcome ${res.success ? 'ok-text' : 'muted'}`}>{res.success ? `réussite (+${res.sl} DR)` : `échec (${res.sl} DR)`}</div> : undefined}
      fortune={actor.fortune ?? 0}
      freeReroll={freeRerollOf(actor)}
      rerollable={!!res && canReroll(failed, !!cur.rerolled)}
      onReroll={() => reroll(cur.id)}
      onBonusSL={() => bonusSL(cur.id)}
      darkPactable={!!res && failed && actor.kind === 'hero'}
      onDarkPact={() => darkPact(cur.id)}
      resilience={actor.resilience ?? 0}
      onForce={() => force(cur.id)}
      forceShow={curRolled}
      confirmLabel={isLast ? '✅ Valider · Terminer' : '✅ Valider →'}
      onConfirm={() => next()}
    />
  );
}
