import { useGame, type PendingReload } from '../state/store';
import type { Combatant } from '../engine/types';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeReload } from '../state/flowOutcomes';
import { DrBar } from './DrBar';

/** Vue pure de la modale de rechargement (testable sans store). */
export function ReloadModalView({
  pr,
  actor,
  fortune,
  freeReroll,
  onRoll,
  onReroll,
  onBonusSL,
  onDarkPact,
  onConfirm,
  onCancel,
}: {
  pr: PendingReload;
  /** Tireur (jet mono-acteur) → portrait dans la ligne de jet. */
  actor?: Combatant;
  fortune: number;
  freeReroll?: boolean;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onDarkPact?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rolled = pr.roll != null;
  const after = Math.max(0, pr.progressBefore + pr.sl);
  const weaponName = actor?.weapons.find((w) => w.uid === pr.weaponUid)?.name ?? 'arme'; // uid → NOM (affichage)

  return (
    <RollFlowShell
      variant="test"
      title={`Recharger — ${weaponName}`}
      /* QUI recharge → portrait dans la ligne de jet ; Projectiles/cible vivent dans le cadre, le cumul dans le DrBar. */
      actor={actor}
      subtitle={null}
      /* Test ÉTENDU (#23) : barre de DR cumulé vers l'Indice de Recharge. */
      extra={<DrBar cum={rolled ? after : pr.progressBefore} target={pr.reload} />}
      rolled={rolled}
      onRoll={onRoll}
      onCancel={onCancel}
      breakdown={rolled ? testBreakdown('Projectiles', pr.skillValue, { roll: pr.roll!, target: pr.target, sl: pr.sl, success: pr.success }, pr.difficulty) : undefined}
      pending={testPending('Projectiles', pr.skillValue, pr.target, pr.difficulty)}
      outcome={rolled && (
        <JournalLine
          className="rm-journal"
          event={ev('reload', describeReload(pr, after, weaponName), pr.actorId)}
        />
      )}
      fortune={fortune}
      freeReroll={freeReroll}
      rerollable={rolled && pr.roll != null && canReroll(pr.roll > pr.target, !!pr.rerolled)}
      onReroll={onReroll}
      onBonusSL={onBonusSL}
      darkPactable={rolled && pr.roll! > pr.target}
      onDarkPact={onDarkPact}
      onConfirm={onConfirm}
    />
  );
}

/**
 * Rechargement d'une arme à distance = Test étendu de Projectiles (LDB 63-Armures l.28-29 :
 * « une arme déchargée … nécessite un Test étendu de Projectiles … et nécessite d'obtenir
 * Indice DR pour être rechargée »). « Lancer » fait le jet, une Chance est possible avant
 * d'acquitter, et le DR obtenu se cumule vers l'Indice (12-Tests l.199-211).
 */
export function ReloadModal() {
  const pr = useGame((s) => s.pendingReload);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.reloadRoll);
  const reroll = useGame((s) => s.reloadReroll);
  const bonusSL = useGame((s) => s.reloadBonusSL);
  const darkPact = useGame((s) => s.reloadDarkPact);
  const confirm = useGame((s) => s.reloadConfirm);
  const cancel = useGame((s) => s.reloadCancel);
  if (!pr || !battle) return null;
  const actor = battle.combatants.find((c) => c.id === pr.actorId);
  return (
    <ReloadModalView pr={pr} actor={actor} fortune={actor?.fortune ?? 0} freeReroll={freeRerollOf(actor)} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onDarkPact={darkPact} onConfirm={confirm} onCancel={cancel} />
  );
}
