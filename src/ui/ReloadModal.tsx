import { useGame, type PendingReload } from '../state/store';
import { canReroll } from '../engine/fortune';
import { RollFlowShell } from './RollFlowShell';
import { testBreakdown } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { DrBar } from './DrBar';

/** Vue pure de la modale de rechargement (testable sans store). */
export function ReloadModalView({
  pr,
  fortune,
  onRoll,
  onReroll,
  onBonusSL,
  onConfirm,
  onCancel,
}: {
  pr: PendingReload;
  fortune: number;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rolled = pr.roll != null;
  const after = Math.max(0, pr.progressBefore + pr.sl);
  const done = after >= pr.reload;

  return (
    <RollFlowShell
      variant="test"
      title={`Recharger — ${pr.weaponName}`}
      subtitle={
        <>
          <strong>{pr.actorName}</strong> — Projectiles, cible {pr.target} · {pr.progressBefore}/{pr.reload} DR
        </>
      }
      /* Test ÉTENDU (#23) : barre de DR cumulé vers l'Indice de Recharge. */
      extra={<DrBar cum={rolled ? after : pr.progressBefore} target={pr.reload} />}
      rolled={rolled}
      onRoll={onRoll}
      onCancel={onCancel}
      breakdown={rolled ? testBreakdown('Projectiles', pr.skillValue, { roll: pr.roll!, target: pr.target, sl: pr.sl, success: pr.success }, pr.difficulty) : undefined}
      outcome={rolled && (
        <JournalLine
          className="rm-journal"
          event={ev('reload', done ? `${pr.weaponName} rechargé ✓` : `${pr.actorName} recharge ${pr.weaponName} (${after}/${pr.reload} DR).`, pr.actorId)}
        />
      )}
      fortune={fortune}
      rerollable={rolled && pr.roll != null && canReroll(pr.roll > pr.target, !!pr.rerolled)}
      onReroll={onReroll}
      onBonusSL={onBonusSL}
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
  const confirm = useGame((s) => s.reloadConfirm);
  const cancel = useGame((s) => s.reloadCancel);
  if (!pr || !battle) return null;
  const fortune = battle.combatants.find((c) => c.id === pr.actorId)?.fortune ?? 0;
  return (
    <ReloadModalView pr={pr} fortune={fortune} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onConfirm={confirm} onCancel={cancel} />
  );
}
