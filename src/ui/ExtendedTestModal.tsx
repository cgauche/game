import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { Modal } from './Modal';
import { ParticipantRow } from './ParticipantRow';

/**
 * Test Étendu SÉQUENTIEL (LDB 12 l.197-211) — pendant UI du flux `extendedTest`. Un acteur enchaîne
 * des Rounds (le slot courant = le dernier de `rounds`) : « Lancer » → DR du Round (Chance/+1 DR/
 * Pacte/Résilience), « Round suivant » CUMULE le DR vers la cible (`extendedTestNext`). Total < 0 →
 * « recommence à zéro » ; total ≥ cible → réussite. Ex. crocheter une serrure DR cible 5.
 */
export function ExtendedTestModal() {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const p = useGame((s) => s.pendingExtendedTest);
  const roll = useGame((s) => s.extendedTestRoll);
  const reroll = useGame((s) => s.extendedTestReroll);
  const bonusSL = useGame((s) => s.extendedTestBonusSL);
  const darkPact = useGame((s) => s.extendedTestDarkPact);
  const force = useGame((s) => s.extendedTestForceSuccess);
  const next = useGame((s) => s.extendedTestNext);
  const cancel = useGame((s) => s.extendedTestCancel);
  if (!p) return null;
  const pool = battle?.combatants ?? party;
  const actor = pool.find((c) => c.id === p.actorId);
  if (!actor) return null;
  const cur = p.rounds[p.rounds.length - 1];
  const res = cur.result;
  const rolled = !!res;
  const projected = rolled ? p.total + res!.sl : p.total;
  const willSucceed = rolled && Math.max(0, projected) >= p.targetDR;
  const willReset = rolled && projected < 0;
  const row = res
    ? { combatant: actor, d: { label: p.skillLabel, base: p.target, modifier: 0, target: p.target, roll: res.roll, success: res.success, sl: res.sl } }
    : { combatant: actor, pending: { label: p.skillLabel, base: p.target, mods: [] } };

  return (
    <Modal title={`🗝️ ${p.label}`} variant="roll" onClose={cancel}>
      <p className="rm-vs">
        <strong>{actor.name}</strong> — DR cumulé <b>{p.total}</b> / {p.targetDR} · Round {p.rounds.length}
      </p>
      <div className="mini-title">Test Étendu — chaque Round AJOUTE son DR jusqu'à la cible</div>
      <ParticipantRow
        actor={actor}
        row={row}
        rolled={rolled}
        rollLabel="🎲 Lancer"
        onRoll={() => roll(cur.id)}
        rerollable={rolled && canReroll(!res!.success, !!cur.rerolled)}
        onReroll={() => reroll(cur.id)}
        onBonusSL={() => bonusSL(cur.id)}
        darkPactable={actor.kind === 'hero' && rolled && !res!.success}
        onDarkPact={() => darkPact(cur.id)}
        onForce={() => force(cur.id)}
        forceShow={rolled}
        extra={res && (
          <div className={`cs-outcome ${res.sl >= 0 ? 'ok-text' : 'muted'}`}>
            {res.sl >= 0 ? `+${res.sl} DR` : `${res.sl} DR`} → total {Math.max(0, projected)}/{p.targetDR}
            {willReset ? ' (retombé à 0 !)' : ''}
          </div>
        )}
      />
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={cancel}>Renoncer</button>
        <button className="btn btn-primary" onClick={() => next()} disabled={!rolled}>
          {willSucceed ? '✅ Réussir !' : 'Round suivant →'}
        </button>
      </div>
    </Modal>
  );
}
