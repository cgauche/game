import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown, testPending } from './breakdown';
import {
  battleSceneById, battleActivityById, sceneDeltas, testResolution, activityOutcomes, INSPIRE_BONUS,
} from '../engine/massBattle';

/**
 * Jet de PJ d'une bataille de masse (ADE II 08) : Discours inspirant (l.71), Scène cinématique de
 * Compétence (Motivation/Duel/Ligne de mire…, l.149-225), Activité pré-combat (Planification/Sabotage…,
 * l.79-106) ou Rassemblement (Résistance, l.122). Même coquille que les autres modales de jet
 * (Lancer -> Chance/Pacte/Résilience -> Appliquer).
 */
export function BattleTestModal() {
  const pt = useGame((s) => s.pendingBattleTest);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.battleTestRoll);
  const reroll = useGame((s) => s.battleTestReroll);
  const bonusSL = useGame((s) => s.battleTestBonusSL);
  const darkPact = useGame((s) => s.battleTestDarkPact);
  const force = useGame((s) => s.battleTestForceSuccess);
  const confirm = useGame((s) => s.battleTestConfirm);
  const cancel = useGame((s) => s.battleTestCancel);
  if (!pt) return null;
  const actor = party.find((c) => c.id === pt.actorId);
  const rolled = pt.roll != null;
  const outcome = rolled ? describeBattleTest(pt) : undefined;
  return (
    <RollFlowShell
      variant="test"
      title={pt.label}
      actor={actor}
      subtitle={null}
      rolled={rolled}
      onRoll={roll}
      onCancel={cancel}
      breakdown={rolled ? testBreakdown(pt.skill, pt.skillValue, { roll: pt.roll!, target: pt.target, sl: pt.sl, success: pt.success }, pt.difficulty) : undefined}
      pending={testPending(pt.skill, pt.skillValue, pt.roll != null ? pt.target : undefined, pt.difficulty)}
      outcome={outcome && <p className="rm-journal">{outcome}</p>}
      fortune={actor?.fortune ?? 0}
      freeReroll={freeRerollOf(actor)}
      rerollable={rolled && canReroll(pt.roll! > pt.target, !!pt.rerolled)}
      onReroll={reroll}
      onBonusSL={bonusSL}
      darkPactable={rolled && pt.roll! > pt.target && actor?.kind === 'hero'}
      onDarkPact={darkPact}
      resilience={actor?.resilience ?? 0}
      onForce={force}
      forceShow={rolled && !pt.success}
      confirmLabel="Appliquer"
      onConfirm={confirm}
    />
  );
}

/** Issue lisible du jet, pré-application (le delta de Puissance est calculé à l'identique du flux). */
function describeBattleTest(pt: NonNullable<ReturnType<typeof useGame.getState>['pendingBattleTest']>): string {
  if (pt.purpose === 'inspire') {
    return pt.success
      ? `Troupes galvanisées : +${INSPIRE_BONUS} au Test de Puissance du premier Round.`
      : 'Le discours tombe à plat — aucun bonus au premier Round.';
  }
  if (pt.purpose === 'rally') {
    return pt.success ? `Récupération : DR ${pt.sl} + Bonus d'Endurance de Blessures soignées.` : 'Aucune récupération.';
  }
  if (pt.purpose === 'activity' && pt.activityId) {
    const def = battleActivityById(pt.activityId);
    if (!def) return pt.success ? 'Succès.' : 'Échec.';
    const outcomes = activityOutcomes(def, pt.success, pt.sl);
    if (!outcomes.length) return pt.success ? 'Succès — sans effet chiffré.' : 'Échec — sans effet.';
    return `${pt.success ? (pt.sl >= 6 ? 'Succès Stupéfiant' : 'Succès') : 'Échec Stupéfiant'} : ${outcomes.map(activityOutcomeText).join(' ; ')}.`;
  }
  // Scène cinématique.
  if (!pt.success) return 'La Scène échoue — aucun effet sur la Puissance.';
  const scene = pt.sceneId ? battleSceneById(pt.sceneId) : undefined;
  if (!scene) return 'Succès.';
  const deltas = sceneDeltas(scene, testResolution(pt.success, pt.sl));
  if (!deltas.length) return 'Succès — aucun effet sur la Puissance.';
  return `Succès : ${deltas.map((d) => `Puissance ${d.side === 'ally' ? 'alliée' : 'ennemie'} ${d.amount >= 0 ? '+' : ''}${d.amount}`).join(' ; ')}.`;
}

function activityOutcomeText(o: { target: string; amount: number }): string {
  const label: Record<string, string> = {
    allyTestMod: 'aux Tests de Puissance alliés', allyMight: 'Puissance alliée', enemyMight: 'Puissance ennemie',
    firstRoundBonus: 'au premier Round', planningBonus: 'à la Planification',
  };
  return `${o.amount >= 0 ? '+' : ''}${o.amount} ${label[o.target] ?? o.target}`;
}
