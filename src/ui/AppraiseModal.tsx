import { useGame, type PendingAppraise } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';

/** Vue pure de la modale d'Évaluation (testable sans store). */
export function AppraiseModalView({
  pa,
  fortune,
  freeReroll,
  onRoll,
  onReroll,
  onBonusSL,
  onDarkPact,
  onConfirm,
  onCancel,
}: {
  pa: PendingAppraise;
  fortune: number;
  freeReroll?: boolean;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onDarkPact?: () => void;
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
      breakdown={rolled ? testBreakdown('Évaluation', pa.skillValue, { roll: pa.roll!, target: pa.target, sl: pa.sl, success: pa.success }, pa.difficulty) : undefined}
      outcome={rolled && (
        <JournalLine
          className="rm-journal"
          event={ev('info', pa.success ? `${pa.actorName} jauge ${pa.itemName} : révélé ✓.` : `${pa.actorName} n'en tire rien — ${pa.itemName} reste inchangé.`)}
        />
      )}
      fortune={fortune}
      freeReroll={freeReroll}
      rerollable={rolled && pa.roll != null && canReroll(pa.roll > pa.target, !!pa.rerolled)}
      onReroll={onReroll}
      onBonusSL={onBonusSL}
      darkPactable={rolled && pa.roll! > pa.target}
      onDarkPact={onDarkPact}
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
  const darkPact = useGame((s) => s.appraiseDarkPact);
  const confirm = useGame((s) => s.resolveAppraise);
  const cancel = useGame((s) => s.appraiseCancel);
  if (!pa) return null;
  const actor = party.find((c) => c.id === pa.actorId);
  return <AppraiseModalView pa={pa} fortune={actor?.fortune ?? 0} freeReroll={freeRerollOf(actor)} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onDarkPact={darkPact} onConfirm={confirm} onCancel={cancel} />;
}
