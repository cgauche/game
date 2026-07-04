import type { ProsthesisDef } from '../types';

// Crochet (LDB 73) : manchon de cuir sanglé + crochet d'acier recourbé.
export const prosthesis: ProsthesisDef = {
  id: 'crochet',
  label: 'Crochet',
  art: '<g data-injury="crochet"><rect x="-2" y="-5" width="4" height="6.2" rx="1.2" fill="@cuir" stroke="#2e2014" stroke-width="0.4"/><path d="M-2 -2.6 h4 M-2 -0.6 h4" stroke="#2e2014" stroke-width="0.5" opacity="0.6"/><path d="M0 1 L0 3.6 Q0.2 7.4 -2.4 7.2 Q-4.1 6.8 -3.6 5" stroke="@metal" stroke-width="1.5" fill="none" stroke-linecap="round"/><path d="M-3.6 5 l0.5 -1.2" stroke="@metal" stroke-width="1" stroke-linecap="round"/></g>',
};
