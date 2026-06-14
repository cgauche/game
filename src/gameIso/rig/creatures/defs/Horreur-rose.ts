import type { CreatureDef } from '../types';

// Horreur rose de Tzeentch (T1 ch.9) : « démon aux multiples bras, chair ROSE VIF, gueule
// béante hérissée de crocs, tentacules ondulant sans cesse » — « rient et gambadent »
// (surnom canon : « Couineurs »). Tête-gueule dédiée + tentacules aux flancs + griffes.
export const OV_TENTACULES_FLANC = (s: 1 | -1) =>
  `<g stroke-linejoin="round">`
  // tentacule HAUT : jaillit de l'épaule et ondule au-dessus de la silhouette
  + `<path d="M${9 * s} -16 Q${18 * s} -20 ${21 * s} -30 Q${22.5 * s} -37 ${17 * s} -41 Q${20.5 * s} -34 ${18 * s} -28 Q${14.5 * s} -20 ${7 * s} -13.5 Z" fill="@peau" stroke="@peauO" stroke-width="0.8"/>`
  + `<circle cx="${18.6 * s}" cy="-27" r="1.1" fill="@peauO"/><circle cx="${19.8 * s}" cy="-33" r="0.95" fill="@peauO"/><circle cx="${16.6 * s}" cy="-21.5" r="1" fill="@peauO"/>`
  // tentacule BAS : sort du flanc et se recourbe loin du corps
  + `<path d="M${11 * s} 2 Q${21 * s} 2 ${25 * s} -6 Q${26.5 * s} -11 ${23 * s} -14.5 Q${24.5 * s} -9.5 ${21 * s} -5 Q${17.5 * s} -0.5 ${9.5 * s} -1.5 Z" fill="@peau" stroke="@peauO" stroke-width="0.8"/>`
  + `<circle cx="${22.4 * s}" cy="-7" r="1" fill="@peauO"/><circle cx="${23.6 * s}" cy="-11" r="0.85" fill="@peauO"/>`
  + `</g>`;

export const creature: CreatureDef = {
  name: 'Horreur rose',
  plan: 'biped',
  matchPriority: 36, // APRÈS Horreur bleue (35) : « horreur » nu retombe sur la rose
  aliases: ['horreur roses', 'horreurs rose', 'horreurs roses', 'couineur', 'couineurs', 'horreur', 'horreurs'], // « horreur rose » = le nom ; « horreur » nu → rose
  perso: {
    career: 'Nu',
    gabarit: 'gremlin', // dégingandé à grosse tête — la gueule domine la silhouette
    scale: 1.15,
    monster: { tete: 'horreur', griffes: true },
    colors: { peau: '#d84f96' }, // rose vif (ombres/reflets dérivés)
    features: [
      { bone: 'torse', svg: OV_TENTACULES_FLANC(1), scale: 'bone', layer: 60 },
      { bone: 'torse', svg: OV_TENTACULES_FLANC(-1), scale: 'bone', layer: 60 },
    ],
  },
};
