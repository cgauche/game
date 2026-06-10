import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';

/**
 * Test de compétence interactif (brique « tests », hors combat). On clique
 * « Lancer » pour faire le jet, puis on peut dépenser un point de Chance pour
 * relancer avant d'acquitter le résultat (LDB Destin). Test obligatoire (pas d'« Annuler »).
 */
export function TestModal() {
  const pt = useGame((s) => s.pendingTest);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.testRoll);
  const reroll = useGame((s) => s.testReroll);
  const bonusSL = useGame((s) => s.testBonusSL);
  const darkPact = useGame((s) => s.testDarkPact);
  const forceSuccess = useGame((s) => s.testForceSuccess);
  const resolve = useGame((s) => s.resolveTest);
  if (!pt) return null;
  const rolled = pt.roll != null;
  const actor = party.find((c) => c.id === pt.actorId);
  const outcomeText = pt.forced
    ? `${pt.actorName} ne faillit pas (Résilience) : réussite garantie.`
    : pt.success
      ? `${pt.actorName} réussit.`
      : `${pt.actorName} échoue.`;

  return (
    <RollFlowShell
      variant="test"
      title={pt.label}
      subtitle={
        <>
          <strong>{pt.actorName}</strong> — cible {pt.target}
          {pt.psychMod ? (
            <span className="test-psych-mod" title="Trait psychologique envers l'interlocuteur (LDB 21)">
              {' '}
              · {pt.psychDetail ?? `psychologie ${pt.psychMod}`}
            </span>
          ) : null}
        </>
      }
      rolled={rolled}
      onRoll={roll}
      breakdown={rolled ? testBreakdown(pt.label, pt.skillValue, { roll: pt.roll!, target: pt.target, sl: pt.sl, success: pt.success }, pt.difficulty) : undefined}
      outcome={rolled && <JournalLine className="rm-journal" event={ev('info', outcomeText, pt.actorId)} combatants={party} />}
      fortune={actor?.fortune ?? 0}
      rerollable={rolled && pt.roll != null && canReroll(pt.roll > pt.target, !!pt.rerolled)}
      onReroll={reroll}
      onBonusSL={bonusSL}
      darkPactable={rolled && pt.roll! > pt.target}
      onDarkPact={darkPact}
      resilience={actor?.resilience ?? 0}
      onForce={forceSuccess}
      forceShow={rolled && !pt.success}
      confirmLabel="Continuer"
      onConfirm={resolve}
    />
  );
}
