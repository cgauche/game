import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { testValue } from '../engine/skills';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';

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
  const darkPact = useGame((s) => s.runDarkPact);
  const force = useGame((s) => s.runForceSuccess);
  const confirm = useGame((s) => s.runConfirm);
  const cancel = useGame((s) => s.runCancel);
  if (!pr || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pr.combatantId);
  if (!c) return null;
  const r = pr.result;
  // À cheval, la Course se teste sur Chevaucher (LDB 14 l.215) — même compétence que le flux `run`.
  const skill = c.mountId ? 'Chevaucher' : 'Athlétisme';

  return (
    <RollFlowShell
      title="🏃 Course"
      subtitle={
        <>
          <strong>{c.name}</strong> s'élance (Test {skill === 'Chevaucher' ? 'de Chevaucher' : "d'Athlétisme"} +20)
        </>
      }
      rolled={!!r}
      onRoll={roll}
      onCancel={cancel}
      breakdown={r ? testBreakdown(skill, testValue(c, skill), { roll: r.roll, target: r.target, sl: r.dr, success: r.success }, 'accessible') : undefined}
      outcome={r && (
        <JournalLine
          className="rm-journal"
          event={ev('move', `${r.success ? 'Course !' : 'Course poussive'} → +${r.bonusCases} cases (Marche + Course + DR).`, c.id)}
          combatants={battle.combatants}
        />
      )}
      fortune={c.fortune ?? 0}
      rerollable={!!r && !r.success && canReroll(true, !!pr.rerolled)}
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
