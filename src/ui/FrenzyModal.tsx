import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { effectiveChar } from '../engine/characteristics';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeFrenzy } from '../state/flowOutcomes';

/**
 * Modale d'entrée en Frénésie (LDB 21 l.32) : « Lancer » jette le Test de Force Mentale,
 * « Relancer »/« Réussite garantie » dépensent Chance/Résilience, « Appliquer » fige le résultat
 * (entre en Frénésie sur succès). Test binaire (pas de DR) → pas de « +1 DR ». Invariante « un jet = une modale ».
 */
export function FrenzyModal() {
  const pf = useGame((s) => s.pendingFrenzy);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.frenzyRoll);
  const reroll = useGame((s) => s.frenzyReroll);
  const darkPact = useGame((s) => s.frenzyDarkPact);
  const force = useGame((s) => s.frenzyForceSuccess);
  const confirm = useGame((s) => s.frenzyConfirm);
  const cancel = useGame((s) => s.frenzyCancel);
  if (!pf || !battle) return null;
  const c = battle.combatants.find((x) => x.id === pf.combatantId);
  if (!c) return null;
  const r = pf.result;

  return (
    <RollFlowShell
      title="🐗 Frénésie"
      subtitle={
        <>
          <strong>{c.name}</strong> tente d'entrer en Frénésie (Test de Force Mentale)
        </>
      }
      rolled={!!r}
      onRoll={roll}
      onCancel={cancel}
      breakdown={r ? testBreakdown('Force Mentale', effectiveChar(c, 'FM'), { roll: r.roll, target: r.target, sl: r.sl, success: r.success }) : undefined}
      pending={testPending('Force Mentale', effectiveChar(c, 'FM'))}
      outcome={r && (
        <JournalLine
          className="rm-journal"
          event={ev('frenzy', describeFrenzy(pf, c.name), c.id)}
          combatants={battle.combatants}
        />
      )}
      fortune={c.fortune ?? 0}
      freeReroll={freeRerollOf(c)}
      rerollable={!!r && !r.success && canReroll(true, !!pf.rerolled)}
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
