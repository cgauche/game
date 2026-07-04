import type { ProsthesisDef } from '../types';

// Jambe de bois (Fausse jambe/Merveille) : cuisse au pantalon, manchette de cuir au genou, pilon de
// bois veiné — REMPLACE la jambe peinte (le pied est effacé par la machinerie).
export const prosthesis: ProsthesisDef = {
  id: 'jambe-de-bois',
  label: 'Jambe de bois',
  art: '<g data-injury="jambe-de-bois"><path d="M-3.4 0 L3.4 0 L2.8 20 L-2.8 20 Z" fill="@vet1"/><rect x="-3" y="19" width="6" height="3.6" rx="1" fill="@cuir" stroke="#2e2014" stroke-width="0.4"/><path d="M-1.5 22.6 L1.5 22.6 L0.9 50 L-0.9 50 Z" fill="#8a6a3e" stroke="#5a4226" stroke-width="0.5"/><path d="M-0.3 24 Q-0.6 37 -0.2 48" stroke="#5a4226" stroke-width="0.4" fill="none" opacity="0.6"/><ellipse cx="0" cy="50" rx="1.3" ry="0.7" fill="#5a4226"/></g>',
};
