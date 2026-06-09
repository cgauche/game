import { useGame, type PendingAppraise } from '../state/store';
import { canReroll } from '../engine/fortune';
import { RollFlowShell, Dice } from './RollFlowShell';

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
  return (
    <RollFlowShell
      variant="test"
      title={`Évaluer — ${pa.itemName}`}
      subtitle={
        <>
          <strong>{pa.actorName}</strong> — Évaluation, cible {pa.target}
        </>
      }
      rolled={rolled}
      onRoll={onRoll}
      onCancel={onCancel}
      resultOk={pa.success}
      result={
        rolled && (
          <>
            <span className="dice">
              <Dice roll={pa.roll!} />
            </span>
            <span className="vs">/ {pa.target}</span>
            <span className="verdict">
              {pa.success ? 'Réussite' : 'Échec'} ({pa.sl >= 0 ? '+' : ''}
              {pa.sl} DR) → {pa.success ? 'révélé ✓' : 'inchangé'}
            </span>
          </>
        )
      }
      fortune={fortune}
      rerollable={rolled && pa.roll != null && canReroll(pa.roll > pa.target, !!pa.rerolled)}
      onReroll={onReroll}
      onBonusSL={onBonusSL}
      onConfirm={onConfirm}
    />
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
