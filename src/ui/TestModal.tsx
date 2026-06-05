import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';
import { ResilienceButton } from './ResilienceButton';

/**
 * Test de compétence interactif (brique « tests », hors combat). On clique
 * « Lancer » pour faire le jet, puis on peut dépenser un point de Chance pour
 * relancer avant d'acquitter le résultat (LDB Destin).
 */
export function TestModal() {
  const pt = useGame((s) => s.pendingTest);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.testRoll);
  const reroll = useGame((s) => s.testReroll);
  const bonusSL = useGame((s) => s.testBonusSL);
  const forceSuccess = useGame((s) => s.testForceSuccess);
  const resolve = useGame((s) => s.resolveTest);
  if (!pt) return null;
  const rolled = pt.roll != null;
  const fortune = party.find((c) => c.id === pt.actorId)?.fortune ?? 0;
  const rerollable = rolled && pt.roll != null && canReroll(pt.roll > pt.target, !!pt.rerolled);
  const resilience = party.find((c) => c.id === pt.actorId)?.resilience ?? 0;

  return (
    <div className="modal-overlay">
      <div className="modal test-modal">
        <h3>{pt.label}</h3>
        <p className="test-actor">
          <strong>{pt.actorName}</strong> — cible {pt.target}
        </p>

        {!rolled ? (
          <div className="modal-actions">
            <button className="btn btn-primary" onClick={roll}>
              🎲 Lancer
            </button>
          </div>
        ) : (
          <>
            <div className={`test-result ${pt.success ? 'ok' : 'fail'}`}>
              <span className="dice">{pt.roll === 100 ? '00' : String(pt.roll).padStart(2, '0')}</span>
              <span className="vs">/ {pt.target}</span>
              <span className="verdict">
                {pt.success ? 'Réussite' : 'Échec'} ({pt.sl >= 0 ? '+' : ''}
                {pt.sl} DR)
              </span>
            </div>
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={reroll} onBonusSL={bonusSL} />
              <ResilienceButton resilience={resilience} show={rolled && !pt.success} onForce={forceSuccess} />
              <button className="btn btn-primary" onClick={resolve}>
                Continuer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
