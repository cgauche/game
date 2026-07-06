import { useGame, type PendingBargain } from '../state/store';
import type { Combatant } from '../engine/types';
import { spawnEnemy } from '../state/spawn';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeBargain } from '../state/flowOutcomes';

/** Vue pure de la modale de Marchandage (Test OPPOSÉ, testable sans store). */
export function BargainModalView({
  pb,
  actor,
  merchant,
  fortune,
  freeReroll,
  onRoll,
  onReroll,
  onBonusSL,
  onDarkPact,
  onConfirm,
  onCancel,
}: {
  pb: PendingBargain;
  /** Négociateur du groupe (portrait, ligne joueur). */
  actor?: Combatant;
  /** Le marchand, dérivé de l'entité de scène → portrait de la ligne adverse. */
  merchant?: Combatant;
  fortune: number;
  freeReroll?: boolean;
  onRoll: () => void;
  onReroll: () => void;
  onBonusSL: () => void;
  onDarkPact?: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const rolled = pb.roll != null && pb.result != null;
  const playerD = pb.roll ? testBreakdown('Marchandage', pb.playerSkill, pb.roll) : undefined;
  // Jet OPPOSÉ rendu façon Défense : 2 lignes à portrait (joueur + marchand), vainqueur accentué. Le
  // Marchandage du marchand reste OPAQUE → ligne `hideValue` (portrait + dé + DR, sans base/cible).
  const merchantD = rolled && pb.merchantRoll
    ? { label: 'Marchandage', base: pb.merchantValue, modifier: 0, target: pb.merchantRoll.target, roll: pb.merchantRoll.roll, success: pb.merchantRoll.success, sl: pb.merchantRoll.sl, hideValue: true }
    : null;
  const opposed = rolled && !!actor && !!merchant && !!playerD && !!merchantD;

  // Rangée INTERACTIVE du négociateur (pré-jet en attente puis résultat), porteuse de son influence.
  const actorRow: RollRowData = {
    actor,
    row: {
      combatant: actor,
      d: playerD,
      pending: testPending('Marchandage', pb.playerSkill),
    },
    rolled,
    fortune,
    freeReroll,
    rerollable: rolled && pb.roll != null && canReroll(pb.roll.roll > pb.roll.target, !!pb.rerolled),
    onRoll,
    onReroll,
    onBonusSL,
    darkPactable: rolled && pb.roll!.roll > pb.roll!.target,
    onDarkPact,
  };
  // Rangée TÉMOIN du marchand (Marchandage opaque), figée post-jet.
  const merchantRow: RollRowData | undefined = opposed
    ? { row: { combatant: merchant, d: merchantD! }, rolled, interactive: false }
    : undefined;
  const winnerIndex = opposed ? (pb.result!.attackerWins ? 0 : 1) : null;

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', kind: 'ghost', onClick: onCancel, when: 'pre' },
    { key: 'confirm', label: 'Conclure', kind: 'primary', onClick: onConfirm, when: 'post' },
  ];

  return (
    <RollShell
      variant="test"
      title={`Marchander ${pb.mode === 'buy' ? 'l’achat' : 'la vente'} — ${pb.merchantName}`}
      /* Pré-jet (1 ligne) : portrait du négociateur injecté ; post-jet opposé : 2 lignes à portrait. */
      subtitle={pb.negotiator ? <span>· Négociateur</span> : null}
      rows={merchantRow ? [actorRow, merchantRow] : [actorRow]}
      rolled={rolled}
      winnerIndex={winnerIndex}
      netSL={opposed ? pb.result!.netSL : undefined}
      outcome={rolled && <JournalLine className="rm-journal" event={ev('info', describeBargain(pb))} />}
      actions={actions}
      onCancel={rolled ? undefined : onCancel}
    />
  );
}

/**
 * Marchandage (LDB 59 l.43 : « réduire le prix de 10 % … 20 % avec un Succès Stupéfiant ou Négociateur »).
 * Test OPPOSÉ Marchandage (le meilleur négociateur du groupe) contre le Marchandage du marchand. « Lancer »
 * fait les deux jets, une Chance est possible avant de conclure (relance/+1 DR côté joueur). Le résultat est
 * verrouillé pour la visite (1 marchandage) et module les prix d'achat (−10/−20 %) et de vente (½ ou ¼).
 */
export function BargainModal() {
  const pb = useGame((s) => s.pendingBargain);
  const party = useGame((s) => s.party);
  const scene = useGame((s) => s.scene);
  const merchantState = useGame((s) => s.merchant);
  const roll = useGame((s) => s.bargainRoll);
  const reroll = useGame((s) => s.bargainReroll);
  const bonusSL = useGame((s) => s.bargainBonusSL);
  const darkPact = useGame((s) => s.bargainDarkPact);
  const confirm = useGame((s) => s.bargainConfirm);
  const cancel = useGame((s) => s.bargainCancel);
  if (!pb) return null;
  const actor = party.find((c) => c.id === pb.playerId);
  // Le marchand est une entité de scène → on en dérive un Combatant (portrait de la ligne adverse).
  const ent = merchantState ? scene?.entities.find((e) => e.id === merchantState.entityId) : undefined;
  const merchant = ent ? spawnEnemy(ent.ref, ent.statblock, ent.id, ent.pos, { appearance: ent.appearance }) : undefined;
  return <BargainModalView pb={pb} actor={actor} merchant={merchant} fortune={actor?.fortune ?? 0} freeReroll={freeRerollOf(actor)} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onDarkPact={darkPact} onConfirm={confirm} onCancel={cancel} />;
}
