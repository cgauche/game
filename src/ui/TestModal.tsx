import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { RollFlowShell, Dice } from './RollFlowShell';

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
  const forceSuccess = useGame((s) => s.testForceSuccess);
  const resolve = useGame((s) => s.resolveTest);
  if (!pt) return null;
  const rolled = pt.roll != null;
  const actor = party.find((c) => c.id === pt.actorId);

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
      resultOk={pt.success}
      result={
        rolled && (
          <>
            <span className="dice">
              <Dice roll={pt.roll!} />
            </span>
            <span className="vs">/ {pt.target}</span>
            <span className="verdict">
              {pt.success ? 'Réussite' : 'Échec'} ({pt.sl >= 0 ? '+' : ''}
              {pt.sl} DR)
            </span>
          </>
        )
      }
      fortune={actor?.fortune ?? 0}
      rerollable={rolled && pt.roll != null && canReroll(pt.roll > pt.target, !!pt.rerolled)}
      onReroll={reroll}
      onBonusSL={bonusSL}
      resilience={actor?.resilience ?? 0}
      onForce={forceSuccess}
      forceShow={rolled && !pt.success}
      confirmLabel="Continuer"
      onConfirm={resolve}
    />
  );
}
