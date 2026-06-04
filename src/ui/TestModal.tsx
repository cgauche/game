import { useGame } from '../state/store';

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
  const resolve = useGame((s) => s.resolveTest);
  if (!pt) return null;
  const rolled = pt.roll != null;
  const fortune = party.find((c) => c.id === pt.actorId)?.fortune ?? 0;

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
              {fortune > 0 && (
                <button className="btn" onClick={reroll} title="Dépense un point de Chance pour relancer le jet">
                  🍀 Chance ({fortune})
                </button>
              )}
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
