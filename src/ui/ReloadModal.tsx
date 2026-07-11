import { useGame, type PendingReload } from '../state/store';
import type { Combatant } from '../engine/types';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending, soutienMod } from './breakdown';
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
  // Soutien des servants (Arme d'équipe, MDG ch.12 l.462) : ligne de mod comme tout bonus, base SANS le Soutien.
  const supMod = soutienMod(pr.soutien);
  const base = pr.skillValue - (supMod?.value ?? 0);

  const actorRow: RollRowData = {
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown('Projectiles', base, { roll: pr.roll!, target: pr.target, sl: pr.sl, success: pr.success }, pr.difficulty, supMod ? [supMod] : undefined) : undefined,
      pending: testPending('Projectiles', base, pr.target, pr.difficulty, supMod ? [supMod] : undefined),
    },
    rolled,
    fortune,
    freeReroll,
    rerollable: rolled && pr.roll != null && canReroll(pr.roll > pr.target, !!pr.rerolled),
    onRoll,
    onReroll,
    onBonusSL,
    darkPactable: rolled && pr.roll! > pr.target,
    onDarkPact,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: onCancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: onConfirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="reload"
      variant="test"
      title="Recharger"
      subtitle={<>{weaponName}</>}
      /* QUI recharge → portrait dans la ligne de jet ; Projectiles/cible vivent dans le cadre, le cumul dans le DrBar. */
      /* Test ÉTENDU (#23) : barre de DR cumulé vers l'Indice de Recharge. */
      extra={<DrBar cum={rolled ? after : pr.progressBefore} target={pr.reload} />}
      rows={[actorRow]}
      rolled={rolled}
      outcome={rolled && (
        <JournalLine
          className="rm-journal"
          event={ev('reload', describeReload(pr, after, weaponName), pr.actorId)}
        />
      )}
      actions={actions}
      onCancel={rolled ? undefined : onCancel}
    />
  );
}

/**
 * Rechargement d'une arme à distance = Test étendu de Projectiles (LDB 62 l.335 :
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
