import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending, soutienMod } from './breakdown';
import type { ModLine } from '../engine/combat';
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
  // Tous les modificateurs en LIGNES (comme partout) : le Soutien (l.153/157, LDB 12, fondu dans `skillValue`)
  // ET le mod de SITUATION (Menace l.219 / Préparation) — la base est montrée SANS le Soutien, et les lignes
  // se réconcilient avec le total (RollLine n'affiche les chips que si leur somme = modificateur).
  const supMod = soutienMod(pt.support);
  const sitMod = pt.mod ? { label: pt.modLabel ?? 'Situation', value: pt.mod } : undefined;
  const extraMods = [supMod, sitMod].filter((m): m is ModLine => !!m);
  const base = pt.skillValue - (supMod?.value ?? 0);

  const actorRow: RollRowData = {
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown(pt.skill, base, { roll: pt.roll!, target: pt.target, sl: pt.sl, success: pt.success }, pt.difficulty, extraMods.length ? extraMods : undefined) : undefined,
      pending: testPending(pt.skill, base, pt.roll != null ? pt.target : undefined, pt.difficulty, extraMods.length ? extraMods : undefined),
    },
    rolled,
    freeReroll: freeRerollOf(actor),
    onRoll: roll,
    rerollable: rolled && canReroll(pt.roll! > pt.target, !!pt.rerolled),
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: rolled && pt.roll! > pt.target && actor?.kind === 'hero',
    onDarkPact: darkPact,
    onForce: force,
    forceShow: rolled && !pt.success,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', kind: 'ghost', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', kind: 'primary', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      variant="test"
      title={pt.label}
      rows={[actorRow]}
      rolled={rolled}
      outcome={outcome && <p className="rm-journal">{outcome}</p>}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
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
    // Test COMBINÉ (l.75/102) : RÉUSSIT sur `full` ; DR de palier = le PLUS FAIBLE des deux.
    const success = pt.combinedLevel ? pt.combinedLevel === 'full' : pt.success;
    const sl = pt.combinedLevel ? Math.min(pt.sl, pt.sl2 ?? pt.sl) : pt.sl;
    const combinedNote = pt.combinedLevel === 'partial'
      ? ` (Test combiné : ${pt.skill} ${pt.success ? '✓' : '✗'}, ${pt.skill2} ${pt.success2 ? '✓' : '✗'} — une seule réussie)` : '';
    const outcomes = activityOutcomes(def, success, sl);
    if (!outcomes.length) return success ? 'Succès — sans effet chiffré.' : `Échec${combinedNote} — sans effet.`;
    return `${success ? (sl >= 6 ? 'Succès Stupéfiant' : 'Succès') : 'Échec Stupéfiant'} : ${outcomes.map(activityOutcomeText).join(' ; ')}.`;
  }
  if (pt.purpose === 'hold') {
    // Tenez votre position (l.161) : le PJ défend, l'ennemi fait monter le Point de rupture.
    return pt.success
      ? 'La position tient ce Round — Puissance ennemie −2 ; l\'ennemi redoublera d\'efforts.'
      : 'L\'ennemi gagne du terrain — le Point de rupture monte.';
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
