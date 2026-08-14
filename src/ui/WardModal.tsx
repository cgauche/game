import { useGame } from '../state/store';
import { flowStakeRef } from '../data';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { effectiveChar } from '../engine/characteristics';
import { RollShell, type RollAction } from './RollShell';
import { buildRollRow, type BuiltRollRow } from './rollRowBuild';
import { testBreakdown, testPending } from './breakdown';
import { recapLineOfEvent } from '../gameIso/combatNarration';
import { ev } from '../state/combatLog';
import { describeWard } from '../state/flowOutcomes';
import { Icon } from './Icon';

/**
 * Modale de la Bénédiction de Protection (LDB 41 l.105) : « Les ennemis doivent effectuer un Test de
 * Force Mentale Accessible (+20) pour attaquer votre cible […]. Sur un échec, ils doivent choisir une
 * cible ou une Action différente. » Le Test du HÉROS attaquant DIFFÈRE la déclaration d'attaque sur une
 * cible bénie — succès → l'attaque est relancée ; échec → l'attaque n'a pas lieu (rien n'est consommé).
 */
export function WardModal() {
  const pw = useGame((s) => s.pendingWard);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.wardRoll);
  const reroll = useGame((s) => s.wardReroll);
  const darkPact = useGame((s) => s.wardDarkPact);
  const force = useGame((s) => s.wardForceSuccess);
  const confirm = useGame((s) => s.wardConfirm);
  const cancel = useGame((s) => s.wardCancel);
  if (!pw || !battle) return null;
  const attacker = battle.combatants.find((x) => x.id === pw.attackerId);
  const target = battle.combatants.find((x) => x.id === pw.targetId);
  if (!attacker) return null;
  const r = pw.result;
  const rolled = !!r;

  const actorRow: BuiltRollRow = buildRollRow({
    actor: attacker,
    row: {
      combatant: attacker,
      d: r ? testBreakdown('Force Mentale', effectiveChar(attacker, 'force-mentale'), { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, 'accessible') : undefined,
      pending: testPending('Force Mentale', effectiveChar(attacker, 'force-mentale'), undefined, 'accessible'),
    },
    freeReroll: freeRerollOf(attacker),
    onRoll: roll,
    rerollable: !!r && !r.success && canReroll(true, !!pw.rerolled),
    onReroll: reroll,
    darkPactable: !!r && attacker.kind === 'hero', // LDB 19 l.17
    onDarkPact: darkPact,
    onForce: force,
    forceShow: !r?.success,
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="ward"
      stake={flowStakeRef('ward', 'roll')}
      title={<><Icon id="action/defend" size="sm" /> Bénédiction de Protection</>}
      subtitle={
        <>
          <strong>{attacker.label}</strong> ose frapper {target?.label ?? 'la cible bénie'} (Test de FM +20)
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r ? [recapLineOfEvent(ev('info', describeWard(pw, target?.label ?? 'la cible bénie'), attacker.id, target?.id), battle.combatants)] : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
