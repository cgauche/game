import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { Modal } from './Modal';
import { ParticipantRow } from './ParticipantRow';
import type { CascadeStep } from '../state/pendings';
import type { Combatant } from '../engine/types';

/**
 * CASCADE séquentielle influençable (jets de NUIT / VOYAGE) — pendant UI du flux `cascade`. Les jets
 * s'EMPILENT à l'écran : chaque étape validée RESTE visible (jet verrouillé + conséquence), l'étape
 * COURANTE est active en bas (« 🎲 Lancer » → Chance/+1 DR/Pacte/Résilience → « ✅ Valider »). On voit
 * la chaîne se construire — une défaillance impacte la suite (escalade d'Exposition, abri → jets).
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
  const curRolled = cur.target == null ? true : !!cur.result;
  const isLast = p.cursor + 1 >= p.participants.length;

  const rowOf = (s: CascadeStep, actor: Combatant) => {
    const res = s.result;
    const label = s.rollLabel ?? 'Jet';
    return res
      ? { combatant: actor, d: { label, base: s.base ?? s.target!, modifier: (s.target ?? 0) - (s.base ?? s.target ?? 0), target: s.target!, roll: res.roll, success: res.success, sl: res.sl } }
      : { combatant: actor, pending: { label, base: s.base ?? s.target ?? 0, mods: s.target != null && s.base != null && s.target !== s.base ? [{ label: 'difficulté', value: s.target - s.base }] : [] } };
  };

  return (
    <Modal title={`${p.icon ?? '🎲'} ${p.title}`} variant="roll" onClose={cancel}>
      <p className="rm-vs">étape {p.cursor + 1} / {p.participants.length}</p>
      {p.log.length > 0 && (
        <ul className="cascade-log">
          {p.log.slice(-4).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
      <div className="cascade-stack">
        {p.participants.slice(0, p.cursor + 1).map((s, i) => {
          const actor = s.actorId ? pool.find((c) => c.id === s.actorId) : undefined;
          if (!actor) return null;
          const isCurrent = i === p.cursor;
          const res = s.result;
          return (
            <div key={s.id} className={`cascade-step ${isCurrent ? 'is-current' : 'is-done'}`}>
              <div className="cascade-step-label">{s.icon ?? '🎲'} {s.label}</div>
              <ParticipantRow
                actor={actor}
                row={rowOf(s, actor)}
                rolled={isCurrent ? curRolled : true}
                interactive={isCurrent}
                rollLabel="🎲 Lancer"
                onRoll={() => roll(s.id)}
                rerollable={isCurrent && !!res && canReroll(!res.success, !!s.rerolled)}
                onReroll={() => reroll(s.id)}
                onBonusSL={() => bonusSL(s.id)}
                darkPactable={isCurrent && actor.kind === 'hero' && !!res && !res.success}
                onDarkPact={() => darkPact(s.id)}
                onForce={() => force(s.id)}
                forceShow={isCurrent && curRolled}
                extra={res && (
                  <div className={`cs-outcome ${res.success ? 'ok-text' : 'muted'}`}>
                    {res.success ? `réussite (+${res.sl} DR)` : `échec (${res.sl} DR)`}
                    {!isCurrent && s.outcome?.length ? ` · ${s.outcome.join(' ')}` : ''}
                  </div>
                )}
              />
            </div>
          );
        })}
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={cancel}>Renoncer</button>
        <button className="btn btn-primary" onClick={() => next()} disabled={!curRolled} title={!curRolled ? 'Lancez d’abord le jet' : 'Verrouille ce jet et passe au suivant'}>
          {isLast ? '✅ Valider · Terminer' : '✅ Valider →'}
        </button>
      </div>
    </Modal>
  );
}
