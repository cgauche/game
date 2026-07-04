import { useGame } from '../state/store';
import { FLOWS } from '../state/rollFlowSpecs';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { combatValue } from '../engine/combat';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';

/**
 * Modale de Piétinement (LDB 85 - Traits de créature.md l.320-321) : action gratuite à 1 Avantage.
 * « Lancer » résout l'attaque de Bagarre (BF), « Chance » la rejoue, « Appliquer » l'inflige.
 *
 */
export function TrampleModal() {
  const pt = useGame((s) => s.pendingTrample);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.trampleRoll);
  const reroll = useGame((s) => s.trampleReroll);
  const bonusSL = useGame((s) => s.trampleBonusSL);
  const darkPact = useGame((s) => s.trampleDarkPact);
  const force = useGame((s) => s.trampleForceSuccess);
  const setForcedRoll = useGame((s) => s.trampleSetForcedRoll);
  const confirm = useGame((s) => s.trampleConfirm);
  const cancel = useGame((s) => s.trampleCancel);
  if (!pt || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pt.attackerId);
  const target = battle.combatants.find((c) => c.id === pt.targetId);
  if (!attacker || !target) return null;
  const r = pt.result;
  const rolled = !!r;
  // Dé choisi (« Je ne faillirai pas ! ») : source UNIQUE = `caps.picker` du flux (cf. rollFlows).
  const forcedDie = FLOWS.trample.picker?.(pt, attacker);

  const actorRow: RollRowData = {
    actor: attacker,
    row: {
      combatant: attacker,
      d: r?.attackerDetail,
      pending: testPending('Bagarre', combatValue(attacker, 'melee')),
    },
    rolled,
    freeReroll: freeRerollOf(attacker),
    onRoll: roll,
    rerollable: !!r && canReroll(!r.attackerDetail?.success, !!pt.rerolled),
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: !!r && !r.attackerDetail?.success && attacker.kind === 'hero',
    onDarkPact: darkPact,
    onForce: force,
    // Résilience AVANT le jet (LDB 17 l.73) : on lance puis on force la réussite.
    preRollForce: () => { roll(); force(); },
    forceShow: !r?.hit,
    // LDB 17 l.73 : Piétinement forcé = attaque → le dé se choisit (11 → Coup Critique).
    forcedRoll: forcedDie ? { ...forcedDie, onSet: setForcedRoll } : undefined,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', kind: 'ghost', onClick: cancel, when: 'always' },
    { key: 'confirm', label: 'Appliquer', kind: 'primary', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      title="🦶 Piétinement"
      subtitle={
        <>
          <strong>{attacker.name}</strong> écrase <strong>{target.name}</strong> (coûte 1 Avantage)
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r && <JournalLine className="rm-journal" event={ev('attack', r.log, attacker.id, target.id)} combatants={battle.combatants} />}
      actions={actions}
      onCancel={cancel}
    />
  );
}
