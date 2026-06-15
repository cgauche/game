import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown, testPending } from './breakdown';
import { describeActivity } from '../state/flowOutcomes';
import { DrBar } from './DrBar';

/**
 * Jet d'Activité d'interlude (LDB 23) : Revenus (Test Accessible de la compétence de carrière,
 * LDB 08 l.135) ou lancer d'Artisanat (Test ÉTENDU de Métier — barre de DR cumulé). Même coquille
 * que les autres modales de jet (« un jet = une modale »).
 */
export function ActivityModal() {
  const pa = useGame((s) => s.pendingActivity);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.activityRoll);
  const reroll = useGame((s) => s.activityReroll);
  const bonusSL = useGame((s) => s.activityBonusSL);
  const darkPact = useGame((s) => s.activityDarkPact);
  const cancel = useGame((s) => s.activityCancel);
  const confirm = useGame((s) => s.activityConfirm);
  if (!pa) return null;
  const actor = party.find((c) => c.id === pa.heroId);
  const rolled = pa.roll != null;
  const after = Math.max(0, (pa.drBefore ?? 0) + pa.sl);
  return (
    <RollFlowShell
      variant="test"
      title={pa.label}
      subtitle={
        <>
          <strong>{actor?.name}</strong> — {pa.skillLabel}
        </>
      }
      extra={pa.kind === 'craft' ? <DrBar cum={rolled ? after : pa.drBefore ?? 0} target={pa.drTarget ?? 1} /> : undefined}
      rolled={rolled}
      onRoll={roll}
      onCancel={cancel}
      breakdown={rolled ? testBreakdown(pa.skillLabel, pa.skillValue, { roll: pa.roll!, target: pa.target, sl: pa.sl, success: pa.success }, pa.difficulty) : undefined}
      // Pré-jet : `pa.target` n'existe qu'après resolve (0 avant) → cible dérivée base+Difficulté.
      pending={testPending(pa.skillLabel, pa.skillValue, pa.roll != null ? pa.target : undefined, pa.difficulty)}
      outcome={rolled && <p className="rm-journal">{describeActivity(pa)}</p>}
      fortune={actor?.fortune ?? 0}
      freeReroll={freeRerollOf(actor)}
      rerollable={rolled && pa.roll != null && canReroll(pa.roll > pa.target, !!pa.rerolled)}
      onReroll={reroll}
      onBonusSL={bonusSL}
      darkPactable={rolled && pa.roll! > pa.target}
      onDarkPact={darkPact}
      confirmLabel="Appliquer"
      onConfirm={confirm}
    />
  );
}
