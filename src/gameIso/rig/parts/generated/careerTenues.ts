// Couche de TENUES par carrière : auto (workflow → careerTenuesAuto.ts) + overrides MANUELS.
// Les overrides ci-dessous sont éditables à la main et PRIMENT sur l'auto (l'ingestion ne touche que le fichier auto).
import { GENERATED_CAREER_TENUES_AUTO } from './careerTenuesAuto';

/** Overrides manuels de tenue de carrière (édition à la main OK). */
const MANUAL: Record<string, Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', string>>> = {
  Garde: {
    // Gambeson matelassé bleu ardoise + buffle de cuir, gorgerin d'acier à médaillon crâne,
    // baudrier de cuir en croix, cape rouge drapée sur l'épaule gauche (vu de dos).
    torse: `<g stroke-linejoin="round">`
      + `<path d="M-15 -27 Q-20 -12 -16 22 L-7 28 Q-8 6 -10 -22Z" fill="url(#g_cloak)" stroke="#4a1014" stroke-width="0.8"/>`
      + `<path d="M-14 -27 Q0 -32 14 -27 L13 6 L11 33 Q0 37 -11 33 L-13 6Z" fill="#3a4658" stroke="#222a36" stroke-width="0.8"/>`
      + `<path d="M-12 -24 Q-13 -2 -11 22" fill="none" stroke="#4d5c70" stroke-width="1" opacity="0.7"/>`
      + `<path d="M12 -24 Q13 -2 11 22" fill="none" stroke="#262f3c" stroke-width="1.1" opacity="0.8"/>`
      + `<path d="M-9 6 Q0 9 9 6 M-10 14 Q0 17 10 14 M-10 22 Q0 25 10 22" fill="none" stroke="#2a323e" stroke-width="0.7" opacity="0.6"/>`
      + `<path d="M-10 -10 Q0 -6 10 -10 L9 4 Q0 8 -9 4Z" fill="#7a5a34" stroke="#4a3520" stroke-width="0.7"/>`
      + `<path d="M-9 -9 Q0 -5 9 -9 L8 2 Q0 5 -8 2Z" fill="#8c6a3e" opacity="0.5"/>`
      + `<path d="M-12 -27 Q-14 -22 -11 -16 L11 -16 Q14 -22 12 -27 Q0 -31 -12 -27Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
      + `<circle cx="0" cy="-21" r="2.4" fill="#cdd4df" stroke="#5a6272" stroke-width="0.5"/>`
      + `<path d="M-1.4 -22.2 Q0 -23.4 1.4 -22.2 Q1.5 -20.4 0 -19.4 Q-1.5 -20.4 -1.4 -22.2Z" fill="#3a4150"/>`
      + `<circle cx="-0.7" cy="-21.4" r="0.5" fill="#1a1f28"/><circle cx="0.7" cy="-21.4" r="0.5" fill="#1a1f28"/>`
      + `<path d="M-11 -16 L9 26" stroke="#5a3f24" stroke-width="3.4" stroke-linecap="round"/>`
      + `<path d="M-11 -16 L9 26" stroke="#7a5734" stroke-width="1.2" opacity="0.6"/>`
      + `<circle cx="-2" cy="2" r="0.9" fill="#caa64a"/><circle cx="1.5" cy="11" r="0.9" fill="#caa64a"/>`
      + `<path d="M8.5 -8 Q11 0 9.5 18 Q9 8 7 -2Z M11 -4 Q12.6 6 11 20 Q10.6 10 9.6 0Z" fill="url(#g_crest)" opacity="0.8" stroke="#8a2e08" stroke-width="0.4"/>`
      + `</g>`,
    // Cuisse rembourrée bleu ardoise + genouillère d'acier, accent fendu rouille,
    // botte de cuir sombre à revers bouclé. Côté gauche (miroité à droite).
    jambes: `<g stroke-linejoin="round">`
      + `<path d="M-4.5 0 Q-5.5 14 -4 24 L4 24 Q5.5 14 4.5 0Z" fill="#3a4658" stroke="#222a36" stroke-width="0.8"/>`
      + `<path d="M-3 2 Q-3.6 12 -2.6 22 M2.6 2 Q3.4 12 2.6 22" fill="none" stroke="#2a323e" stroke-width="0.7" opacity="0.6"/>`
      + `<path d="M0.5 1 Q1 11 0.5 21" fill="none" stroke="#a8551c" stroke-width="2.2" opacity="0.55" stroke-linecap="round"/>`
      + `<path d="M-5 22 Q0 19 5 22 Q5.6 28 4.5 31 Q0 33 -4.5 31 Q-5.6 28 -5 22Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.9"/>`
      + `<path d="M-3.6 25.5 Q0 23.8 3.6 25.5" fill="none" stroke="#cdd4df" stroke-width="0.7" opacity="0.7"/>`
      + `<path d="M-4.6 31 Q0 33 4.6 31 L5 50 Q0 52 -5 50Z" fill="#2e2018" stroke="#161009" stroke-width="0.8"/>`
      + `<path d="M-4.4 33 Q0 31.4 4.4 33 L4.6 37 Q0 39 -4.6 37Z" fill="#43301f"/>`
      + `<path d="M-4.6 36 Q0 38 4.6 36" fill="none" stroke="#0e0a06" stroke-width="1.4"/>`
      + `<rect x="-1" y="34.5" width="2" height="2.4" rx="0.4" fill="#caa64a"/>`
      + `<path d="M-4.2 44 Q0 46 4.2 44" fill="none" stroke="#1c130c" stroke-width="0.7" opacity="0.7"/>`
      + `</g>`,
    // Casque d'acier type chapeau de fer : bombe + large bord rabattu, emblème crâne ailé.
    tete: `<g stroke-linejoin="round">`
      + `<path d="M-8 -3 Q0 -16 8 -3 Q0 -8 -8 -3Z" fill="url(#g_steel)" stroke="#39414e" stroke-width="0.8"/>`
      + `<path d="M0 -15.4 Q-7 -8 -7.4 -3.4 Q-3 -7 0 -7.6 Q3 -7 7.4 -3.4 Q7 -8 0 -15.4Z" fill="#cfd6e0" opacity="0.5"/>`
      + `<path d="M-10 -2.6 Q0 -8 10 -2.6 Q11 -0.6 9.6 1.6 Q0 -2.4 -9.6 1.6 Q-11 -0.6 -10 -2.6Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
      + `<path d="M-9.4 -2.2 Q0 -6.4 9.4 -2.2" fill="none" stroke="#dfe6ef" stroke-width="0.6" opacity="0.6"/>`
      + `<path d="M0 -13.2 Q-2.4 -10.4 -2.6 -7.8 Q0 -9 2.6 -7.8 Q2.4 -10.4 0 -13.2Z" fill="#cdd4df" stroke="#5a6272" stroke-width="0.4"/>`
      + `<path d="M-2 -10.6 Q0 -11.6 2 -10.6 Q2.1 -8.8 0 -7.9 Q-2.1 -8.8 -2 -10.6Z" fill="#3a4150"/>`
      + `<circle cx="-0.8" cy="-10" r="0.45" fill="#12161d"/><circle cx="0.8" cy="-10" r="0.45" fill="#12161d"/>`
      + `<path d="M-2.4 -9.6 Q-5 -10.4 -6.2 -9 Q-4 -9 -2.4 -8.6Z M2.4 -9.6 Q5 -10.4 6.2 -9 Q4 -9 2.4 -8.6Z" fill="#b9c0cc" stroke="#7a828f" stroke-width="0.3"/>`
      + `</g>`,
    // Manche bouffante matelassée bleu ardoise à crevés rouille, épaulière d'acier.
    bras: `<g stroke-linejoin="round">`
      + `<path d="M-5 -1 Q-7 7 -5.4 14 Q-4 11 -3.4 8 Q-4.4 4 -4 -0.4Z" fill="#3a4658" stroke="#222a36" stroke-width="0.7"/>`
      + `<path d="M5 -1 Q7 7 5.4 14 Q4 11 3.4 8 Q4.4 4 4 -0.4Z" fill="#2f3a49" stroke="#1c232e" stroke-width="0.7"/>`
      + `<path d="M-4 0 Q-5.6 7 -4.6 14 L4.6 14 Q5.6 7 4 0 Q0 -2 -4 0Z" fill="#34404f"/>`
      + `<path d="M-1.6 1 Q-3.4 7 -2.6 13 M1.6 1 Q3.4 7 2.6 13" fill="none" stroke="#a8551c" stroke-width="1.8" opacity="0.5" stroke-linecap="round"/>`
      + `<path d="M-3.4 4 Q0 6 3.4 4 M-3.6 8 Q0 10 3.6 8" fill="none" stroke="#262f3c" stroke-width="0.6" opacity="0.6"/>`
      + `<path d="M-5 -2 Q0 -5 5 -2 Q6 1 4.6 4 Q0 1 -4.6 4 Q-6 1 -5 -2Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
      + `<path d="M-4.4 -1.4 Q0 -4 4.4 -1.4" fill="none" stroke="#cdd4df" stroke-width="0.5" opacity="0.6"/>`
      + `<path d="M-3.4 14 Q0 16 3.4 14 L3.2 24 Q0 25.4 -3.2 24Z" fill="#34404f" stroke="#1c232e" stroke-width="0.6"/>`
      + `<path d="M-3 24 Q0 25.4 3 24 L2.6 30 Q0 31 -2.6 30Z" fill="#43301f" stroke="#241a10" stroke-width="0.6"/>`
      + `</g>`,
  },
  Soldat: {
    // Fantassin d'État : cuirasse d'acier à arête centrale + col riveté, tabard aux
    // couleurs (rouge à pal blanc) frappé d'un médaillon doré, ceinturon de cuir à boucle.
    torse: `<g stroke-linejoin="round">`
      + `<path d="M-13 -27 Q0 -32 13 -27 L12 2 Q11 14 6 20 L-6 20 Q-11 14 -12 2Z" fill="url(#g_steel)" stroke="#39414e" stroke-width="0.9"/>`
      + `<path d="M0 -29 Q2.2 -4 0 20 Q-2.2 -4 0 -29Z" fill="#cfd6e0" opacity="0.45"/>`
      + `<path d="M-13 -27 Q0 -32 13 -27 L11 -21 Q0 -25 -11 -21Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.7"/>`
      + `<circle cx="-9" cy="-24" r="0.7" fill="#9aa6b8"/><circle cx="0" cy="-26" r="0.7" fill="#9aa6b8"/><circle cx="9" cy="-24" r="0.7" fill="#9aa6b8"/>`
      + `<path d="M-11.5 13 Q0 16 11.5 13 L10.5 18.5 Q0 21.5 -10.5 18.5Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.6"/>`
      + `<path d="M-6.5 -16 L6.5 -16 L5.6 33 Q0 36 -5.6 33Z" fill="#b0323a" stroke="#7a1c20" stroke-width="0.7"/>`
      + `<path d="M-1.7 -16 L1.7 -16 L1.5 34 L-1.5 34Z" fill="#e8e0d0"/>`
      + `<circle cx="0" cy="-3" r="2.5" fill="#caa64a" stroke="#7a5a1a" stroke-width="0.4"/>`
      + `<circle cx="0" cy="-3" r="1" fill="#7a5a1a"/>`
      + `<path d="M-11 15 Q0 18 11 15 L10 20 Q0 23 -10 20Z" fill="#5a3f24" stroke="#3a2614" stroke-width="0.7"/>`
      + `<rect x="-2.3" y="15.6" width="4.6" height="4.2" rx="0.6" fill="#caa64a" stroke="#7a5a1a" stroke-width="0.5"/>`
      + `</g>`,
    // Cuissard matelassé (chamois) + genouillère d'acier, botte de cuir sombre à revers.
    jambes: `<g stroke-linejoin="round">`
      + `<path d="M-4.6 0 Q-5.4 12 -4 22 L4 22 Q5.4 12 4.6 0Z" fill="#cabf9a" stroke="#8a7d52" stroke-width="0.7"/>`
      + `<path d="M-2 2 Q-2.6 12 -1.8 21 M2 2 Q2.6 12 1.8 21" fill="none" stroke="#a89a6a" stroke-width="0.5" opacity="0.6"/>`
      + `<path d="M-5 22 Q0 19 5 22 Q5.6 27 4.4 30 Q0 32 -4.4 30 Q-5.6 27 -5 22Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.9"/>`
      + `<path d="M-3.6 25 Q0 23.4 3.6 25" fill="none" stroke="#cdd4df" stroke-width="0.6" opacity="0.7"/>`
      + `<path d="M-4.6 30 Q0 32 4.6 30 L5 50 Q0 52 -5 50Z" fill="#3a2816" stroke="#1c130a" stroke-width="0.8"/>`
      + `<path d="M-4.4 32 Q0 30.4 4.4 32 L4.6 36 Q0 38 -4.6 36Z" fill="#5a3f24"/>`
      + `<path d="M-4.6 35 Q0 37 4.6 35" fill="none" stroke="#120c06" stroke-width="1.2"/>`
      + `</g>`,
    // Manche de gambeson matelassée + spallière d'acier (2 lames), brassard de cuir, main.
    bras: `<g stroke-linejoin="round">`
      + `<path d="M-4 0 Q-5.6 8 -4.6 16 L4.6 16 Q5.6 8 4 0 Q0 -2 -4 0Z" fill="#cabf9a" stroke="#8a7d52" stroke-width="0.7"/>`
      + `<path d="M-3 1 Q-3.8 8 -3.2 15 M-1 1 Q-1.6 8 -1.2 15 M1 1 Q1.6 8 1.2 15 M3 1 Q3.8 8 3.2 15" fill="none" stroke="#a89a6a" stroke-width="0.45" opacity="0.7"/>`
      + `<path d="M-5 -2 Q0 -6 5 -2 Q6.3 2 4.6 5 Q0 1.6 -4.6 5 Q-6.3 2 -5 -2Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
      + `<path d="M-4.4 -1.6 Q0 -4.8 4.4 -1.6" fill="none" stroke="#cdd4df" stroke-width="0.5" opacity="0.6"/>`
      + `<path d="M-4.6 4 Q0 1.4 4.6 4 Q5.2 7 3.8 9.4 Q0 6.6 -3.8 9.4 Q-5.2 7 -4.6 4Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.6"/>`
      + `<path d="M-4.6 16 Q0 18 4.6 16 L4 27 Q0 29 -4 27Z" fill="#5a3f24" stroke="#3a2614" stroke-width="0.6"/>`
      + `<path d="M-4.2 19 Q0 21 4.2 19 M-4 23 Q0 25 4 23" fill="none" stroke="#3a2614" stroke-width="0.5" opacity="0.6"/>`
      + `<path d="M-3.4 27 Q0 29 3.4 27 Q3.2 31 0 31.6 Q-3.2 31 -3.4 27Z" fill="@peau"/>`
      + `</g>`,
    // Morion : bombe d'acier à crête, large bord relevé, rivets.
    tete: `<g stroke-linejoin="round">`
      + `<path d="M-9 -2 Q-10 -14 0 -15 Q10 -14 9 -2 Q0 -6 -9 -2Z" fill="url(#g_steel)" stroke="#39414e" stroke-width="0.8"/>`
      + `<path d="M0 -14 Q-6 -10 -7 -3 Q-3 -6 0 -6 Q3 -6 7 -3 Q6 -10 0 -14Z" fill="#cfd6e0" opacity="0.45"/>`
      + `<path d="M0 -16.5 Q-2.2 -9 0 -3 Q2.2 -9 0 -16.5Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.6"/>`
      + `<path d="M-11 -2 Q0 -7 11 -2 Q12.4 1 10 3.4 Q0 -2.4 -10 3.4 Q-12.4 1 -11 -2Z" fill="url(#g_steelD)" stroke="#2a3038" stroke-width="0.8"/>`
      + `<path d="M-10 -1.6 Q0 -6 10 -1.6" fill="none" stroke="#dfe6ef" stroke-width="0.6" opacity="0.6"/>`
      + `<circle cx="-7" cy="-1" r="0.7" fill="#9aa6b8"/><circle cx="7" cy="-1" r="0.7" fill="#9aa6b8"/>`
      + `</g>`,
  },
};

/** Tenue par carrière exposée au moteur : auto + overrides manuels (le manuel l'emporte). */
export const GENERATED_CAREER_TENUES: Record<string, Partial<Record<'torse' | 'jambes' | 'bras' | 'tete', string>>> = {
  ...GENERATED_CAREER_TENUES_AUTO,
  ...MANUAL,
};
