import { useGame, type PendingBargain } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeBargain } from '../state/flowOutcomes';

/** Vue pure de la modale de Marchandage (Test opposé, testable sans store). */
export function BargainModalView({
  pb,
  fortune,
  freeReroll,
  onRoll,
  onReroll,
  onBonusSL,
  onDarkPact,
  onConfirm,
  onCancel,
}: {
  pb: PendingBargain;
  fortune: number;
  freeReroll?: boolean;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onDarkPact?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rolled = pb.roll != null && pb.result != null;
  const verdictText = describeBargain(pb);

  return (
    <RollFlowShell
      variant="test"
      title={`Marchander ${pb.mode === 'buy' ? 'l’achat' : 'la vente'} — ${pb.merchantName}`}
      subtitle={
        <>
          {/* On NE révèle PAS le Marchandage de l'adversaire (info cachée du marchand). */}
          <strong>{pb.playerName}</strong> — Marchandage {pb.playerSkill} contre {pb.merchantName}
          {pb.negotiator && ' · Négociateur'}
        </>
      }
      rolled={rolled}
      onRoll={onRoll}
      onCancel={onCancel}
      breakdown={rolled ? testBreakdown('Marchandage', pb.playerSkill, pb.roll!) : undefined}
      pending={testPending('Marchandage', pb.playerSkill)}
      /* Le jet du marchand reste opaque (on ne révèle ni sa valeur ni sa cible) : dé + DR seulement. */
      outcome={rolled && (
        <JournalLine
          className="rm-journal"
          event={ev('info', `Marchand : 🎲 ${pb.merchantRoll!.roll === 100 ? '00' : String(pb.merchantRoll!.roll).padStart(2, '0')} (${pb.merchantRoll!.sl >= 0 ? '+' : ''}${pb.merchantRoll!.sl} DR) — ${verdictText}.`)}
        />
      )}
      fortune={fortune}
      freeReroll={freeReroll}
      rerollable={rolled && pb.roll != null && canReroll(pb.roll.roll > pb.roll.target, !!pb.rerolled)}
      onReroll={onReroll}
      onBonusSL={onBonusSL}
      darkPactable={rolled && pb.roll!.roll > pb.roll!.target}
      onDarkPact={onDarkPact}
      confirmLabel="Conclure"
      onConfirm={onConfirm}
    />
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
  const darkPact = useGame((s) => s.bargainDarkPact);
  const confirm = useGame((s) => s.bargainConfirm);
  const cancel = useGame((s) => s.bargainCancel);
  if (!pb) return null;
  const actor = party.find((c) => c.id === pb.playerId);
  return <BargainModalView pb={pb} fortune={actor?.fortune ?? 0} freeReroll={freeRerollOf(actor)} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onDarkPact={darkPact} onConfirm={confirm} onCancel={cancel} />;
}
