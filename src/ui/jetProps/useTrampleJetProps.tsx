import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { canReroll } from '../../engine/fortune';
import { freeRerollOf } from '../../engine/activeFlags';
import { combatValue } from '../../engine/combat';
import { RollShell, type RollAction, type RollRowData } from '../RollShell';
import { testPending } from '../breakdown';
import { JournalLine } from '../NarratedLine';
import { ev } from '../../state/combatLog';
import { Icon } from '../Icon';

/**
 * PARAMÉTRAGE de la coquille partagée `RollShell` pour le JET de Piétinement (LDB 85 - Traits de
 * créature.md l.320-321 : action gratuite à 1 Avantage, attaque de Bagarre — BF). Rendu par la séquence
 * de combat (`CascadeModal` rend l'étape-jet
 * via ce hook, sans démonter la coquille → une seule fenêtre : le jet ET son Coup Critique). Renvoie les
 * props de `RollShell`, ou `null` si aucun Piétinement en attente. AUCUNE mécanique générique réécrite :
 * que le métier du Piétinement.
 */
export function useTrampleJetProps(): ComponentProps<typeof RollShell> | null {
  const pt = useGame((s) => s.pendingTrample);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.trampleRoll);
  const reroll = useGame((s) => s.trampleReroll);
  const bonusSL = useGame((s) => s.trampleBonusSL);
  const darkPact = useGame((s) => s.trampleDarkPact);
  const force = useGame((s) => s.trampleForceSuccess);
  const confirm = useGame((s) => s.trampleConfirm);
  const cancel = useGame((s) => s.trampleCancel);
  if (!pt || !battle) return null;
  const attacker = battle.combatants.find((c) => c.id === pt.attackerId);
  const target = battle.combatants.find((c) => c.id === pt.targetId);
  if (!attacker || !target) return null;
  const r = pt.result;
  const rolled = !!r;

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
    // Résilience AVANT le jet (LDB 17 l.68) : on lance puis on force la réussite.
    preRollForce: () => { roll(); force(); },
    forceShow: !r?.hit,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'always' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return {
    flowKey: 'trample',
    title: <><Icon id="resource/movement" size="sm" /> Piétinement</>,
    subtitle: (
      <>
        <strong>{attacker.label}</strong> écrase <strong>{target.label}</strong> (coûte 1 Avantage)
      </>
    ),
    rows: [actorRow],
    rolled,
    outcome: r ? <JournalLine className="rm-journal" event={ev('attack', r.log, attacker.id, target.id)} combatants={battle.combatants} /> : undefined,
    actions,
    onCancel: cancel,
  };
}
