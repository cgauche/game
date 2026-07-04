import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { calmeValue } from '../engine/psychology';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeApproach } from '../state/flowOutcomes';

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
  const rolled = !!r;

  const actorRow: RollRowData = {
    actor: c,
    row: {
      combatant: c,
      d: r ? testBreakdown('Calme', calmeValue(c), { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, 'intermediaire') : undefined,
      pending: testPending('Calme', calmeValue(c), undefined, 'intermediaire'),
    },
    rolled,
    fortune: c.fortune ?? 0,
    freeReroll: freeRerollOf(c),
    rerollable: !!r && !r.success && canReroll(true, !!pa.rerolled),
    onRoll: roll,
    onReroll: reroll,
    darkPactable: !!r && !r.success && c.kind === 'hero',
    onDarkPact: darkPact,
    resilience: c.resilience ?? 0,
    onForce: force,
    forceShow: !r?.success,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', kind: 'ghost', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', kind: 'primary', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      title="😨 Affronter sa Peur"
      subtitle={
        <>
          <strong>{c.name}</strong> ose approcher {src?.name ?? 'la source de sa Peur'} (Test de Calme +0)
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r && (
        <JournalLine
          className="rm-journal"
          event={ev('fear', describeApproach(pa), c.id, src?.id)}
          combatants={battle.combatants}
        />
      )}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
