import { useGame } from '../state/store';

/** Affiche le résultat d'un test de compétence interactif (brique « tests »). */
export function TestModal() {
  const pt = useGame((s) => s.pendingTest);
  const resolve = useGame((s) => s.resolveTest);
  if (!pt) return null;
  return (
    <div className="modal-overlay">
      <div className="modal test-modal">
        <h3>{pt.label}</h3>
        <p className="test-actor">
          <strong>{pt.actorName}</strong> tente sa chance…
        </p>
        <div className={`test-result ${pt.success ? 'ok' : 'fail'}`}>
          <span className="dice">{pt.roll === 100 ? '00' : String(pt.roll).padStart(2, '0')}</span>
          <span className="vs">/ {pt.target}</span>
          <span className="verdict">
            {pt.success ? 'Réussite' : 'Échec'} ({pt.sl >= 0 ? '+' : ''}
            {pt.sl} DR)
          </span>
        </div>
        <button className="btn btn-primary" onClick={resolve}>
          Continuer
        </button>
      </div>
    </div>
  );
}
