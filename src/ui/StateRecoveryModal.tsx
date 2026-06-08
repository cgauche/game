import { useGame, type PendingStateRecovery } from '../state/store';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';

/** Vue pure de la modale « se libérer » (Empêtré) / « se rouler » (En flammes). Testable sans store. */
export function StateRecoveryModalView({
  sr,
  fortune,
  onRoll,
  onReroll,
  onBonusSL,
  onConfirm,
  onCancel,
}: {
  sr: PendingStateRecovery;
  fortune: number;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rolled = sr.roll != null;
  const rerollable = rolled && canReroll(!sr.success, !!sr.rerolled);
  const title = sr.state === 'Empêtré' ? 'Se libérer' : 'Se rouler au sol';
  const removed = sr.success ? Math.min(sr.stacks, 1 + Math.max(0, sr.netSL)) : 0;
  const sub = sr.opposed
    ? `${sr.skillLabel} (opposé) contre ${sr.opponentName}`
    : `${sr.skillLabel}, cible ${sr.roll?.target ?? sr.skillValue}`;

  return (
    <div className="modal-overlay">
      <div className="modal test-modal">
        <h3>{title} — {sr.state}</h3>
        <p className="test-actor">
          <strong>{sr.actorName}</strong> — {sub} · {sr.stacks} pion{sr.stacks > 1 ? 's' : ''}
        </p>

        {!rolled ? (
          <div className="modal-actions">
            <button className="btn" onClick={onCancel}>Annuler</button>
            <button className="btn btn-primary" onClick={onRoll}>🎲 Lancer</button>
          </div>
        ) : (
          <>
            <div className={`test-result ${sr.success ? 'ok' : 'fail'}`}>
              <span className="dice">{sr.roll!.roll === 100 ? '00' : String(sr.roll!.roll).padStart(2, '0')}</span>
              {sr.opposed && sr.opponentRoll && (
                <span className="vs">vs {sr.opponentRoll.roll === 100 ? '00' : String(sr.opponentRoll.roll).padStart(2, '0')}</span>
              )}
              <span className="verdict">
                {sr.success ? 'Réussite' : 'Échec'} ({sr.netSL >= 0 ? '+' : ''}{sr.netSL} DR)
                {' '}→ {removed > 0 ? `${removed} pion${removed > 1 ? 's' : ''} retiré${removed > 1 ? 's' : ''}` : 'aucun'}
              </span>
            </div>
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={onReroll} onBonusSL={onBonusSL} />
              <button className="btn btn-primary" onClick={onConfirm}>Appliquer</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * « Se libérer » d'un Empêtré (Test opposé de Force contre la source, LDB 16 l.61) ou « se rouler »
 * pour éteindre un En flammes (Test d'Athlétisme, l.77). Une Action ; succès ⇒ 1 + DR pions retirés.
 * « Lancer » fait le jet, une Chance est possible avant d'acquitter.
 */
export function StateRecoveryModal() {
  const sr = useGame((s) => s.pendingStateRecovery);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.recoverRoll);
  const reroll = useGame((s) => s.recoverReroll);
  const bonusSL = useGame((s) => s.recoverBonusSL);
  const confirm = useGame((s) => s.recoverConfirm);
  const cancel = useGame((s) => s.recoverCancel);
  if (!sr || !battle) return null;
  const fortune = battle.combatants.find((c) => c.id === sr.actorId)?.fortune ?? 0;
  return (
    <StateRecoveryModalView sr={sr} fortune={fortune} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onConfirm={confirm} onCancel={cancel} />
  );
}
