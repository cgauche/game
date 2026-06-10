import { useGame } from '../state/store';
import { Modal } from './Modal';

/**
 * Piège-lame (LDB 62 l.292-294) : le héros a obtenu un Critique en PARANT avec une arme Piège-lame
 * face à une arme à lame. Il choisit : infliger le Coup Critique normal (LDB 14 l.7), ou PIÉGER la
 * lame — Test opposé de Force (+ son DR de défense) : victoire = l'adversaire lâche sa lame,
 * Succès Stupéfiant = la lame est brisée (sauf Incassable), échec = l'adversaire se libère.
 */
export function BladeTrapModal() {
  const pbt = useGame((s) => s.pendingBladeTrap);
  const battle = useGame((s) => s.battle);
  const resolve = useGame((s) => s.bladeTrapResolve);
  if (!pbt || !battle) return null;
  const defender = battle.combatants.find((c) => c.id === pbt.defenderId);
  const attacker = battle.combatants.find((c) => c.id === pbt.attackerId);
  if (!defender || !attacker) return null;
  return (
    <Modal title="🗡️ Piège-lame" variant="test">
      <p className="rm-log">
        <b>{defender.name}</b> place un Critique en parant avec <b>{pbt.parryWeaponName}</b> — l'arme de{' '}
        <b>{attacker.name}</b> ({pbt.weapon.name}) est à portée du piège.
      </p>
      <p className="rm-log">
        Piéger : Test opposé de <b>Force</b> (+{pbt.defSL} DR de la défense). Victoire → {attacker.name} lâche sa
        lame ; Succès Stupéfiant → elle est <b>brisée</b> (sauf Incassable) ; échec → il se libère et le Coup
        Critique est perdu.
      </p>
      <div className="modal-actions">
        <button className="btn" onClick={() => resolve(false)} title="Infliger le Coup Critique normal (LDB 14)">
          💥 Coup Critique
        </button>
        <button className="btn btn-primary" onClick={() => resolve(true)} title="Tenter de piéger la lame (Test opposé de Force, LDB 62)">
          🗡️ Piéger la lame
        </button>
      </div>
    </Modal>
  );
}
