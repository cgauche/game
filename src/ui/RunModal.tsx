import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { RollFlowShell, Dice } from './RollFlowShell';

/**
 * Modale de Course (LDB 15-Déplacement l.79-82) : « Lancer » jette le Test d'Athlétisme (+20),
 * « Relancer »/« Réussite garantie » dépensent Chance/Résilience, « Appliquer » ouvre le déplacement
 * étendu (Marche + Course + DR). Test binaire → pas de « +1 DR ». Invariante « un jet = une modale ».
 */
export function RunModal() {
  const pr = useGame((s) => s.pendingRun);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.runRoll);
  const reroll = useGame((s) => s.runReroll);
  const force = useGame((s) => s.runForceSuccess);
  const confirm = useGame((s) => s.runConfirm);
  const cancel = useGame((s) => s.runCancel);
  if (!pr || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pr.combatantId);
  if (!c) return null;
  const r = pr.result;

  return (
    <RollFlowShell
      title="🏃 Course"
      subtitle={
        <>
          <strong>{c.name}</strong> s'élance (Test d'Athlétisme +20)
        </>
      }
      rolled={!!r}
      onRoll={roll}
      onCancel={cancel}
      resultOk={!!r?.success}
      result={
        r && (
          <>
            <span className="dice">
              <Dice roll={r.roll} />
            </span>
            <span className="verdict">
              {r.success ? 'Course !' : 'Course poussive'} → +{r.bonusCases} cases (Marche + Course + DR)
            </span>
          </>
        )
      }
      fortune={c.fortune ?? 0}
      rerollable={!!r && !r.success && canReroll(true, !!pr.rerolled)}
      onReroll={reroll}
      resilience={c.resilience ?? 0}
      onForce={force}
      forceShow={!r?.success}
      onConfirm={confirm}
    />
  );
}
