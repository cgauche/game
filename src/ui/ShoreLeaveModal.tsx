import { useGame } from '../state/store';
import { Modal } from './Modal';
import { ChoiceButtons } from './OptionChooser';
import { Icon } from './Icon';

/**
 * Permission de RELÂCHE À TERRE (MDG 15 l.245, événement de port) : posée à l'accostage AVANT le
 * tirage de l'événement de port. « Si vous avez refusé la permission de faire relâche à terre à votre
 * équipage, cet événement [Embrigadement] n'a pas lieu » — gate aussi la Fête de Manann (l.260, le
 * bonus d'Humeur suppose la relâche autorisée). CHOIX du joueur — `resolveShoreLeave` tranche.
 */
export function ShoreLeaveModal() {
  const p = useGame((s) => s.pendingShoreLeave);
  const resolve = useGame((s) => s.resolveShoreLeave);
  if (!p) return null;
  return (
    <Modal title={<><Icon id="travel/anchor" size="sm" /> Accostage à {p.to.label}</>} variant="test">
      <p className="rm-log">
        Autorisez-vous l'équipage à faire relâche à terre pendant l'escale ? Un équipage livré à
        lui-même peut se faire embrigader de force par un navire en manque de bras — mais lui refuser
        toute sortie prive aussi le bateau des faveurs que la vie du port pourrait lui offrir.
      </p>
      <ChoiceButtons
        options={[
          { key: 'accorder', label: <><Icon id="travel/anchor" size="sm" /> Accorder la relâche</>, primary: true, onSelect: () => resolve(true), title: 'Autoriser l\'équipage à faire relâche à terre' },
          { key: 'refuser', label: <><Icon id="travel/anchor" size="sm" /> Refuser la relâche</>, onSelect: () => resolve(false), title: 'Garder l\'équipage à bord — l\'Embrigadement n\'aura pas lieu' },
        ]}
      />
    </Modal>
  );
}
