import type { MovementBlockReason, MovementResolution } from '../state/combatFlow';

const BLOCK_LABEL: Record<MovementBlockReason, string> = {
  'no-battle': 'Aucun combat en cours',
  'no-scene': 'Aucune scène active',
  'combat-over': 'Combat terminé',
  targeting: 'Ciblage en cours',
  'no-active': 'Aucun combattant actif',
  'not-controlled': 'Combattant non contrôlé',
  engaged: 'Se désengager d’abord',
  'movement-spent': 'Mouvement indisponible',
  'out-of-range': 'Destination hors de portée',
  'no-path': 'Aucun chemin disponible',
};

interface MovementIntentProps {
  resolution: MovementResolution;
  remainingBefore: number;
  remainingAfter: number;
}

export function MovementIntent({ resolution, remainingBefore, remainingAfter }: MovementIntentProps) {
  const remaining = (
    <span className="row-flex">
      <span>Mouvement</span>
      <strong>{remainingBefore}</strong>
      <span aria-hidden="true">→</span>
      <strong>{remainingAfter}</strong>
    </span>
  );
  if (resolution.status === 'blocked') {
    return (
      <div className="panel row-flex" role="status">
        <span className="chip tone-danger">{BLOCK_LABEL[resolution.reason]}</span>
        {remaining}
      </div>
    );
  }
  return (
    <div className="panel row-flex" role="status">
      <span className="mini-title">{resolution.kind === 'move' ? 'Marcher' : 'Courir'}</span>
      <span className="chip">{resolution.cost} case{resolution.cost > 1 ? 's' : ''}</span>
      {remaining}
    </div>
  );
}
