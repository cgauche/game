import { CharFrame } from './CharFrame';
import type { Combatant } from '../engine/types';

/**
 * Bandeau « sujet » d'une modale : la tuile-portrait unifiée (variante `vital` — jauge, sans nom)
 * du combattant concerné. Brique PARTAGÉE (R10 généralisé) — « on sait toujours à qui une modale
 * s'applique » : Critique, Maladresse, Colère, Soin, Psychologie… Le nom vit dans la prose de la
 * modale et dans le `title`, jamais ici.
 */
export function ModalSubject({ c }: { c: Combatant }) {
  return (
    <div className="modal-subject">
      <CharFrame c={c} variant="vital" size="md" />
    </div>
  );
}
