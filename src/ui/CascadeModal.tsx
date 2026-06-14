import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { Modal } from './Modal';
import { ParticipantRow } from './ParticipantRow';

/**
 * CASCADE séquentielle influençable (jets de NUIT / VOYAGE) — pendant UI du flux `cascade`. On
 * présente UNE étape à la fois (`participants[cursor]`) : « 🎲 Lancer » → Chance/+1 DR/Pacte/
 * Résilience → « ✅ Valider » qui VERROUILLE le jet (applique sa conséquence) AVANT de passer au
 * suivant — indispensable car une défaillance impacte la suite de la séquence (escalade d'Exposition,
 * abri → nombre de jets). Le journal de la cascade s'accumule sous l'étape. Régime SÉQUENTIEL choisi
 * par l'utilisateur (vs bilan parallèle) — cf. docs/superpowers/specs/2026-06-14-multi-roll-modal-design.md.
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
  const hasRoll = cur.target != null;
  const pool = battle?.combatants ?? party;
  const actor = cur.actorId ? pool.find((c) => c.id === cur.actorId) : undefined;
  const res = cur.result;
  const rolled = hasRoll ? !!res : true; // étape sans jet → directement validable
  const stepLabel = cur.rollLabel ?? cur.label ?? 'Jet';
  const isLast = p.cursor + 1 >= p.participants.length;
  const row = res
    ? { combatant: actor!, d: { label: stepLabel, base: cur.base ?? cur.target!, modifier: cur.target! - (cur.base ?? cur.target!), target: cur.target!, roll: res.roll, success: res.success, sl: res.sl } }
    : { combatant: actor!, pending: { label: stepLabel, base: cur.base ?? cur.target ?? 0, mods: cur.target != null && cur.base != null && cur.target !== cur.base ? [{ label: 'difficulté', value: cur.target - cur.base }] : [] } };

  return (
    <Modal title={`${p.icon ?? '🎲'} ${p.title}`} variant="roll" onClose={cancel}>
      <p className="rm-vs">
        <strong>{cur.label ?? actor?.name ?? '—'}</strong> · étape {p.cursor + 1} / {p.participants.length}
      </p>
      <div className="mini-title">Chaque jet se VERROUILLE à « Valider » — le suivant en dépend</div>
      {actor && hasRoll ? (
        <ParticipantRow
          actor={actor}
          row={row}
          rolled={rolled}
          rollLabel="🎲 Lancer"
          onRoll={() => roll(cur.id)}
          rerollable={rolled && !!res && canReroll(!res.success, !!cur.rerolled)}
          onReroll={() => reroll(cur.id)}
          onBonusSL={() => bonusSL(cur.id)}
          darkPactable={actor.kind === 'hero' && rolled && !!res && !res.success}
          onDarkPact={() => darkPact(cur.id)}
          onForce={() => force(cur.id)}
          forceShow={rolled}
          extra={res && (
            <div className={`cs-outcome ${res.success ? 'ok-text' : 'muted'}`}>
              {res.success ? `réussite (+${res.sl} DR)` : `échec (${res.sl} DR)`}
            </div>
          )}
        />
      ) : (
        <p className="cascade-note">{cur.icon ?? '•'} {cur.label}{cur.text ? ` — ${cur.text}` : ''}</p>
      )}
      {p.log.length > 0 && (
        <ul className="cascade-log">
          {p.log.slice(-6).map((l, i) => <li key={i}>{l}</li>)}
        </ul>
      )}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={cancel}>Renoncer</button>
        <button className="btn btn-primary" onClick={() => next()} disabled={!rolled} title={!rolled ? 'Lancez d’abord le jet' : 'Verrouille ce jet et passe au suivant'}>
          {isLast ? '✅ Valider · Terminer' : '✅ Valider →'}
        </button>
      </div>
    </Modal>
  );
}
