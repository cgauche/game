import { useGame, type PendingStateRecovery } from '../state/store';
import type { Combatant } from '../engine/types';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeStateRecovery } from '../state/flowOutcomes';

/** Vue pure de la modale « se libérer » (Empêtré) / « se rouler » (En flammes). Testable sans store. */
export function StateRecoveryModalView({
  sr,
  actor,
  fortune,
  freeReroll,
  onRoll,
  onReroll,
  onBonusSL,
  onDarkPact,
  onConfirm,
  onCancel,
}: {
  sr: PendingStateRecovery;
  /** Acteur qui se libère (jet mono-acteur côté joueur) → portrait dans la ligne de jet. */
  actor?: Combatant;
  fortune: number;
  freeReroll?: boolean;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onDarkPact?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rolled = sr.roll != null;
  // Contexte = nature du Test (opposé contre la source, ou cible) + pions ; le NOM de l'acteur est
  // montré par son portrait dans la ligne de jet (plus de nom en clair).
  const sub = sr.opposed
    ? `${sr.skillLabel} (opposé) contre ${sr.opponentName}`
    : sr.requireSl != null
      ? `${sr.skillLabel}, cible ${sr.roll?.target ?? sr.skillValue} · DR ≥ ${sr.requireSl}`
      : `${sr.skillLabel}, cible ${sr.roll?.target ?? sr.skillValue}`;

  // Rangée INTERACTIVE du joueur (pré-jet en attente puis résultat), porteuse de son cycle d'influence.
  const actorRow: RollRowData = {
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown(sr.skillLabel, sr.skillValue, sr.roll!) : undefined,
      pending: testPending(sr.skillLabel, sr.skillValue),
    },
    rolled,
    fortune,
    freeReroll,
    rerollable: rolled && canReroll(!sr.success, !!sr.rerolled),
    onRoll,
    onReroll,
    onBonusSL,
    darkPactable: rolled && !sr.success,
    onDarkPact,
  };
  // Test opposé : rangée TÉMOIN de la source (Force), figée post-jet.
  const witness: RollRowData | undefined = rolled && sr.opposed && sr.opponentRoll && sr.opponentValue != null
    ? {
        row: { d: testBreakdown(`${sr.opponentName ?? 'Source'} — Force`, sr.opponentValue, sr.opponentRoll) },
        rolled,
        interactive: false,
      }
    : undefined;

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: onCancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: onConfirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="recover"
      variant="test"
      title={`${sr.state === 'empetre' ? 'Se libérer' : 'Se rouler au sol'} — ${sr.state}`}
      subtitle={<>{sub} · {sr.stacks} pion{sr.stacks > 1 ? 's' : ''}</>}
      rows={witness ? [actorRow, witness] : [actorRow]}
      rolled={rolled}
      outcome={rolled && (
        <JournalLine
          className="rm-journal"
          event={ev('condition', describeStateRecovery(sr, sr.actorName), sr.actorId)}
        />
      )}
      actions={actions}
      onCancel={rolled ? undefined : onCancel}
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
  const actor = battle.combatants.find((c) => c.id === sr.actorId);
  return (
    <StateRecoveryModalView sr={sr} actor={actor} fortune={actor?.fortune ?? 0} freeReroll={freeRerollOf(actor)} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onDarkPact={darkPact} onConfirm={confirm} onCancel={cancel} />
  );
}
