import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending, soutienMod } from './breakdown';
import { JournalLine } from './NarratedLine';
import { Icon } from './Icon';
import { ev } from '../state/combatLog';
import { resultLine, freeCons } from '../state/rollSeam';

/**
 * Modale de Dissipation permanente (LDB 46 l.158-162 : Test étendu de Langue (Magick) → NI). « Lancer »
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
  const rolled = !!r;

  const actorRow: RollRowData = {
    actor: caster,
    row: {
      combatant: caster,
      d: r ? testBreakdown('Langue (Magick)', base, { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, undefined, supMod ? [supMod] : undefined) : undefined,
      pending: testPending('Langue (Magick)', base, undefined, undefined, supMod ? [supMod] : undefined),
    },
    rolled,
    freeReroll: freeRerollOf(caster),
    onRoll: roll,
    rerollable: !!r && canReroll(!r.success, !!pd.rerolled),
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: !!r && !r.success && caster.kind === 'hero',
    onDarkPact: darkPact,
    onForce: force,
    forceShow: !r?.success,
    /* Test ÉTENDU (Dissipation) : barre de DR de RANGÉE — site unique `RollRow` (arbitrage user 2026-07-11). */
    extendedDr: { cum, target: pd.ni },
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'always' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="dispel"
      title={<><Icon id="action/dispel" size="sm" /> Dissipation</>}
      subtitle={
        <>
          <strong>{caster.label}</strong> dissipe <strong>{pd.label}</strong> ({prev}/{pd.ni} DR)
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r && (
        <JournalLine
          className="rm-journal"
          event={ev('cast', resultLine(freeCons([`${caster.label} — Dissipation de ${pd.label} : DR ${r.sl >= 0 ? '+' : ''}${r.sl} (cumul ${cum}/${pd.ni})${cum >= pd.ni ? ' → dissipé !' : ''}.`])), caster.id)}
          combatants={battle?.combatants ?? party}
        />
      )}
      actions={actions}
      onCancel={cancel}
    />
  );
}
