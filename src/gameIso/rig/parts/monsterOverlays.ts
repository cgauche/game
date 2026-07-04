/**
 * Calques (overlays) d'apparence monstrueuse NON-appendice — art SVG PUR (zéro dépendance), dessiné
 * dans le repère LOCAL de l'os porteur. Griffes / plaie / verrues / crocs / membres démon / stries :
 * consommés par `monsterInjection` et ré-exportés par `monstrous.ts` pour les `creatures/defs`.
 *
 * Les CORNES/QUEUE ne vivent PLUS ici : leur art MULTI-VUES a été déplacé dans le registre `defs/`
 * `appendages/` (1 appendice = 1 fichier), référencé PAR ID (monster.cornes / appendageFeature).
 */

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
