import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';

/**
 * Modale de Piétinement (LDB 85 - Traits de créature.md l.320-321) : action gratuite à 1 Avantage.
 * « Lancer » résout l'attaque de Bagarre (BF), « Chance » la rejoue, « Appliquer » l'inflige.
 * Invariante « un jet = une modale ».
 */
export function TrampleModal() {
  const pt = useGame((s) => s.pendingTrample);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.trampleRoll);
  const reroll = useGame((s) => s.trampleReroll);
  const bonusSL = useGame((s) => s.trampleBonusSL);
  const force = useGame((s) => s.trampleForceSuccess);
  const confirm = useGame((s) => s.trampleConfirm);
  const cancel = useGame((s) => s.trampleCancel);
  if (!pt || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pt.attackerId);
  const target = battle.combatants.find((c) => c.id === pt.targetId);
  if (!attacker || !target) return null;
  const r = pt.result;
  const fortune = attacker.fortune ?? 0;
  const rerollable = !!r && canReroll(!r.attackerDetail?.success, !!pt.rerolled);

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>🦶 Piétinement</h3>
        <p className="rm-vs">
          <strong>{attacker.name}</strong> écrase <strong>{target.name}</strong> (coûte 1 Avantage)
        </p>
        {!r ? (
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={roll}>
              🎲 Lancer
            </button>
            <button className="btn" onClick={cancel}>
              Annuler
            </button>
          </div>
        ) : (
          <>
            <div className={`test-result ${r.hit ? 'ok' : 'fail'}`}>
              <span className="dice">{r.attackerRoll === 100 ? '00' : String(r.attackerRoll).padStart(2, '0')}</span>
              <span className="verdict">{r.log}</span>
            </div>
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
              <ResilienceButton resilience={attacker.resilience ?? 0} show={!r.hit} onForce={force} />
              <button className="btn btn-primary" onClick={confirm}>
                Appliquer
              </button>
              <button className="btn" onClick={cancel}>
                Annuler
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
