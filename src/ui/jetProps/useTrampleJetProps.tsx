import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { canReroll } from '../../engine/fortune';
import { freeRerollOf } from '../../engine/activeFlags';
import { combatValue } from '../../engine/combat';
import { RollShell, type RollAction } from '../RollShell';
import { buildRollRow, type BuiltRollRow } from '../rollRowBuild';
import { testPending } from '../breakdown';
import { recapLineOfEvent } from '../../gameIso/combatNarration';
import { ev } from '../../state/combatLog';
import { Icon } from '../Icon';
import { VsHeader } from '../VsHeader';
import { trampleFreeMove } from '../../state/combatFlow';

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
  // Voie de PAIEMENT réelle : prédicat PARTAGÉ avec la porte ET le débit (`trampleFreeMove`) — ce que
  // la fenêtre annonce est exactement ce que `trampleConfirm` dépense.
  const freeMoveAction = trampleFreeMove(battle, attacker);

  const actorRow: BuiltRollRow = buildRollRow({
    actor: attacker,
    row: {
      combatant: attacker,
      d: r?.attackerDetail,
      pending: testPending('Bagarre', combatValue(attacker, 'melee')),
    },
    freeReroll: freeRerollOf(attacker),
    onRoll: roll,
    rerollable: !!r && canReroll(!r.attackerDetail?.success, !!pt.rerolled),
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: !!r && !r.attackerDetail?.success && attacker.kind === 'hero',
    onDarkPact: darkPact,
    onForce: force,
    forceShow: !r?.hit,
  }, {
    // Résilience AVANT le jet (LDB 17 l.68) : on lance puis on force la réussite.
    preRollForce: () => { roll(); force(); },
  });

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'always' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return {
    flowKey: 'trample',
    title: <><Icon id="resource/movement" size="sm" /> Piétinement</>,
    // A→B canonique (décision utilisateur 2026-08-04) : portraits + flèche, jamais une phrase
    // « X écrase Y ». Le COÛT est annoncé sur la flèche : c'est un prérequis de RESSOURCE (débité à
    // l'ouverture, `combatSlice.battleTrample`), pas un modificateur du jet — il n'a rien à faire sur
    // la ligne. Sa nature est DÉRIVÉE de la même condition que la porte (LDB 85 l.320 / l.314).
    extra: (
      <VsHeader
        actor={attacker}
        target={target}
        label={`Piétinement · coûte ${freeMoveAction ? 'une Action de Mouvement' : '1 Avantage'}`}
        verb="melee/trample"
      />
    ),
    rows: [actorRow],
    rolled,
    outcome: r ? [recapLineOfEvent(ev('attack', r.log, attacker.id, target.id), battle.combatants)] : undefined,
    actions,
    onCancel: cancel,
  };
}
