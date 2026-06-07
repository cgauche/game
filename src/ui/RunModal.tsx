import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { ResilienceButton } from './ResilienceButton';

/**
 * Modale de Course (LDB 15-Déplacement l.79-82) : « Lancer » jette le Test d'Athlétisme (+20),
 * « Relancer »/« Réussite garantie » dépensent Chance/Résilience, « Appliquer » ouvre le déplacement
 * étendu (Marche + Course + DR). Invariante « un jet = une modale ».
 */
export function RunModal() {
  const pr = useGame((s) => s.pendingRun);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.runRoll);
  const reroll = useGame((s) => s.runReroll);
  const force = useGame((s) => s.runForceSuccess);
  const confirm = useGame((s) => s.runConfirm);
  const cancel = useGame((s) => s.runCancel);
  if (!pr || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pr.combatantId);
  if (!c) return null;
  const r = pr.result;
  const fortune = c.fortune ?? 0;
  const rerollable = !!r && !r.success && canReroll(true, !!pr.rerolled) && fortune > 0;

  return (
    <div className="modal-overlay">
      <div className="modal roll-modal">
        <h3>🏃 Course</h3>
        <p className="rm-vs">
          <strong>{c.name}</strong> s'élance (Test d'Athlétisme +20)
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
            <div className={`test-result ${r.success ? 'ok' : 'fail'}`}>
              <span className="dice">{r.roll === 100 ? '00' : String(r.roll).padStart(2, '0')}</span>
              <span className="verdict">
                {r.success ? 'Course !' : 'Course poussive'} → +{r.bonusCases} cases (Marche + Course + DR)
              </span>
            </div>
            <div className="modal-actions">
              {rerollable && (
                <button className="btn" onClick={reroll} title="Dépense un point de Chance pour relancer le Test (LDB Destin)">
                  🍀 Relancer ({fortune})
                </button>
              )}
              <ResilienceButton resilience={c.resilience ?? 0} show={!r.success} onForce={force} />
              <button className="btn btn-primary" onClick={confirm}>
                Appliquer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
