import type { ProsthesisDef } from '../types';

// Moignon bandé : poignet de chair terminé par un bandage arrondi (pas de poing).
export const prosthesis: ProsthesisDef = {
  id: 'moignon',
  label: 'Moignon bandé',
  art: '<g data-injury="moignon"><rect x="-1.8" y="-5" width="3.6" height="6" rx="1.6" fill="@peau"/><ellipse cx="0" cy="1.4" rx="2" ry="1.7" fill="#d8cdb4" stroke="#a89878" stroke-width="0.4"/><path d="M-1.9 -0.8 h3.8 M-1.8 0.6 h3.6" stroke="#d8cdb4" stroke-width="1.1"/></g>',
};
