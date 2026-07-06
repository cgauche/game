import { useGame } from '../state/store';
import { findSpellById } from '../data/index';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { castingValue } from '../engine/magic';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeFocus } from '../state/flowOutcomes';
import { DrBar } from './DrBar';
import { Icon } from './Icon';

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
  const rolled = !!r;

  const actorRow: RollRowData = {
    actor: caster,
    row: {
      combatant: caster,
      d: r ? testBreakdown('Focalisation', castingValue(caster, 'focalisation'), { roll: r.roll, target: r.target, sl: r.sl ?? r.dr, success: r.dr > 0 }) : undefined,
      pending: testPending('Focalisation', castingValue(caster, 'focalisation')),
    },
    rolled,
    freeReroll: freeRerollOf(caster),
    onRoll: roll,
    rerollable: !!r && canReroll(r.dr === 0, !!pf.rerolled),
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: !!r && r.dr === 0 && caster.kind === 'hero',
    onDarkPact: darkPact,
    onForce: force,
    forceShow: r?.dr === 0,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', kind: 'ghost', onClick: cancel, when: 'always' },
    { key: 'confirm', label: 'Appliquer', kind: 'primary', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      title={<><Icon id="flag/focus" size="sm" /> Focalisation</>}
      subtitle={
        <>
          <strong>{caster.name}</strong> focalise <strong>{spell?.label ?? pf.spellId}</strong> ({prev}/{ni} DR)
        </>
      }
      /* Test ÉTENDU (#23) : barre de DR cumulé vers le NI du sort. */
      extra={<DrBar cum={Math.min(ni, prev + (r?.dr ?? 0))} target={ni} />}
      rows={[actorRow]}
      rolled={rolled}
      outcome={r && (
        <JournalLine
          className="rm-journal"
          event={ev('focus', describeFocus(pf, prev, ni), caster.id)}
          combatants={battle?.combatants ?? party}
        />
      )}
      actions={actions}
      onCancel={cancel}
    />
  );
}
