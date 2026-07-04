import type { ProsthesisDef } from '../types';

// Merveille d'ingénierie (main) : paume d'acier rivetée + doigts articulés.
export const prosthesis: ProsthesisDef = {
  id: 'main-mecanique',
  label: 'Main mécanique',
  art: '<g data-injury="main-mecanique"><rect x="-2.2" y="-5" width="4.4" height="5.6" rx="1" fill="@metal" stroke="#3a4048" stroke-width="0.45"/><circle cx="0" cy="-2.2" r="0.5" fill="#3a4048"/><path d="M-1.9 1 q-0.3 2.6 0.3 4.4 M-0.6 1.2 q-0.1 2.8 0.2 4.8 M0.7 1.2 q0.1 2.8 -0.2 4.8 M1.9 1 q0.3 2.6 -0.3 4.4" stroke="@metal" stroke-width="1" fill="none" stroke-linecap="round"/><path d="M-2 2.6 h4" stroke="#3a4048" stroke-width="0.4" opacity="0.7"/></g>',
};
