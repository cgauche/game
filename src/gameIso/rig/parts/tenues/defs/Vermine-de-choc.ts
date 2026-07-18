import type { TenueDef } from '../types';

// Vermine de choc : armure de lamelles RÉGULIÈRES (élite — vs les lamelles dépareillées du
// skaven de clan) + casque conique à couvre-nuque (museau libre) + écharpe rouge de clan.
export const tenue: TenueDef = {
  name: 'Vermine de choc',
  // métal BRONZE/laiton (illustration LDB 85 p.339 : l'élite skavenne est cuirassée d'airain)
  palette: { vet1: '#3a3630', vet2: '#7a2018', cuir: '#3a2c1e', metal: '#9a7a38' },
  set: {
    torse: `<g stroke-linejoin="round">`
      // plastron de lamelles régulières (3 rangs nets)
      + `<path d="M-12 -27 Q0 -31 12 -27 L11 30 Q0 34 -11 30 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.8"/>`
      + `<g fill="@metal" stroke="#23262c" stroke-width="0.5">`
      + `<path d="M-11 -25 h4.6 v8 h-4.6 Z M-5.6 -26 h4.8 v8.6 h-4.8 Z M0 -26 h4.8 v8.6 h-4.8 Z M5.6 -25 h4.6 v8 h-4.6 Z"/>`
      + `<path d="M-10.6 -15 h4.6 v8 h-4.6 Z M-5.2 -15.6 h4.8 v8.6 h-4.8 Z M0.4 -15.6 h4.8 v8.6 h-4.8 Z M6 -15 h4.4 v8 h-4.4 Z"/>`
      + `<path d="M-10 -5 h4.4 v8 h-4.4 Z M-4.8 -5.4 h4.6 v8.4 h-4.6 Z M0.6 -5.4 h4.6 v8.4 h-4.6 Z M6 -5 h4.2 v8 h-4.2 Z"/>`
      + `</g>`
      // écharpe rouge de clan PAR-DESSUS l'armure (marque de clan visible)
      + `<path d="M-12 -24 L10 24 L6 28 L-14 -20 Z" fill="@vet2" stroke="@vet2O" stroke-width="0.6"/>`
      + `<rect x="-11" y="6" width="22" height="4.4" rx="1" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
      + `<rect x="-2.2" y="6.4" width="4.4" height="3.6" rx="0.6" fill="@metal" stroke="#23262c" stroke-width="0.4"/>`
      + `</g>`,
    bras: `<g stroke-linejoin="round">`
      + `<path d="M-5.6 -3 Q0 -6.4 5.6 -3 Q6.4 2.5 4.8 6 Q0 8.4 -4.8 6 Q-6.4 2.5 -5.6 -3 Z" fill="@metal" stroke="#23262c" stroke-width="0.8"/>`
      + `<path d="M-4.8 0.5 L4.8 0.5 M-4.4 3.5 L4.4 3.5" stroke="#23262c" stroke-width="0.5" opacity="0.7"/>`
      + `<path d="M-3.8 6.5 Q0 8.4 3.8 6.5 L3.4 18 Q0 19.5 -3.4 18 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
      + `<path d="M-3.2 18 L3.2 18 L3 26 Q0 27.5 -3 26 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
      + `</g>`,
    jambes: `<g stroke-linejoin="round">`
      // jupe de lamelles courte + jambes en bandes de cuir
      + `<path d="M-5 0 Q0 -1.6 5 0 L4.6 12 Q0 14 -4.6 12 Z" fill="@cuir" stroke="@cuirO" stroke-width="0.7"/>`
      + `<g fill="@metal" stroke="#23262c" stroke-width="0.4"><path d="M-4.4 1 h2.6 v9 h-2.6 Z M-1.2 0.6 h2.6 v9.6 h-2.6 Z M2 1 h2.4 v9 h-2.4 Z"/></g>`
      + `<path d="M-3.8 12 Q-4.4 28 -3.4 44 L3.4 44 Q4.4 28 3.8 12 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
      + `<path d="M-3.6 18 L3.6 21 M-3.6 26 L3.6 29 M-3.4 34 L3.4 37" stroke="@cuir" stroke-width="1.5" stroke-linecap="round"/>`
      + `</g>`,
    tete: `<g stroke-linejoin="round">`
      // casque conique à nasale + couvre-nuque (posé HAUT : le museau de rat reste libre)
      + `<path d="M-8.5 -4 Q-9 -13 0 -17.5 Q9 -13 8.5 -4 Q0 -7 -8.5 -4 Z" fill="@metal" stroke="#23262c" stroke-width="0.9"/>`
      + `<path d="M0 -17.5 L0 -5.5" stroke="#23262c" stroke-width="0.9"/>`
      + `<path d="M0 -17.5 L0 -22 L1.8 -17.2 Z" fill="@metal" stroke="#23262c" stroke-width="0.5"/>`
      + `<path d="M-8.4 -4.6 Q-10 1 -8 5.5 L-5.5 4 Q-7 0 -6.6 -3.6 Z M8.4 -4.6 Q10 1 8 5.5 L5.5 4 Q7 0 6.6 -3.6 Z" fill="@metal" stroke="#23262c" stroke-width="0.6"/>`
      + `<path d="M-7.6 -7.5 Q0 -10.5 7.6 -7.5" fill="none" stroke="@metalH" stroke-width="0.8" opacity="0.6"/>`
      + `</g>`,
  },
};
