import { useGame, type PendingBargain } from '../state/store';
import { canReroll } from '../engine/fortune';
import { ChanceButtons } from './ChanceButtons';

function dice(r: number): string {
  return r === 100 ? '00' : String(r).padStart(2, '0');
}

/** Vue pure de la modale de Marchandage (Test opposé, testable sans store). */
export function BargainModalView({
  pb,
  fortune,
  onRoll,
  onReroll,
  onBonusSL,
  onConfirm,
  onCancel,
}: {
  pb: PendingBargain;
  fortune: number;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rolled = pb.roll != null && pb.result != null;
  const rerollable = rolled && pb.roll != null && canReroll(pb.roll.roll > pb.roll.target, !!pb.rerolled);
  const won = pb.result?.attackerWins ?? false;
  const drNet = pb.result?.netSL ?? 0;
  const discount = won ? (drNet >= 6 || pb.negotiator ? '−20 %' : '−10 %') : '—';

  return (
    <div className="modal-overlay">
      <div className="modal test-modal">
        <h3>Marchander — {pb.merchantName}</h3>
        <p className="test-actor">
          <strong>{pb.playerName}</strong> — Marchandage {pb.playerSkill} contre {pb.merchantName} {pb.merchantValue}
          {pb.negotiator && ' · Négociateur'}
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
            <div className={`test-result ${won ? 'ok' : 'fail'}`}>
              <span className="dice">{dice(pb.roll!.roll)}</span>
              <span className="vs">/ {pb.roll!.target}</span>
              <span className="verdict">
                vous {pb.roll!.sl >= 0 ? '+' : ''}
                {pb.roll!.sl} DR · marchand {dice(pb.merchantRoll!.roll)}/{pb.merchantRoll!.target} ({pb.merchantRoll!.sl >= 0 ? '+' : ''}
                {pb.merchantRoll!.sl} DR) →{' '}
                {won ? `Gagné (${discount} à l'achat, ½ à la vente)` : 'Perdu (vente réduite à ¼)'}
              </span>
            </div>
            <div className="modal-actions">
              <ChanceButtons fortune={fortune} rerollable={rerollable} onReroll={onReroll} onBonusSL={onBonusSL} />
              <button className="btn btn-primary" onClick={onConfirm}>
                Conclure
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Marchandage (LDB 60 l.12 : « réduire le prix de 10 % … 20 % avec un Succès Stupéfiant ou Négociateur »).
 * Test OPPOSÉ Marchandage (le meilleur négociateur du groupe) contre le Marchandage du marchand. « Lancer »
 * fait les deux jets, une Chance est possible avant de conclure (relance/+1 DR côté joueur). Le résultat est
 * verrouillé pour la visite (1 marchandage) et module les prix d'achat (−10/−20 %) et de vente (½ ou ¼).
 */
export function BargainModal() {
  const pb = useGame((s) => s.pendingBargain);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.bargainRoll);
  const reroll = useGame((s) => s.bargainReroll);
  const bonusSL = useGame((s) => s.bargainBonusSL);
  const confirm = useGame((s) => s.bargainConfirm);
  const cancel = useGame((s) => s.bargainCancel);
  if (!pb) return null;
  const fortune = party.find((c) => c.id === pb.playerId)?.fortune ?? 0;
  return <BargainModalView pb={pb} fortune={fortune} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onConfirm={confirm} onCancel={cancel} />;
}
