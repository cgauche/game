import { useGame } from '../state/store';
import { Modal } from './Modal';

/**
 * Combat monté (Livre de base p.14 l.219) : « Si vous tentez de toucher un Personnage qui est sur une
 * monture, vous choisissez de toucher soit le cavalier soit sa monture. » Cette modale s'ouvre quand on
 * attaque/charge un couple cavalier+monture et laisse choisir la cible :
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
    <Modal title="Combat monté — cibler ?" onClose={cancel}>
        <p className="rm-log">
          {rider.name} chevauche {mount.name}. Vous choisissez de frapper le cavalier ou sa monture (LDB 14 l.219) :
          viser le cavalier impose −10 si vous êtes plus petit que la monture ; abattre la monture désarçonne le cavalier.
        </p>
        <div className="modal-actions">
          <button className="btn" onClick={cancel}>
            Annuler
          </button>
          <button className="btn" onClick={() => select(mount.id)} title="Frapper la monture — l'abattre désarçonne le cavalier">
            🐎 La monture ({mount.name} · {mount.wounds.current}/{mount.wounds.max})
          </button>
          <button className="btn btn-primary" onClick={() => select(rider.id)} title="Frapper le cavalier (−10 si vous êtes plus petit que la monture)">
            🗡️ Le cavalier ({rider.name} · {rider.wounds.current}/{rider.wounds.max})
          </button>
        </div>
    </Modal>
  );
}
