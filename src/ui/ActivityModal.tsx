import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import type { ModLine } from '../engine/combat';
import { evaluateTest } from '../engine/tests';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending, soutienMod } from './breakdown';
import { describeActivity } from '../state/flowOutcomes';
import { DrBar } from './DrBar';

/**
 * Jet d'Activité (LDB 23 interlude / ADE II ch.8 BATAILLE de masse) : même coquille `RollShell` que
 * les autres modales de jet. Interlude = Revenus (Test Accessible) ou Artisanat (Test ÉTENDU, barre de
 * DR). BATAILLE = le contexte de la Scène/Activité est RENDU via les primitives de la coquille :
 * modificateur de SITUATION (Menace −20 / Planification) et Soutien multi-PJ en LIGNES de mod du
 * breakdown ; Test COMBINÉ (deux compétences, un jet) en 2ᵉ rangée témoin ; Test OPPOSÉ « Tenez votre
 * position » en rangée témoin figée de l'ennemi (winner + DR net). Le cycle d'influence reste piloté par
 * les verbes du flux `activity`.
 */
export function ActivityModal() {
  const pa = useGame((s) => s.pendingActivity);
  const party = useGame((s) => s.party);
  const massBattle = useGame((s) => s.massBattle);
  const roll = useGame((s) => s.activityRoll);
  const reroll = useGame((s) => s.activityReroll);
  const bonusSL = useGame((s) => s.activityBonusSL);
  const darkPact = useGame((s) => s.activityDarkPact);
  const cancel = useGame((s) => s.activityCancel);
  const confirm = useGame((s) => s.activityConfirm);
  if (!pa) return null;
  const actor = party.find((c) => c.id === pa.heroId);
  const rolled = pa.roll != null;
  const after = Math.max(0, (pa.drBefore ?? 0) + pa.sl);

  // Contexte de BATAILLE rendu en LIGNES de mod (source unique « base + mods » de la coquille), pas en
  // sous-titre ad hoc : Soutien multi-PJ (LDB 12, fondu dans `skillValue` → base RÉELLE = value − bonus,
  // même patron que la Dissipation à plusieurs) et modificateur de SITUATION (Menace/Planification).
  const supMod = soutienMod(pa.support);
  const situationMod: ModLine | undefined = pa.mod ? { label: pa.modLabel ?? 'Modificateur', value: pa.mod } : undefined;
  const extraMods: ModLine[] = [...(supMod ? [supMod] : []), ...(situationMod ? [situationMod] : [])];
  const base = pa.skillValue - (supMod?.value ?? 0);
  // Cible affichée : celle du jet (pré-cuite dès l'ouverture en bataille, sinon dérivée base+Difficulté).
  const target1 = rolled ? pa.target : undefined;

  // « Échec » CANONIQUE (gate des relances Chance/Pacte), aligné sur le `failed` du flux `activity` : un
  // Test combiné non-`full` (un `partial` = échec global RAW) OU une tenue perdue (opposition) OU un jet
  // simple raté (d100 > cible). Sans quoi Chance serait mal offerte quand skill-1 passe mais le combiné échoue.
  const failed = pa.combinedLevel != null
    ? pa.combinedLevel !== 'full'
    : pa.enemyValue != null
      ? !pa.success
      : (pa.roll ?? 0) > pa.target;

  const actorRow: RollRowData = {
    key: 'actor',
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown(pa.skillLabel, base, { roll: pa.roll!, target: pa.target, sl: pa.sl, success: pa.success }, pa.difficulty, extraMods.length ? extraMods : undefined) : undefined,
      pending: testPending(pa.skillLabel, base, target1, pa.difficulty, extraMods.length ? extraMods : undefined),
    },
    rolled,
    fortune: actor?.fortune ?? 0,
    freeReroll: freeRerollOf(actor),
    rerollable: rolled && pa.roll != null && canReroll(failed, !!pa.rerolled),
    onRoll: roll,
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: rolled && failed,
    onDarkPact: darkPact,
  };

  const rows: RollRowData[] = [actorRow];

  // Test COMBINÉ (Infiltration/Repérage, l.75/102 — UN jet vs DEUX compétences, LDB 12 l.229) : 2ᵉ rangée
  // TÉMOIN de la seconde compétence (même dé), l'issue lit `combinedLevel` (full/partial/fail) via `describeActivity`.
  if (pa.target2 != null && pa.skill2) {
    const secondMods = situationMod ? [situationMod] : undefined; // le Soutien ne porte que sur la compétence menante
    rows.push({
      key: 'skill2',
      row: {
        d: rolled ? testBreakdown(pa.skill2, pa.skillValue2 ?? 0, { roll: pa.roll!, target: pa.target2, sl: pa.sl2 ?? 0, success: pa.success2 }, pa.difficulty, secondMods) : undefined,
        pending: testPending(pa.skill2, pa.skillValue2 ?? 0, rolled ? pa.target2 : undefined, pa.difficulty, secondMods),
      },
      rolled,
      interactive: false,
    });
  }

  // Test OPPOSÉ « Tenez votre position » (l.161) : rangée TÉMOIN de l'ennemi (jet FIGÉ à l'ouverture),
  // montrée post-jet comme les autres modales opposées (Marchandage/Se libérer). L'issue lit `enemySL`.
  const enemyT = rolled && pa.enemyValue != null && pa.enemyRoll != null ? evaluateTest(pa.enemyRoll, pa.enemyValue) : undefined;
  const opposed = !!enemyT;
  if (enemyT) {
    const enemyName = massBattle?.enemy.name ?? 'Ennemi';
    rows.push({
      key: 'enemy',
      row: { d: testBreakdown(`${enemyName} · Puissance`, pa.enemyValue!, enemyT) },
      rolled,
      interactive: false,
    });
  }
  // Vainqueur du Test opposé : le PJ TIENT (`pa.success`) → rangée 0 accentuée, sinon l'ennemi (rangée 1).
  // DR net rapporté au PJ (positif = la position tient de cette marge) : `−enemySL` (enemySL positif = l'ennemi progresse).
  const winnerIndex = opposed ? (pa.success ? 0 : rows.length - 1) : null;
  const netSL = opposed ? -(pa.enemySL ?? 0) : undefined;

  const multi = rows.length > 1;
  const issue = rolled ? describeActivity(pa) : '';

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', kind: 'ghost', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', kind: 'primary', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="activity"
      variant="test"
      title={pa.label}
      /* QUI fait l'Activité → portrait dans la ligne de jet ; la compétence vit dans le cadre. */
      subtitle={null}
      /* Barre de DR cumulé pour tout Test ÉTENDU (Artisanat : `drTarget` peuplé par l'ouvrage en cours). */
      extra={pa.drTarget != null ? <DrBar cum={rolled ? after : pa.drBefore ?? 0} target={pa.drTarget} /> : undefined}
      rows={rows}
      rolled={rolled}
      winnerIndex={winnerIndex}
      netSL={netSL}
      /* Cas MONO (interlude / bataille simple) : issue sous la ligne. MULTI (combiné/opposé) : bandeau agrégé. */
      outcome={!multi && rolled && <p className="rm-journal">{issue}</p>}
      summary={multi && rolled ? issue : undefined}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
