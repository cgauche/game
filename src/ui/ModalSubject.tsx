import { CharFrame } from './CharFrame';
import type { CharVariant } from './PortraitTile';
import type { Combatant } from '../engine/types';

/**
 * Bandeau « sujet » d'une modale : la tuile-portrait unifiée (jauge, sans nom) du combattant
 * concerné. Brique PARTAGÉE (R10 généralisé) — « on sait toujours à qui une modale s'applique » :
 * Critique, Maladresse, Colère, Soin, Psychologie… Le nom vit dans la prose de la modale et dans
 * le `title`, jamais ici. `variant="full"` quand les États du sujet guident la modale (soins :
 * suivre l'Hémorragie du patient passe par passe).
 */
export function ModalSubject({ c, variant = 'vital' }: { c: Combatant; variant?: CharVariant }) {
  return (
    <div className="modal-subject">
      <CharFrame c={c} variant={variant} size="md" />
    </div>
  );
}
