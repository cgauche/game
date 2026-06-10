import { TeamPortrait } from './CombatantBadge';
import type { Combatant } from '../engine/types';

/**
 * Bandeau « sujet » d'une modale : portrait + nom (+ PV optionnel) du combattant concerné.
 * Brique PARTAGÉE (R10 généralisé) — « on sait toujours à qui une modale s'applique » : Critique,
 * Maladresse, Colère, Déviation, Soin, Psychologie, Rencontre… Une seule source pour ce motif.
 */
export function ModalSubject({ c, size = 38, pv = false }: { c: Combatant; size?: number; pv?: boolean }) {
  return (
    <div className="modal-subject">
      <TeamPortrait combatant={c} size={size} />
      <strong>{c.name}</strong>
      {pv && <span className="ms-pv">{c.wounds.current}/{c.wounds.max} PB</span>}
    </div>
  );
}
