import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown, testPending, soutienMod } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { DrBar } from './DrBar';

/**
 * Modale de Dissipation permanente (LDB 46 l.204-207 : Test étendu de Langue (Magick) → NI). « Lancer »
 * accumule du DR vers le NI du sort visé ; quand le DR cumulé atteint le NI, le sort est dissipé. Action
 * RÉPÉTÉE chaque Round (le DR persiste sur `caster.dispel`). Calque `FocusModal`.
 */
export function DispelModal() {
  const pd = useGame((s) => s.pendingDispel);
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.dispelRoll);
  const reroll = useGame((s) => s.dispelReroll);
  const bonusSL = useGame((s) => s.dispelBonusSL);
  const darkPact = useGame((s) => s.dispelDarkPact);
  const force = useGame((s) => s.dispelForceSuccess);
  const confirm = useGame((s) => s.dispelConfirm);
  const cancel = useGame((s) => s.dispelCancel);
  if (!pd) return null;
  const caster = (battle?.combatants ?? party).find((c) => c.id === pd.casterId);
  if (!caster) return null;
  const prev = caster.dispel?.spellId === pd.spellId && caster.dispel.spellCasterId === pd.spellCasterId ? caster.dispel.total : 0;
  const r = pd.result;
  const cum = Math.min(pd.ni, prev + (r?.sl ?? 0));
  // Soutien de dissipation à plusieurs (LDB 12) : ligne de mod comme tout bonus, base SANS le Soutien.
  const supMod = soutienMod(pd.support);
  const base = pd.value - (supMod?.value ?? 0);

  return (
    <RollFlowShell
      title="🌀 Dissipation"
      subtitle={
        <>
          <strong>{caster.name}</strong> dissipe <strong>{pd.label}</strong> ({prev}/{pd.ni} DR)
        </>
      }
      /* Test ÉTENDU : barre de DR cumulé vers le NI du sort. */
      extra={<DrBar cum={cum} target={pd.ni} />}
      rolled={!!r}
      onRoll={roll}
      onCancel={cancel}
      cancelAfterRoll
      breakdown={r ? testBreakdown('Langue (Magick)', base, { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, undefined, supMod ? [supMod] : undefined) : undefined}
      pending={testPending('Langue (Magick)', base, undefined, undefined, supMod ? [supMod] : undefined)}
      outcome={r && (
        <JournalLine
          className="rm-journal"
          event={ev('cast', `${caster.name} — Dissipation de ${pd.label} : DR ${r.sl >= 0 ? '+' : ''}${r.sl} (cumul ${cum}/${pd.ni})${cum >= pd.ni ? ' → dissipé !' : ''}.`, caster.id)}
          combatants={battle?.combatants ?? party}
        />
      )}
      fortune={caster.fortune ?? 0}
      freeReroll={freeRerollOf(caster)}
      rerollable={!!r && canReroll(!r.success, !!pd.rerolled)}
      onReroll={reroll}
      onBonusSL={bonusSL}
      darkPactable={!!r && !r.success && caster.kind === 'hero'}
      onDarkPact={darkPact}
      resilience={caster.resilience ?? 0}
      onForce={force}
      forceShow={!r?.success}
      onConfirm={confirm}
    />
  );
}
