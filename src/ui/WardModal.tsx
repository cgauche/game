import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { effectiveChar } from '../engine/characteristics';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
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

  const actorRow: RollRowData = {
    actor: attacker,
    row: {
      combatant: attacker,
      d: r ? testBreakdown('Force Mentale', effectiveChar(attacker, 'FM'), { roll: r.roll, target: r.target, sl: r.sl, success: r.success }, 'accessible') : undefined,
      pending: testPending('Force Mentale', effectiveChar(attacker, 'FM'), undefined, 'accessible'),
    },
    rolled,
    freeReroll: freeRerollOf(attacker),
    onRoll: roll,
    rerollable: !!r && !r.success && canReroll(true, !!pw.rerolled),
    onReroll: reroll,
    darkPactable: !!r && !r.success && attacker.kind === 'hero',
    onDarkPact: darkPact,
    onForce: force,
    forceShow: !r?.success,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', kind: 'ghost', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', kind: 'primary', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="ward"
      title={<><Icon id="action/defend" size="sm" /> Bénédiction de Protection</>}
      subtitle={
        <>
          <strong>{attacker.name}</strong> ose frapper {target?.name ?? 'la cible bénie'} (Test de FM +20)
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r && (
        <JournalLine
          className="rm-journal"
          event={ev('info', describeWard(pw, target?.name ?? 'la cible bénie'), attacker.id, target?.id)}
          combatants={battle.combatants}
        />
      )}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
