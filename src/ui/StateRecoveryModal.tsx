import { useGame, type PendingStateRecovery } from '../state/store';
import { canReroll } from '../engine/fortune';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';

/** Vue pure de la modale « se libérer » (Empêtré) / « se rouler » (En flammes). Testable sans store. */
export function StateRecoveryModalView({
  sr,
  fortune,
  onRoll,
  onReroll,
  onBonusSL,
  onDarkPact,
  onConfirm,
  onCancel,
}: {
  sr: PendingStateRecovery;
  fortune: number;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onDarkPact?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rolled = sr.roll != null;
  const removed = sr.success ? Math.min(sr.stacks, 1 + Math.max(0, sr.netSL)) : 0;
  const sub = sr.opposed
    ? `${sr.skillLabel} (opposé) contre ${sr.opponentName}`
    : `${sr.skillLabel}, cible ${sr.roll?.target ?? sr.skillValue}`;

  return (
    <RollFlowShell
      variant="test"
      title={`${sr.state === 'Empêtré' ? 'Se libérer' : 'Se rouler au sol'} — ${sr.state}`}
      subtitle={
        <>
          <strong>{sr.actorName}</strong> — {sub} · {sr.stacks} pion{sr.stacks > 1 ? 's' : ''}
        </>
      }
      rolled={rolled}
      onRoll={onRoll}
      onCancel={onCancel}
      /* Test opposé : deux lignes de jet (acteur puis source), comme Attaque/Défense. */
      breakdown={rolled
        ? [
            testBreakdown(sr.skillLabel, sr.skillValue, sr.roll!),
            ...(sr.opposed && sr.opponentRoll && sr.opponentValue != null
              ? [testBreakdown(`${sr.opponentName ?? 'Source'} — Force`, sr.opponentValue, sr.opponentRoll)]
              : []),
          ]
        : undefined}
      outcome={rolled && (
        <JournalLine
          className="rm-journal"
          event={ev('condition', `${sr.actorName} ${sr.success ? `se dégage (${sr.netSL >= 0 ? '+' : ''}${sr.netSL} DR net) : ${removed} pion${removed > 1 ? 's' : ''} retiré${removed > 1 ? 's' : ''}` : 'n’y parvient pas — aucun pion retiré'}.`, sr.actorId)}
        />
      )}
      fortune={fortune}
      rerollable={rolled && canReroll(!sr.success, !!sr.rerolled)}
      onReroll={onReroll}
      onBonusSL={onBonusSL}
      darkPactable={rolled && !sr.success}
      onDarkPact={onDarkPact}
      onConfirm={onConfirm}
    />
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
  const darkPact = useGame((s) => s.recoverDarkPact);
  const confirm = useGame((s) => s.recoverConfirm);
  const cancel = useGame((s) => s.recoverCancel);
  if (!sr || !battle) return null;
  const fortune = battle.combatants.find((c) => c.id === sr.actorId)?.fortune ?? 0;
  return (
    <StateRecoveryModalView sr={sr} fortune={fortune} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onDarkPact={darkPact} onConfirm={confirm} onCancel={cancel} />
  );
}
