import { useGame, type PendingAppraise } from '../state/store';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';

/** Vue pure de la modale d'Évaluation (testable sans store). */
export function AppraiseModalView({
  pa,
  fortune,
  onRoll,
  onReroll,
  onBonusSL,
  onConfirm,
  onCancel,
}: {
  pa: PendingAppraise;
  fortune: number;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rolled = pa.roll != null;
  const rerollable = rolled && pa.roll != null && canReroll(pa.roll > pa.target, !!pa.rerolled);

  return (
    <div className="modal-overlay">
      <div className="modal test-modal">
        <h3>Évaluer — {pa.itemName}</h3>
        <p className="test-actor">
          <strong>{pa.actorName}</strong> — Évaluation, cible {pa.target}
        </p>

        {!rolled ? (
          <div className="modal-actions">
            <button className="btn" onClick={onCancel}>
              Annuler
            </button>
            <button className="btn btn-primary" onClick={onRoll}>
              🎲 Lancer
            </button>
          </div>
        ) : (
          <>
            <div className={`test-result ${pa.success ? 'ok' : 'fail'}`}>
              <span className="dice">{pa.roll === 100 ? '00' : String(pa.roll).padStart(2, '0')}</span>
              <span className="vs">/ {pa.target}</span>
              <span className="verdict">
                {pa.success ? 'Réussite' : 'Échec'} ({pa.sl >= 0 ? '+' : ''}
                {pa.sl} DR) → {pa.success ? 'révélé ✓' : 'inchangé'}
              </span>
            </div>
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={onReroll} onBonusSL={onBonusSL} />
              <button className="btn btn-primary" onClick={onConfirm}>
                Appliquer
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Évaluation (LDB 60 l.10 : « estimer les prix des objets Rares ou Exotiques à ±10 % »). Test d'Évaluation
 * (Int) ; un succès RÉVÈLE un objet non identifié (ses qualités cachées deviennent visibles) et en donne
 * une estimation de prix. « Lancer » fait le jet, une Chance est possible avant d'acquitter (révélation).
 */
export function AppraiseModal() {
  const pa = useGame((s) => s.pendingAppraise);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.appraiseRoll);
  const reroll = useGame((s) => s.appraiseReroll);
  const bonusSL = useGame((s) => s.appraiseBonusSL);
  const confirm = useGame((s) => s.resolveAppraise);
  const cancel = useGame((s) => s.appraiseCancel);
  if (!pa) return null;
  const fortune = party.find((c) => c.id === pa.actorId)?.fortune ?? 0;
  return <AppraiseModalView pa={pa} fortune={fortune} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onConfirm={confirm} onCancel={cancel} />;
}
