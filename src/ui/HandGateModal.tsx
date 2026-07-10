import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending } from './breakdown';
import { Icon } from './Icon';

/**
 * Test de Dextérité (+20) PAR ACTION de « Main ensanglantée » (Aux Armes bras 46-50, l.2569) : interposé
 * AVANT l'ouverture d'une Action d'attaque quand l'arme employée est tenue dans une main gatée. « Lancer »
 * → Chance (relance / +1 DR) / Sombre Pacte → Résilience → « Appliquer ». Sur RÉUSSITE, l'Action figée
 * s'ouvre ; sur ÉCHEC, l'objet glisse (op `disarm`) et rien d'autre n'est consommé (calque le gate de
 * Bénédiction de Protection). Coquille UNIQUE `RollShell` (calque `ReloadModal`/`HealModal`).
 */
export function HandGateModal() {
  const pg = useGame((s) => s.pendingHandGate);
  const battle = useGame((s) => s.battle);
  const roll = useGame((s) => s.handGateRoll);
  const reroll = useGame((s) => s.handGateReroll);
  const bonusSL = useGame((s) => s.handGateBonusSL);
  const darkPact = useGame((s) => s.handGateDarkPact);
  const force = useGame((s) => s.handGateForceSuccess);
  const confirm = useGame((s) => s.handGateConfirm);
  const cancel = useGame((s) => s.handGateCancel);
  if (!pg || !battle) return null;
  const actor = battle.combatants.find((c) => c.id === pg.attackerId);
  const rolled = pg.roll != null;
  const fortune = actor?.fortune ?? 0;
  const freeReroll = freeRerollOf(actor);

  const actorRow: RollRowData = {
    actor,
    row: {
      combatant: actor,
      d: rolled ? testBreakdown('Dextérité', pg.skillValue, { roll: pg.roll!, target: pg.target, sl: pg.sl, success: pg.success }, pg.difficulty) : undefined,
      pending: testPending('Dextérité', pg.skillValue, pg.target, pg.difficulty),
    },
    rolled,
    fortune,
    freeReroll,
    rerollable: rolled && canReroll(pg.roll! > pg.target, !!pg.rerolled) && (fortune > 0 || freeReroll),
    onRoll: roll,
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: rolled && pg.roll! > pg.target && actor?.kind === 'hero',
    onDarkPact: darkPact,
    resilience: actor?.resilience ?? 0,
    onForce: force,
    forceShow: !pg.success,
  };

  const actions: RollAction[] = [
    { key: 'cancel', label: 'Annuler', onClick: cancel, when: 'pre' },
    { key: 'confirm', label: 'Appliquer', onClick: confirm, when: 'post' },
  ];

  return (
    <RollShell
      flowKey="handGate"
      variant="test"
      title={<><Icon id="condition/bleeding" size="sm" /> Main ensanglantée</>}
      subtitle={
        <>
          <strong>{pg.actorName}</strong> raffermit sa prise{' '}
          <span className="rm-weapon">(Dextérité, Accessible +20)</span>
        </>
      }
      rows={[actorRow]}
      rolled={rolled}
      outcome={rolled && (
        <div className="rm-journal">
          {pg.success ? 'Réussite — il garde son arme bien en main.' : 'Échec — l’arme lui glisse des doigts.'}
        </div>
      )}
      actions={actions}
      onCancel={rolled ? undefined : cancel}
    />
  );
}
