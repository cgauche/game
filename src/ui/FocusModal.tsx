import { useGame } from '../state/store';
import { findSpell } from '../data/index';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { castingValue } from '../engine/magic';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { DrBar } from './DrBar';

/**
 * Modale de Focalisation (LDB — Test étendu de Focalisation) : « Lancer » accumule du DR vers le NI,
 * « Chance » rejoue/ajoute, « Appliquer » fige l'accumulation. Invariante « un jet = une modale ».
 */
export function FocusModal() {
  const pf = useGame((s) => s.pendingFocus);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.focusRoll);
  const reroll = useGame((s) => s.focusReroll);
  const bonusSL = useGame((s) => s.focusBonusSL);
  const force = useGame((s) => s.focusForceSuccess);
  const confirm = useGame((s) => s.focusConfirm);
  const cancel = useGame((s) => s.focusCancel);
  if (!pf) return null;
  const caster = (battle?.combatants ?? party).find((c) => c.id === pf.casterId); // combat (file) ou hors combat (groupe)
  if (!caster) return null;
  const spell = findSpell(pf.spellLabel);
  const ni = spell?.cn ?? 0;
  const prev = caster.focus?.spell === pf.spellLabel ? caster.focus.dr : 0;
  const r = pf.result;

  return (
    <RollFlowShell
      title="✨ Focalisation"
      subtitle={
        <>
          <strong>{caster.name}</strong> focalise <strong>{spell?.label ?? pf.spellLabel}</strong> ({prev}/{ni} DR)
        </>
      }
      /* Test ÉTENDU (#23) : barre de DR cumulé vers le NI du sort. */
      extra={<DrBar cum={Math.min(ni, prev + (r?.dr ?? 0))} target={ni} />}
      rolled={!!r}
      onRoll={roll}
      onCancel={cancel}
      cancelAfterRoll
      breakdown={r ? testBreakdown('Focalisation', castingValue(caster, 'Focalisation'), { roll: r.roll, target: r.target, sl: r.sl ?? r.dr, success: r.dr > 0 }) : undefined}
      outcome={r && (
        <JournalLine
          className="rm-journal"
          event={ev('focus', `${r.log} → ${prev + r.dr}/${ni} DR${prev + r.dr >= ni ? ' (NI 0 atteint !)' : ''}`, caster.id)}
          combatants={battle?.combatants ?? party}
        />
      )}
      fortune={caster.fortune ?? 0}
      freeReroll={freeRerollOf(caster)}
      rerollable={!!r && canReroll(r.dr === 0, !!pf.rerolled)}
      onReroll={reroll}
      onBonusSL={bonusSL}
      resilience={caster.resilience ?? 0}
      onForce={force}
      forceShow={r?.dr === 0}
      onConfirm={confirm}
    />
  );
}
