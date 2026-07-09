import type { ComponentProps } from 'react';
import { useGame } from '../../state/store';
import { canReroll } from '../../engine/fortune';
import { freeRerollOf } from '../../engine/activeFlags';
import { RollShell } from '../RollShell';
import { DrBar } from '../DrBar';
import { testBreakdown, testPending } from '../breakdown';
import { Icon } from '../Icon';

/**
 * PARAMÉTRAGE de la coquille partagée `RollShell` pour le JET d'un Test ÉTENDU (LDB 12 l.197-211).
 * La situation « Test étendu » est une cascade à une étape `jet:'extended'`, rendue par `CascadeModal`
 * via ce hook (une seule fenêtre, comme l'attaque). `pendingExtendedTest` reste le porteur de données
 * (les Rounds y vivent) ; « Round suivant » (`extendedTestNext`) CUMULE le DR et ouvre le Round
 * suivant, ou ferme la cascade à la réussite (total ≥ cible). Total < 0 → recommence à 0.
 *
 * QUI lance → portrait dans la ligne de jet (`RollRow.row.combatant`) ; la progression = `DrBar` (cumul/cible).
 * Renvoie les props de `RollShell`, ou `null` si aucun Test étendu en attente.
 */
export function useExtendedTestJetProps(): ComponentProps<typeof RollShell> | null {
  const battle = useGame((s) => s.battle);
  const party = useGame((s) => s.party);
  const p = useGame((s) => s.pendingExtendedTest);
  const roll = useGame((s) => s.extendedTestRoll);
  const reroll = useGame((s) => s.extendedTestReroll);
  const bonusSL = useGame((s) => s.extendedTestBonusSL);
  const darkPact = useGame((s) => s.extendedTestDarkPact);
  const force = useGame((s) => s.extendedTestForceSuccess);
  const next = useGame((s) => s.extendedTestNext);
  const cancel = useGame((s) => s.extendedTestCancel);
  if (!p) return null;
  const pool = battle?.combatants ?? party;
  const actor = pool.find((c) => c.id === p.actorId);
  if (!actor) return null;
  const cur = p.rounds[p.rounds.length - 1];
  const res = cur.result;
  const rolled = !!res;
  const projected = rolled ? p.total + res!.sl : p.total;
  const cum = Math.max(0, projected);
  const willSucceed = rolled && cum >= p.targetDR;
  const willReset = rolled && projected < 0;

  return {
    flowKey: 'extendedTest',
    title: <><Icon id="ui/key" size="sm" /> {p.label}</>,
    subtitle: <>Round {p.rounds.length} · Test étendu (le DR de chaque Round se cumule)</>,
    /* Progression = barre de DR cumulé vers la cible (comme le Rechargement). */
    extra: <DrBar cum={cum} target={p.targetDR} />,
    rolled,
    rows: [
      {
        /* QUI lance → portrait dans la ligne de jet. */
        row: res
          ? { combatant: actor, d: testBreakdown(p.skillLabel, p.target, { roll: res.roll, target: p.target, sl: res.sl, success: res.success }) }
          : { combatant: actor, pending: testPending(p.skillLabel, p.target) },
        rolled,
        onRoll: () => roll(cur.id),
        fortune: actor.fortune ?? 0,
        freeReroll: freeRerollOf(actor),
        rerollable: rolled && canReroll(!res!.success, !!cur.rerolled),
        onReroll: () => reroll(cur.id),
        onBonusSL: () => bonusSL(cur.id),
        darkPactable: actor.kind === 'hero' && rolled && !res!.success,
        onDarkPact: () => darkPact(cur.id),
        resilience: actor.resilience ?? 0,
        onForce: () => force(cur.id),
        forceShow: rolled,
      },
    ],
    outcome: rolled ? (
      <p className={`rm-journal ${res!.sl >= 0 ? 'ok-text' : 'muted'}`}>
        {res!.sl >= 0 ? `+${res!.sl}` : res!.sl} DR → total {cum} / {p.targetDR}{willReset ? ' (retombé à 0 !)' : ''}
      </p>
    ) : undefined,
    /* « Round suivant » cumule + ouvre le Round suivant ; à la réussite, ferme la cascade.
       « Renoncer » disponible aussi APRÈS le jet (when:'always'). */
    actions: [
      { key: 'cancel', label: 'Renoncer', kind: 'ghost', onClick: cancel, when: 'always' },
      { key: 'confirm', label: willSucceed ? <><Icon id="ui/done" size="sm" /> Réussir !</> : 'Round suivant →', kind: 'primary', onClick: () => next(), when: 'post' },
    ],
    onCancel: cancel,
  };
}
