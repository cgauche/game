import type { TenueDef } from '../types';

// Coureur d'égout : assassin furtif des clans Eshin — bandes de tissu SOMBRES croisées,
// bandages, capuche pointue (museau libre), ceinture à fioles de poison.
export const tenue: TenueDef = {
  name: "Coureur d'égout",
  palette: { vet1: '#2e2a30', vet2: '#1d1a20', cuir: '#3c3026' },
  set: {
    torse: `<g stroke-linejoin="round">`
      // tunique sombre enroulée + bandes croisées
      + `<path d="M-12 -26 Q0 -30 12 -26 L11 6 L10 32 Q0 36 -10 32 L-11 6 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
      + `<path d="M-11 -22 L11 2 M11 -22 L-11 2 M-10 -10 L10 12" stroke="@vet2" stroke-width="2.8" stroke-linecap="round"/>`
      + `<path d="M-11 -22 L11 2 M11 -22 L-11 2" stroke="@vet1O" stroke-width="0.6" opacity="0.5"/>`
      // ceinture + fioles de poison (verre vert LITTÉRAL — pas un token de palette, sinon
      // dominantCloth prend le vert pour l'étoffe dominante → torse vert en profil/dos)
      + `<rect x="-11" y="8" width="22" height="4" rx="1" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>`
      + `<rect x="-6" y="11.5" width="2.6" height="5" rx="1" fill="#5f7a4a" stroke="#2c3a24" stroke-width="0.4"/>`
      + `<rect x="-2" y="11.5" width="2.6" height="6" rx="1" fill="#5f7a4a" stroke="#2c3a24" stroke-width="0.4"/>`
      + `</g>`,
    bras: `<g stroke-linejoin="round">`
      // bandages serrés du bras (stries)
      + `<path d="M-4.4 -3 Q0 -5.4 4.4 -3 L3.8 26 Q0 28 -3.8 26 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
      + `<path d="M-4 2 L4 4 M-4 8 L4 10 M-3.8 14 L3.8 16 M-3.8 20 L3.8 22" stroke="@vet2" stroke-width="1.6" stroke-linecap="round"/>`
      + `</g>`,
    jambes: `<g stroke-linejoin="round">`
      + `<path d="M-4.6 0 Q0 -1.6 4.6 0 L3.8 44 L-3.8 44 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.7"/>`
      + `<path d="M-4 6 L4 8 M-4 14 L4 16 M-3.8 22 L3.8 24 M-3.8 30 L3.8 32 M-3.6 38 L3.6 40" stroke="@vet2" stroke-width="1.6" stroke-linecap="round"/>`
      + `</g>`,
    tete: `<g stroke-linejoin="round">`
      // capuche pointue sombre, museau de rat libre
      + `<path d="M-8.5 -3 Q-10 -14 -2 -18 Q4 -20.5 8 -15 Q10 -10 8.5 -3 Q0 -7 -8.5 -3 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.8"/>`
      + `<path d="M-2 -18 Q1 -23 6 -22 Q4 -19.5 3.4 -17.4 Z" fill="@vet1" stroke="@vet1O" stroke-width="0.6"/>`
      + `<path d="M-7.6 -5 Q0 -8.5 7.6 -5" fill="none" stroke="@vet2" stroke-width="1" opacity="0.7"/>`
      + `</g>`,
  },
};
