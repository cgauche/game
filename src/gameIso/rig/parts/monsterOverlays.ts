/**
 * Calques (overlays) d'apparence monstrueuse — art SVG PUR (zéro dépendance), dessiné dans le repère
 * LOCAL de l'os porteur. LEAF partagé sans cycle : `monstrous.ts` (compositeur), `elements/defs`
 * (cornes/queue comme éléments), `creatures/defs` (features), et les `monster/defs` de TÊTE (cornes/
 * queue portées PAR la tête → plus de name-matcher). `monstrous.ts` les RÉ-EXPORTE, donc les
 * importeurs existants (`from './monstrous'`) restent valides.
 */

// Cornes de mutant génériques (petites, droites) — repli quand la tête ne déclare pas ses cornes.
export const OV_CORNES = `<path d="M-5 -1 q-2 -9 -8 -12 q2 7 4 13 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.5"/><path d="M5 -1 q2 -9 8 -12 q-2 7 -4 13 z" fill="#cabfae" stroke="#3a3026" stroke-width="0.5"/>`;
// Grandes cornes ivoire de chèvre balayées vers l'arrière (Gor/Ungor/Chamane).
export const OV_CORNES_CAPRIN = `<path d="M-6 -4 Q-12 -10 -10 -20 Q-7 -13 -3 -7 Z" fill="#e8e0c8" stroke="#3a3026" stroke-width="0.5"/><path d="M6 -4 Q12 -10 10 -20 Q7 -13 3 -7 Z" fill="#e8e0c8" stroke="#3a3026" stroke-width="0.5"/>`;
// PROFIL (tête tournée vers +x) : les cornes balaient vers le HAUT-ARRIÈRE (-x), pas en éventail L/R.
// Corne proche (grande, claire) + corne lointaine (plus petite, teinte cassée) = profondeur.
export const OV_CORNES_CAPRIN_PROFILE = `<path d="M-1 -5 Q-9 -10 -12 -19 Q-7 -13 0 -7 Z" fill="#e8e0c8" stroke="#3a3026" stroke-width="0.5"/><path d="M3 -6 Q-2 -10 -5 -17 Q-1 -13 4 -8 Z" fill="#d9d0b6" stroke="#3a3026" stroke-width="0.5"/>`;

// GRANDE paire de cornes du Gor (LDB 83 : « les plus grandes sont les meilleures » — statut) :
// larges croissants annelés qui s'évasent puis se recourbent vers l'avant, base épaisse.
export const OV_CORNES_GOR =
  `<path d="M-5 -3 Q-15 -8 -18 -19 Q-19 -28 -12 -33 Q-16 -26 -13 -19 Q-10 -11 -2 -7 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.6"/>`
  + `<path d="M-14 -14 q-2.5 -1.4 -3.4 -3.4 M-16 -20 q-2 -1.2 -2.6 -3 M-15.5 -26 q-1.8 -0.8 -2.3 -2.4" stroke="#8a7a5c" stroke-width="0.7" fill="none"/>`
  + `<path d="M5 -3 Q15 -8 18 -19 Q19 -28 12 -33 Q16 -26 13 -19 Q10 -11 2 -7 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.6"/>`
  + `<path d="M14 -14 q2.5 -1.4 3.4 -3.4 M16 -20 q2 -1.2 2.6 -3 M15.5 -26 q1.8 -0.8 2.3 -2.4" stroke="#8a7a5c" stroke-width="0.7" fill="none"/>`;

// Cornes VESTIGIALES de l'ungor (LDB 83 : « cornes vestigiales ou très courtes ») : moignons.
export const OV_CORNES_VESTIGIALES =
  `<path d="M-5.5 -6 Q-7.5 -9 -6.5 -12 Q-4.5 -9.5 -3.5 -7 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.5"/>`
  + `<path d="M5.5 -6 Q7.5 -9 6.5 -12 Q4.5 -9.5 3.5 -7 Z" fill="#ddd2b6" stroke="#3a3026" stroke-width="0.5"/>`;
// Grandes cornes bovines crème en V (Minotaure/Taureau) — plus écartées.
export const OV_CORNES_TAUREAU = `<path d="M-7 -5 Q-16 -10 -16 -22 Q-11 -15 -4 -8 Z" fill="#dcd2b4" stroke="#3a3026" stroke-width="0.6"/><path d="M7 -5 Q16 -10 16 -22 Q11 -15 4 -8 Z" fill="#dcd2b4" stroke="#3a3026" stroke-width="0.6"/>`;
// PROFIL : les deux cornes bovines balaient vers le haut-arrière, corne proche devant la lointaine.
export const OV_CORNES_TAUREAU_PROFILE = `<path d="M-1 -6 Q-10 -11 -13 -21 Q-8 -14 0 -8 Z" fill="#dcd2b4" stroke="#3a3026" stroke-width="0.6"/><path d="M3 -7 Q-3 -11 -6 -19 Q-2 -14 4 -9 Z" fill="#cbc1a3" stroke="#3a3026" stroke-width="0.6"/>`;
// Longues cornes noires lisses recourbées vers l'arrière (démon de Khorne).
// Cornes de SANGUINAIRE (LDB 84 : « monstrueux visage cornu ») : croissants noirs épais qui
// s'évasent sur les côtés puis se RECOURBENT vers l'avant — plus d'oreilles de lapin droites.
export const OV_CORNES_DEMON =
  `<path d="M-4 -7 Q-13 -9 -16 -17 Q-18 -25 -12 -30 Q-9 -32 -6 -31 Q-11 -28 -12 -23 Q-12 -16 -8 -12 Q-6 -10 -2 -9 Z" fill="#1a1410" stroke="#000" stroke-width="0.5"/>`
  + `<path d="M-13 -16 q-1.8 -1.2 -2.4 -3 M-13.5 -22 q-1.4 -1 -1.6 -2.6" stroke="#3a3026" stroke-width="0.6" fill="none"/>`
  + `<path d="M4 -7 Q13 -9 16 -17 Q18 -25 12 -30 Q9 -32 6 -31 Q11 -28 12 -23 Q12 -16 8 -12 Q6 -10 2 -9 Z" fill="#1a1410" stroke="#000" stroke-width="0.5"/>`
  + `<path d="M13 -16 q1.8 -1.2 2.4 -3 M13.5 -22 q1.4 -1 1.6 -2.6" stroke="#3a3026" stroke-width="0.6" fill="none"/>`;
// PROFIL : cornes noires recourbées balayant vers le haut-arrière (proche devant lointaine).
export const OV_CORNES_DEMON_PROFILE =
  `<path d="M-1 -8 Q-11 -11 -14 -19 Q-16 -27 -10 -30 Q-12 -25 -11 -19 Q-9 -13 -1 -10 Z" fill="#1a1410" stroke="#000" stroke-width="0.5"/>`
  + `<path d="M3 -9 Q-4 -11 -7 -18 Q-9 -25 -4 -27 Q-6 -22 -6 -17 Q-4 -13 3 -11 Z" fill="#0f0b08" stroke="#000" stroke-width="0.5"/>`;
export const OV_QUEUE = `<path d="M0 2 Q13 9 17 24 Q11 23 7 15 Q3 9 0 7 Z" fill="@peau" stroke="@peauO" stroke-width="0.6"/>`;
// Queue de RAT (skaven) — longue, NUE, ROSE, en S, traînant au sol : c'est LE tell de
// silhouette du skaven (sans elle il lit comme un nain trapu brun). Repère os `bassin`.
export const OV_QUEUE_RAT = `<path d="M0 3 Q16 6 22 18 Q26 28 20 34 Q24 26 17 21 Q9 17 1 14 Z" fill="#d39a8e" stroke="#9a6a60" stroke-width="0.7"/><path d="M2 5 Q15 8 20 18" fill="none" stroke="#b87f74" stroke-width="0.6" opacity="0.6"/><path d="M6 9 q1 1 0 2 M11 12 q1 1 0 2 M16 16 q1 1 0 2" stroke="#9a6a60" stroke-width="0.5" fill="none" opacity="0.6"/>`;
// PROFIL (tête vers +x) : la queue TRAÎNE derrière (-x), miroir de la vue de face.
export const OV_QUEUE_RAT_PROFILE = `<path d="M0 3 Q-16 6 -22 18 Q-26 28 -20 34 Q-24 26 -17 21 Q-9 17 -1 14 Z" fill="#d39a8e" stroke="#9a6a60" stroke-width="0.7"/><path d="M-2 5 Q-15 8 -20 18" fill="none" stroke="#b87f74" stroke-width="0.6" opacity="0.6"/><path d="M-6 9 q-1 1 0 2 M-11 12 q-1 1 0 2 M-16 16 q-1 1 0 2" stroke="#9a6a60" stroke-width="0.5" fill="none" opacity="0.6"/>`;
// Longues griffes recourbées aux mains (goule) — calque sur l'os `main` (poignet origine,
// doigts vers +y). Griffes sombres dépassant des doigts.
export const OV_GRIFFES = `<path d="M-2.6 3.4 q-1.4 3 -1.2 6 M-0.9 4.4 q-0.5 3.4 -0.2 6.4 M0.9 4.4 q0.5 3.4 0.2 6.4 M2.6 3.4 q1.4 3 1.2 6" stroke="#241a12" stroke-width="1.1" fill="none" stroke-linecap="round"/>`;
// Plaie de chair rouge exposée (zombie) — calque torse.
export const OV_PLAIE = `<ellipse cx="-2" cy="-10" rx="3" ry="4" fill="#7a1010"/><ellipse cx="-2" cy="-10" rx="1.6" ry="2.6" fill="#b03a2e"/>`;
// Peau verruqueuse + ventre pâle (troll) — calque torse : ventre clair (@peauH) + pustules/lumps
// dépareillés (@peauO ombre + @peauH reflet) → la masse verte uniforme cesse de lire « blob ».
export const OV_VERRUES = `<g>`
  + `<ellipse cx="0" cy="6" rx="9" ry="12" fill="@peauH" opacity="0.35"/>`
  + `<circle cx="-7" cy="-14" r="1.7" fill="@peauO"/><circle cx="-6.3" cy="-14.7" r="0.7" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="6" cy="-11" r="1.9" fill="@peauO"/><circle cx="6.7" cy="-11.7" r="0.8" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="-3" cy="-3" r="1.4" fill="@peauO"/><circle cx="-2.5" cy="-3.5" r="0.6" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="8" cy="2" r="1.6" fill="@peauO"/><circle cx="8.6" cy="1.4" r="0.6" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="-8" cy="1" r="1.3" fill="@peauO"/>`
  + `<circle cx="2" cy="-17" r="1.3" fill="@peauO"/><circle cx="2.6" cy="-17.6" r="0.6" fill="@peauH" opacity="0.7"/>`
  + `<circle cx="4" cy="14" r="1.4" fill="@peauO"/>`
  + `</g>`;
// Crocs de vampire (calque sur la tête, par-dessus le visage humain).
export const OV_CROCS = `<path d="M-2 11 l-0.5 2.4 l1 0 z M2 11 l0.5 2.4 l-1 0 z" fill="#f4ecd8" stroke="#b8a888" stroke-width="0.3"/>`;
// Membres rouge sang (démon de Khorne bicolore) — calques sur épaules/cuisses (repère os).
// Highlight clair (côté lumière) + arête sombre (côté ombre) → volume musculaire, pas un aplat.
export const OV_BRAS_ROUGE = `<rect x="-3.4" y="-2" width="6.8" height="36" rx="3.2" fill="#7a1f1c" stroke="#4a1210" stroke-width="0.5"/><path d="M-1.6 1 Q-2.4 18 -1.6 33" stroke="#ad332a" stroke-width="1.5" fill="none" opacity="0.75" stroke-linecap="round"/><path d="M2 3 Q2.6 18 2 31" stroke="#3a0e0c" stroke-width="1.1" fill="none" opacity="0.6" stroke-linecap="round"/>`;
export const OV_CUISSE_ROUGE = `<path d="M-4.6 0 Q-5 26 -3 50 L4 50 Q5 26 4.6 0 Z" fill="#7a1f1c" stroke="#4a1210" stroke-width="0.5"/><path d="M-1.8 3 Q-2 26 -1 47" stroke="#ad332a" stroke-width="1.6" fill="none" opacity="0.75" stroke-linecap="round"/><path d="M2.6 3 Q3 26 2.4 47" stroke="#3a0e0c" stroke-width="1.1" fill="none" opacity="0.55" stroke-linecap="round"/>`;
// Trois stries rouge sombre verticales sur le torse (démon) — calque torse, par-dessus la peau.
export const OV_STRIES = `<path d="M-3 -22 L-3 4 M0 -24 L0 6 M3 -22 L3 4" stroke="#7a1f1c" stroke-width="1.6" opacity="0.8" stroke-linecap="round"/>`;
