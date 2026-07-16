import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { combatValue } from '../engine/combat';
import { battementFoes } from '../state/combatFlow';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { OptionChooser } from './OptionChooser';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeBattement } from '../state/flowOutcomes';
import { Icon } from './Icon';

/**
 * Modale de Battement (LDB 10 l.103 / AA 13 l.17) : Action, Test de Corps à corps NON opposé retirant
 * de l'Avantage adverse. Même patron de jet MONO d'attaquant influençable que le Piétinement — la seule
 * différence métier est l'issue (`battementConfirm` → `resolveBattement`). Le picker de cible
 * (`OptionChooser`) n'apparaît que si plusieurs adversaires sont éligibles (avant le jet).
 */
export function BattementModal() {
  const pb = useGame((s) => s.pendingBattement);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.battementRoll);
  const reroll = useGame((s) => s.battementReroll);
  const bonusSL = useGame((s) => s.battementBonusSL);
  const darkPact = useGame((s) => s.battementDarkPact);
  const force = useGame((s) => s.battementForceSuccess);
  const setFoe = useGame((s) => s.battementSetFoe);
  const confirm = useGame((s) => s.battementConfirm);
  const cancel = useGame((s) => s.battementCancel);
  if (!pb || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pb.attackerId);
  const foe = battle.combatants.find((c) => c.id === pb.foeId);
  if (!attacker || !foe) return null;
  const r = pb.result;
  const rolled = !!r;
  const foes = battementFoes(attacker, battle);

  const actorRow: RollRowData = {
    actor: attacker,
    row: {
      combatant: attacker,
      d: r ? testBreakdown('Corps à corps', combatValue(attacker, 'melee'), r) : undefined,
      pending: testPending('Corps à corps', combatValue(attacker, 'melee')),
    },
    rolled,
    freeReroll: freeRerollOf(attacker),
    onRoll: roll,
    rerollable: !!r && canReroll(!r.success, !!pb.rerolled),
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: !!r && !r.success && attacker.kind === 'hero',
    onDarkPact: darkPact,
    onForce: force,
    // Résilience AVANT le jet (LDB 17 l.73) : on lance puis on force la réussite (dé PAR DÉFAUT = DR max
    // → plus d'Avantage retiré). PAS de choix du dé : l'Avantage retiré ne dépend que du DR.
    preRollForce: () => { roll(); force(); },
    forceShow: !r?.success,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'always' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="battement"
      title={<><Icon id="action/attack" /> Battement</>}
      subtitle={
        <>
          <strong>{attacker.name}</strong> bat l'arme de <strong>{foe.name}</strong> pour lui retirer de l'Avantage (coûte l'Action)
        </>
      }
      /* Choix de la cible AVANT le jet (plusieurs adversaires éligibles) — OptionChooser partagé. */
      setup={
        foes.length > 1 ? (
          <OptionChooser
            layout="seg"
            groupLabel="Cible"
            options={foes.map((f) => ({ key: f.id, label: f.name, selected: f.id === foe.id, onSelect: () => setFoe(f.id) }))}
          />
        ) : undefined
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={r && <JournalLine className="rm-journal" event={ev('attack', describeBattement(pb, attacker.name, foe.name), attacker.id, foe.id)} combatants={battle.combatants} />}
      actions={actions}
      onCancel={cancel}
    />
  );
}
