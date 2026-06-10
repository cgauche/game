import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { calmeValue } from '../engine/psychology';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';

/**
 * Modale d'APPROCHE d'une source de Peur (LDB 21 l.29) : « incapable de vous rapprocher … à moins de
 * réussir un Test de Calme Intermédiaire (+0) ». Test SEC qui diffère le clic d'approche — succès →
 * l'intention est relancée (approches libres ce Tour) ; échec → aucune approche ce Tour.
 */
export function ApproachModal() {
  const pa = useGame((s) => s.pendingApproach);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.approachRoll);
  const reroll = useGame((s) => s.approachReroll);
  const darkPact = useGame((s) => s.approachDarkPact);
  const force = useGame((s) => s.approachForceSuccess);
  const confirm = useGame((s) => s.approachConfirm);
  const cancel = useGame((s) => s.approachCancel);
  if (!pa || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pa.combatantId);
  const src = battle.combatants.find((x) => x.id === pa.sourceId);
  if (!c) return null;
  const r = pa.result;

  return (
    <RollFlowShell
      title="😨 Affronter sa Peur"
      subtitle={
        <>
          <strong>{c.name}</strong> ose approcher {src?.name ?? 'la source de sa Peur'} (Test de Calme +0)
        </>
      }
      rolled={!!r}
      onRoll={roll}
      onCancel={cancel}
      breakdown={r ? testBreakdown('Calme', calmeValue(c), { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, 'intermediaire') : undefined}
      outcome={r && (
        <JournalLine
          className="rm-journal"
          event={ev('fear', r.success ? 'Le cran tient : il peut approcher ce Tour.' : 'La Peur le cloue : aucune approche ce Tour.', c.id, src?.id)}
          combatants={battle.combatants}
        />
      )}
      fortune={c.fortune ?? 0}
      rerollable={!!r && !r.success && canReroll(true, !!pa.rerolled)}
      onReroll={reroll}
      darkPactable={!!r && !r.success && c.kind === 'hero'}
      onDarkPact={darkPact}
      resilience={c.resilience ?? 0}
      onForce={force}
      forceShow={!r?.success}
      onConfirm={confirm}
    />
  );
}
