import { useGame } from '../state/store';
import { findSpellById } from '../data/index';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { castingValue } from '../engine/magic';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeFocus } from '../state/flowOutcomes';
import { DrBar } from './DrBar';

/**
 * Modale de Focalisation (LDB — Test étendu de Focalisation) : « Lancer » accumule du DR vers le NI,
 * « Chance » rejoue/ajoute, « Appliquer » fige l'accumulation.
 */
export function FocusModal() {
  const pf = useGame((s) => s.pendingFocus);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.focusRoll);
  const reroll = useGame((s) => s.focusReroll);
  const bonusSL = useGame((s) => s.focusBonusSL);
  const darkPact = useGame((s) => s.focusDarkPact);
  const force = useGame((s) => s.focusForceSuccess);
  const confirm = useGame((s) => s.focusConfirm);
  const cancel = useGame((s) => s.focusCancel);
  if (!pf) return null;
  const caster = (battle?.combatants ?? party).find((c) => c.id === pf.casterId); // combat (file) ou hors combat (groupe)
  if (!caster) return null;
  const spell = findSpellById(pf.spellId);
  const ni = spell?.cn ?? 0;
  const prev = caster.focus?.spell === pf.spellId ? caster.focus.dr : 0;
  const r = pf.result;

  return (
    <RollFlowShell
      title="✨ Focalisation"
      subtitle={
        <>
          <strong>{caster.name}</strong> focalise <strong>{spell?.label ?? pf.spellId}</strong> ({prev}/{ni} DR)
        </>
      }
      /* Test ÉTENDU (#23) : barre de DR cumulé vers le NI du sort. */
      extra={<DrBar cum={Math.min(ni, prev + (r?.dr ?? 0))} target={ni} />}
      rolled={!!r}
      onRoll={roll}
      onCancel={cancel}
      cancelAfterRoll
      breakdown={r ? testBreakdown('Focalisation', castingValue(caster, 'Focalisation'), { roll: r.roll, target: r.target, sl: r.sl ?? r.dr, success: r.dr > 0 }) : undefined}
      pending={testPending('Focalisation', castingValue(caster, 'Focalisation'))}
      outcome={r && (
        <JournalLine
          className="rm-journal"
          event={ev('focus', describeFocus(pf, prev, ni), caster.id)}
          combatants={battle?.combatants ?? party}
        />
      )}
      fortune={caster.fortune ?? 0}
      freeReroll={freeRerollOf(caster)}
      rerollable={!!r && canReroll(r.dr === 0, !!pf.rerolled)}
      onReroll={reroll}
      onBonusSL={bonusSL}
      darkPactable={!!r && r.dr === 0 && caster.kind === 'hero'}
      onDarkPact={darkPact}
      resilience={caster.resilience ?? 0}
      onForce={force}
      forceShow={r?.dr === 0}
      onConfirm={confirm}
    />
  );
}
