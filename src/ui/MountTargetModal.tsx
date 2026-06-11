import { useGame } from '../state/store';
import { Modal } from './Modal';
import { TeamPortrait } from './CombatantBadge';

/**
 * Combat monté (Livre de base p.14 l.219) : « Si vous tentez de toucher un Personnage qui est sur une
 * monture, vous choisissez de toucher soit le cavalier soit sa monture. » Cavalier et monture occupent
 * la MÊME case : cette modale DÉSAMBIGUÏSE le clic (elle reste une modale, pas un ciblage carte) :
 *  - frapper le CAVALIER : −10 au Test d'Arme si l'on est en mêlée et plus petit que la monture (l.219) ;
 *  - frapper la MONTURE : l'abattre DÉSARÇONNE le cavalier (il continue à pied — sweepDismountDeaths).
 */
export function MountTargetModal() {
  const pmt = useGame((s) => s.pendingMountTarget);
  const battle = useGame((s) => s.battle);
  const select = useGame((s) => s.mountTargetSelect);
  const cancel = useGame((s) => s.mountTargetCancel);
  if (!pmt || !battle) return null;
  const rider = battle.combatants.find((c) => c.id === pmt.riderId);
  const mount = battle.combatants.find((c) => c.id === pmt.mountId);
  if (!rider || !mount) return null;
  return (
    <Modal title="Combat monté — cibler ?" variant="test" onClose={cancel}>
      <p className="rm-log">
        {rider.name} chevauche {mount.name} (même case — qui frapper ?) : viser le cavalier impose −10 si vous êtes
        plus petit que la monture ; abattre la monture désarçonne le cavalier (LDB 14 l.219).
      </p>
      <div className="rm-options">
        <div className="rm-loc-grid">
          <button className="btn small" onClick={() => select(mount.id)} title="Frapper la monture — l'abattre désarçonne le cavalier">
            <TeamPortrait combatant={mount} size={26} /> 🐎 {mount.name} ({mount.wounds.current}/{mount.wounds.max})
          </button>
          <button className="btn small btn-primary" onClick={() => select(rider.id)} title="Frapper le cavalier (−10 si vous êtes plus petit que la monture)">
            <TeamPortrait combatant={rider} size={26} /> 🗡️ {rider.name} ({rider.wounds.current}/{rider.wounds.max})
          </button>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={cancel}>
          Annuler
        </button>
      </div>
    </Modal>
  );
}
