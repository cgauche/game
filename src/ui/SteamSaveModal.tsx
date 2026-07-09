import { useGame } from '../state/store';
import { canReroll } from '../engine/fortune';
import { freeRerollOf } from '../engine/activeFlags';
import { RollShell, type RollAction, type RollRowData } from './RollShell';
import { testBreakdown, testPending } from './breakdown';
import { JournalLine } from './NarratedLine';
import { ev } from '../state/combatLog';

/**
 * Sauvegarde d'Initiative d'une PANNE DE VAPEUR « Fuite de vapeur » (MDG 12 l.326-328) : la personne qui
 * s'occupe du moteur teste l'Initiative sous peine d'être ébouillantée (1d10−5 Dégâts min 1, ignorent
 * l'Armure). Modale INFLUENÇABLE (Chance/+1 DR/Pacte/Résilience) — l'ÉCHEC applique l'ébouillantage puis
 * la traversée reprend (`steamSaveConfirm`). Jet PROPRE de l'acteur (aucun « Annuler » : la panne EST là).
 */
export function SteamSaveModal() {
  const p = useGame((s) => s.pendingSteamSave);
  const party = useGame((s) => s.party);
  const roll = useGame((s) => s.steamSaveRoll);
  const reroll = useGame((s) => s.steamSaveReroll);
  const bonusSL = useGame((s) => s.steamSaveBonusSL);
  const darkPact = useGame((s) => s.steamSaveDarkPact);
  const forceSuccess = useGame((s) => s.steamSaveForceSuccess);
  const confirm = useGame((s) => s.steamSaveConfirm);
  if (!p) return null;
  const actor = party.find((c) => c.id === p.actorId);
  const rolled = p.roll != null;

  const actorRow: RollRowData = {
    actor,
    row: rolled
      ? { combatant: actor, d: testBreakdown('Initiative', p.skillValue, { roll: p.roll!, target: p.target, sl: p.sl, success: p.success }, p.difficulty) }
      : { combatant: actor, pending: testPending('Initiative', p.skillValue, p.target, p.difficulty) },
    rolled,
    onRoll: roll,
    fortune: actor?.fortune ?? 0,
    freeReroll: freeRerollOf(actor),
    rerollable: rolled && canReroll(p.roll! > p.target, !!p.rerolled),
    onReroll: reroll,
    onBonusSL: bonusSL,
    darkPactable: rolled && p.roll! > p.target,
    onDarkPact: darkPact,
    resilience: actor?.resilience ?? 0,
    onForce: forceSuccess,
    forceShow: rolled && !p.success,
  };

  const actions: RollAction[] = [{ key: 'confirm', label: 'Appliquer', kind: 'primary', onClick: confirm, when: 'post' }];
  const text = !rolled
    ? 'Un jet de vapeur jaillit de la chaudière — Test d’Initiative ou ébouillanté (MDG 12).'
    : p.success ? `${p.actorName} esquive le jet de vapeur.` : `${p.actorName} est ébouillanté par le jet de vapeur !`;

  return (
    <RollShell
      flowKey="steamSave"
      variant="test"
      title="Fuite de vapeur — Initiative"
      subtitle={<>panne de vapeur · MDG ch.12</>}
      rows={[actorRow]}
      rolled={rolled}
      outcome={<JournalLine className="rm-journal" event={ev(p.success ? 'info' : 'condition', text, p.actorId)} combatants={party} />}
      actions={actions}
    />
  );
}
