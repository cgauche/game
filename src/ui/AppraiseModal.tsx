import { useGame, type PendingAppraise } from '../state/store';
import type { Combatant } from '../engine/types';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';
import { describeAppraise } from '../state/flowOutcomes';

/** Vue pure de la modale d'Évaluation (testable sans store). */
export function AppraiseModalView({
  pa,
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
  pa: PendingAppraise;
  /** Évaluateur (jet mono-acteur) → portrait dans la ligne de jet. */
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
  const rolled = pa.roll != null;
  const detect = pa.mode === 'detect';
  const skill = pa.skillLabel ?? (detect ? 'Intuition' : 'Évaluation');

  const actorRow: RollRowData = {
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown(skill, pa.skillValue, { roll: pa.roll!, target: pa.target, sl: pa.sl, success: pa.success }, pa.difficulty) : undefined,
      pending: testPending(skill, pa.skillValue, pa.target, pa.difficulty),
    },
    rolled,
    fortune,
    freeReroll,
    rerollable: rolled && pa.roll != null && canReroll(pa.roll > pa.target, !!pa.rerolled),
    onRoll,
    onReroll,
    onBonusSL,
    darkPactable: rolled && pa.roll! > pa.target,
    onDarkPact,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', kind: 'ghost', onClick: onCancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', kind: 'primary', onClick: onConfirm, when: 'post' },
  ];

  return (
    <RollShell
      variant="test"
      title={detect ? `Détecter l'aura — ${pa.itemName}` : `Évaluer — ${pa.itemName}`}
      /* QUI évalue → portrait dans la ligne de jet (plus de nom en clair) ; la cible/DR vit dans le cadre. */
      subtitle={null}
      rows={[actorRow]}
      rolled={rolled}
      outcome={rolled && (
        <JournalLine
          className="rm-journal"
          event={ev('info', describeAppraise(pa))}
        />
      )}
      actions={actions}
      onCancel={rolled ? undefined : onCancel}
    />
  );
}

/**
 * Évaluation (LDB 59 l.41 : « estimer les prix des objets Rares ou Exotiques à ±10 % »). Test d'Évaluation
 * (Int) ; un succès RÉVÈLE un objet non identifié (ses qualités cachées deviennent visibles) et en donne
 * une estimation de prix. « Lancer » fait le jet, une Chance est possible avant d'acquitter (révélation).
 */
export function AppraiseModal() {
  const pa = useGame((s) => s.pendingAppraise);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.appraiseRoll);
  const reroll = useGame((s) => s.appraiseReroll);
  const bonusSL = useGame((s) => s.appraiseBonusSL);
  const darkPact = useGame((s) => s.appraiseDarkPact);
  const confirm = useGame((s) => s.resolveAppraise);
  const cancel = useGame((s) => s.appraiseCancel);
  if (!pa) return null;
  const actor = party.find((c) => c.id === pa.actorId);
  return <AppraiseModalView pa={pa} actor={actor} fortune={actor?.fortune ?? 0} freeReroll={freeRerollOf(actor)} onRoll={roll} onReroll={reroll} onBonusSL={bonusSL} onDarkPact={darkPact} onConfirm={confirm} onCancel={cancel} />;
}
