import type { TenueDef } from '../types';

// Spécialiste de siège (AA 02 l.123 + AA 04 l.263, schéma folio 48) — arbalétrier de Braganza :
// armure de plaques LAITON intégrale (plastron à panse + faulds lamellés, spallières, brassards,
// cuissards/genouillères/grèves), chapeau-pot de laiton à large bord et bouton faîtier, plumet
// rouge/vert/blanc (couleurs de Braganza) à l'arrière-gauche, gorgerin ET jupe de mailles sombres,
// baudrier de cuir portant un carquois de carreaux à la hanche.
export const tenue: TenueDef = {
  name: 'Spécialiste de Siège',
  palette: {
    metal: '#c6a44e', metalH: '#efd68e', metalO: '#7d5d20',
    maille: '#545d68', mailleO: '#2c333c', mailleH: '#79828d',
    cuir: '#4b3420', cuirO: '#291a0c', cuirH: '#715230',
  },
  set: {
    torse: {
      front: `<g stroke-linejoin="round">` +
        // gorgerin de mailles (poke au-dessus du plastron)
        `<path d="M-6 -30 Q0 -32.5 6 -30 L5 -25 Q0 -27 -5 -25Z" fill="@mailleO" stroke="#1c2128" stroke-width="0.5"/>` +
        `<g fill="@maille" opacity="0.85"><circle cx="-3" cy="-28.6" r="0.6"/><circle cx="0" cy="-29.2" r="0.6"/><circle cx="3" cy="-28.6" r="0.6"/><circle cx="-1.5" cy="-27.2" r="0.6"/><circle cx="1.5" cy="-27.2" r="0.6"/></g>` +
        // plastron laiton à panse
        `<path d="M-13 -27 Q0 -31 13 -27 L12 0 Q11 9 6 15 Q3 17 0 17.5 Q-3 17 -6 15 Q-11 9 -12 0Z" fill="@metal" stroke="@metalO" stroke-width="0.9"/>` +
        `<path d="M-12.5 -27 Q0 -30.5 12.5 -27 L12 -25 Q0 -28 -12 -25Z" fill="@metalH" opacity="0.5"/>` +
        // bavière de mailles au creux du cou
        `<path d="M-7 -28 Q0 -30 7 -28 L6.4 -23.5 Q0 -25.5 -6.4 -23.5Z" fill="@mailleO" stroke="#1c2128" stroke-width="0.5"/>` +
        `<g fill="@maille" opacity="0.8"><circle cx="-4" cy="-26.4" r="0.55"/><circle cx="0" cy="-26.9" r="0.55"/><circle cx="4" cy="-26.4" r="0.55"/><circle cx="-2" cy="-24.8" r="0.55"/><circle cx="2" cy="-24.8" r="0.55"/></g>` +
        `<path d="M0 -22 Q2.6 -4 0 16 Q-2.6 -4 0 -22Z" fill="@metalH" opacity="0.4"/>` +
        `<path d="M-12 -1 Q-11 9 -6 15 L-4 13.5 Q-9 8 -10 -1Z" fill="@metalO" opacity="0.4"/>` +
        `<path d="M12 -1 Q11 9 6 15 L4 13.5 Q9 8 10 -1Z" fill="@metalO" opacity="0.4"/>` +
        // spallières lamellées
        `<path d="M-13.5 -26 Q-17 -23 -16.5 -15 Q-16 -11 -13 -12 Q-11 -20 -12 -26Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>` +
        `<path d="M-16 -21 Q-13.5 -22 -11.6 -20 M-16.3 -16.5 Q-13.5 -17.5 -12.2 -15.6" fill="none" stroke="@metalO" stroke-width="0.5" opacity="0.7"/>` +
        `<path d="M-15.6 -24 Q-13.5 -25 -11.7 -24" fill="none" stroke="@metalH" stroke-width="0.6" opacity="0.6"/>` +
        `<path d="M13.5 -26 Q17 -23 16.5 -15 Q16 -11 13 -12 Q11 -20 12 -26Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>` +
        `<path d="M16 -21 Q13.5 -22 11.6 -20 M16.3 -16.5 Q13.5 -17.5 12.2 -15.6" fill="none" stroke="@metalO" stroke-width="0.5" opacity="0.7"/>` +
        `<path d="M15.6 -24 Q13.5 -25 11.7 -24" fill="none" stroke="@metalH" stroke-width="0.6" opacity="0.6"/>` +
        // faulds lamellés (2 bandes)
        `<path d="M-11.5 15 Q0 18.5 11.5 15 L11 20.5 Q0 24 -11 20.5Z" fill="@metal" stroke="@metalO" stroke-width="0.7"/>` +
        `<path d="M-10.6 16.2 Q0 19.4 10.6 16.2" fill="none" stroke="@metalH" stroke-width="0.6" opacity="0.55"/>` +
        `<path d="M-11 20 Q0 23.5 11 20 L10.4 25.6 Q0 29 -10.4 25.6Z" fill="@metal" stroke="@metalO" stroke-width="0.7"/>` +
        `<path d="M-10 21.2 Q0 24.4 10 21.2" fill="none" stroke="@metalH" stroke-width="0.6" opacity="0.55"/>` +
        `<g fill="@metalO"><circle cx="-8" cy="18" r="0.55"/><circle cx="8" cy="18" r="0.55"/><circle cx="-8" cy="23" r="0.55"/><circle cx="8" cy="23" r="0.55"/></g>` +
        // jupe de mailles sous les faulds
        `<path d="M-10 24.5 Q0 27.5 10 24.5 L9 33 Q0 36 -9 33Z" fill="@mailleO" stroke="#1c2128" stroke-width="0.6"/>` +
        `<g fill="@maille" opacity="0.75"><circle cx="-7" cy="27" r="0.6"/><circle cx="-3.5" cy="27.8" r="0.6"/><circle cx="0" cy="28.2" r="0.6"/><circle cx="3.5" cy="27.8" r="0.6"/><circle cx="7" cy="27" r="0.6"/><circle cx="-5.2" cy="29.6" r="0.6"/><circle cx="-1.6" cy="30.2" r="0.6"/><circle cx="1.6" cy="30.2" r="0.6"/><circle cx="5.2" cy="29.6" r="0.6"/><circle cx="-3.4" cy="31.8" r="0.6"/><circle cx="0" cy="32.2" r="0.6"/><circle cx="3.4" cy="31.8" r="0.6"/></g>` +
        `<g fill="@mailleH" opacity="0.5"><circle cx="-5.2" cy="27.3" r="0.4"/><circle cx="1.8" cy="28.4" r="0.4"/><circle cx="-2.6" cy="30" r="0.4"/></g>` +
        // baudrier de cuir en diagonale
        `<path d="M-11 -21 L8.5 13" stroke="@cuirO" stroke-width="3.4" fill="none" stroke-linecap="round"/>` +
        `<path d="M-11 -21 L8.5 13" stroke="@cuir" stroke-width="2.1" fill="none" stroke-linecap="round"/>` +
        `<path d="M-10.4 -20 L8 12" stroke="@cuirH" stroke-width="0.5" fill="none" opacity="0.55"/>` +
        // carquois de carreaux à la hanche droite (empennages débordant vers le haut)
        `<path d="M6.6 7.6 L10.8 6.9 L11.8 15 L8 15.6Z" fill="@cuir" stroke="@cuirO" stroke-width="0.6"/>` +
        `<path d="M7.1 8.3 L10.4 7.7" stroke="@cuirH" stroke-width="0.5" opacity="0.6"/>` +
        `<g stroke="#2f2f2d" stroke-width="0.9" stroke-linecap="round"><path d="M7.8 7.6 L7 1.6"/><path d="M9 7 L8.6 0.8"/><path d="M10.2 6.9 L10.4 1.8"/></g>` +
        `<g fill="#43433f" stroke="#2f2f2d" stroke-width="0.3"><path d="M7 1.6 L5.9 3.3 L7.9 3.1Z"/><path d="M8.6 0.8 L7.5 2.7 L9.5 2.5Z"/><path d="M10.4 1.8 L9.4 3.5 L11.3 3.3Z"/></g>` +
        `</g>`,
      back: `<g stroke-linejoin="round">` +
        `<path d="M-6 -30 Q0 -32.5 6 -30 L5 -25 Q0 -27 -5 -25Z" fill="@mailleO" stroke="#1c2128" stroke-width="0.5"/>` +
        `<path d="M-13 -27 Q0 -31 13 -27 L12 0 Q11 9 6 15 Q0 17.5 -6 15 Q-11 9 -12 0Z" fill="@metalO" stroke="#5a4116" stroke-width="0.9"/>` +
        `<path d="M-13 -27 Q0 -31 13 -27 L11.5 -22 Q0 -26 -11.5 -22Z" fill="@metal" stroke="@metalO" stroke-width="0.5" opacity="0.8"/>` +
        `<path d="M0 -26 Q1.4 -5 0 15" fill="none" stroke="@metal" stroke-width="0.9" opacity="0.55"/>` +
        `<path d="M-8 -23 Q0 -20 8 -23" fill="none" stroke="#5a4116" stroke-width="0.7" opacity="0.7"/>` +
        `<path d="M-13.5 -26 Q-17 -23 -16.5 -15 Q-16 -11 -13 -12 Q-11 -20 -12 -26Z" fill="@metalO" stroke="#5a4116" stroke-width="0.8"/>` +
        `<path d="M13.5 -26 Q17 -23 16.5 -15 Q16 -11 13 -12 Q11 -20 12 -26Z" fill="@metalO" stroke="#5a4116" stroke-width="0.8"/>` +
        `<path d="M-11.5 15 Q0 18.5 11.5 15 L11 20.5 Q0 24 -11 20.5Z" fill="@metalO" stroke="#5a4116" stroke-width="0.7"/>` +
        `<path d="M-11 20 Q0 23.5 11 20 L10.4 25.6 Q0 29 -10.4 25.6Z" fill="@metalO" stroke="#5a4116" stroke-width="0.7"/>` +
        `<path d="M-10 24.5 Q0 27.5 10 24.5 L9 33 Q0 36 -9 33Z" fill="@mailleO" stroke="#1c2128" stroke-width="0.6"/>` +
        `<g fill="@maille" opacity="0.6"><circle cx="-6" cy="27.4" r="0.6"/><circle cx="-2" cy="28.2" r="0.6"/><circle cx="2" cy="28.2" r="0.6"/><circle cx="6" cy="27.4" r="0.6"/><circle cx="-3.6" cy="30.4" r="0.6"/><circle cx="0" cy="30.8" r="0.6"/><circle cx="3.6" cy="30.4" r="0.6"/></g>` +
        `<path d="M8.5 -21 L-9 14" stroke="@cuirO" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.9"/>` +
        `</g>`,
      profile: `<g stroke-linejoin="round">` +
        `<path d="M-4.5 -30 Q0 -32 3 -30 L3 -25 Q0 -26.5 -3.5 -25Z" fill="@mailleO" stroke="#1c2128" stroke-width="0.5"/>` +
        `<path d="M-5 -28 Q4 -31 8.5 -25 Q9.5 -8 6.5 4 Q6 10 3.6 15 Q0 17 -3 15 Q-6 6 -5 -28Z" fill="@metal" stroke="@metalO" stroke-width="0.9"/>` +
        `<path d="M4.4 -26 Q7.4 -8 5.2 5 L4.6 13.5" fill="none" stroke="@metalH" stroke-width="0.9" opacity="0.5"/>` +
        `<path d="M-5 -2 Q-6 -14 -5 -28 Q-3 -30 -1 -29 L-1 4Z" fill="@metalO" opacity="0.5"/>` +
        `<path d="M-4 -27 Q4 -30 8 -25 Q8 -18 5 -16 Q-1 -19 -3 -24Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>` +
        `<path d="M-3.4 -25 Q4 -28 7 -24" fill="none" stroke="@metalH" stroke-width="0.6" opacity="0.55"/>` +
        `<path d="M-5 15 Q0 18 6.5 15 L6 20.5 Q0 23.5 -5 20.5Z" fill="@metal" stroke="@metalO" stroke-width="0.7"/>` +
        `<path d="M-5 20 Q0 23 6 20 L5.4 25.5 Q0 28.5 -5 25.5Z" fill="@metal" stroke="@metalO" stroke-width="0.7"/>` +
        `<path d="M-5 24.5 Q0 27 5.6 24.5 L5 33 Q0 35.5 -5 33Z" fill="@mailleO" stroke="#1c2128" stroke-width="0.6"/>` +
        `<g fill="@maille" opacity="0.7"><circle cx="-2.6" cy="27" r="0.6"/><circle cx="0.6" cy="27.8" r="0.6"/><circle cx="3.4" cy="27" r="0.6"/><circle cx="-1.4" cy="30" r="0.6"/><circle cx="1.8" cy="30.4" r="0.6"/><circle cx="0.2" cy="31.8" r="0.6"/></g>` +
        `<path d="M-3 -19 L5 12" stroke="@cuirO" stroke-width="2.2" fill="none" stroke-linecap="round"/>` +
        `<path d="M-3 -19 L5 12" stroke="@cuir" stroke-width="1.2" fill="none" stroke-linecap="round"/>` +
        `</g>`,
    },
    jambes: {
      front: `<g stroke-linejoin="round">` +
        // cuissard
        `<path d="M-4.6 0 Q-5.6 10 -4.6 20 L4.6 20 Q5.6 10 4.6 0Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>` +
        `<path d="M0 1 Q0.4 10 0 19" fill="none" stroke="@metalH" stroke-width="0.7" opacity="0.5"/>` +
        `<path d="M-4.4 1 Q-5.2 10 -4.2 19 M4.4 1 Q5.2 10 4.2 19" fill="none" stroke="@metalO" stroke-width="0.5" opacity="0.6"/>` +
        // genouillère (avec aileron)
        `<path d="M-5 19 Q0 17 5 19 Q5.8 24 4.4 27 Q0 29 -4.4 27 Q-5.8 24 -5 19Z" fill="@metal" stroke="@metalO" stroke-width="0.9"/>` +
        `<path d="M-3.8 22 Q0 20.2 3.8 22" fill="none" stroke="@metalH" stroke-width="0.7" opacity="0.65"/>` +
        `<path d="M-5 22 Q-6.6 22.5 -6.4 25 Q-5.4 25 -4.6 24Z" fill="@metal" stroke="@metalO" stroke-width="0.6"/>` +
        // grève
        `<path d="M-4.6 27 Q0 29 4.6 27 L4.4 47 Q0 49 -4.4 47Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>` +
        `<path d="M0 28.5 Q0.4 38 0 46" fill="none" stroke="@metalH" stroke-width="0.7" opacity="0.5"/>` +
        `<path d="M-4.4 29 Q-5 38 -4.2 46 M4.4 29 Q5 38 4.2 46" fill="none" stroke="@metalO" stroke-width="0.5" opacity="0.55"/>` +
        `<path d="M-4.4 44 Q0 46 4.4 44 L4.4 47.5 Q0 49.5 -4.4 47.5Z" fill="@metalO" opacity="0.5"/>` +
        `</g>`,
      back: `<g stroke-linejoin="round">` +
        `<path d="M-4.6 0 Q-5.6 10 -4.6 20 L4.6 20 Q5.6 10 4.6 0Z" fill="@metalO" stroke="#5a4116" stroke-width="0.8"/>` +
        `<path d="M0 1 Q0 10 0 19" fill="none" stroke="#5a4116" stroke-width="0.6" opacity="0.6"/>` +
        `<path d="M-5 19 Q0 17 5 19 Q5.8 24 4.4 27 Q0 29 -4.4 27 Q-5.8 24 -5 19Z" fill="@metalO" stroke="#5a4116" stroke-width="0.9"/>` +
        `<path d="M-4.6 27 Q0 29 4.6 27 L4.4 47 Q0 49 -4.4 47Z" fill="@metalO" stroke="#5a4116" stroke-width="0.8"/>` +
        `<path d="M0 28.5 Q0 38 0 46" fill="none" stroke="#5a4116" stroke-width="0.6" opacity="0.55"/>` +
        `<path d="M-4.4 44 Q0 46 4.4 44 L4.4 47.5 Q0 49.5 -4.4 47.5Z" fill="#4a3411" opacity="0.6"/>` +
        `</g>`,
      profile: `<g stroke-linejoin="round">` +
        `<path d="M-3.6 0 Q-4.4 10 -3.4 20 L3.8 20 Q4.4 10 3.8 0Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>` +
        `<path d="M0.4 1 Q0.6 10 0.4 19" fill="none" stroke="@metalH" stroke-width="0.6" opacity="0.5"/>` +
        `<path d="M-3.8 19 Q1 17 4.6 19.5 Q5.4 24 4 27 Q0 29 -3.4 27 Q-4.6 24 -3.8 19Z" fill="@metal" stroke="@metalO" stroke-width="0.9"/>` +
        `<path d="M-3.4 22 Q1 20.4 4.2 22.4" fill="none" stroke="@metalH" stroke-width="0.6" opacity="0.6"/>` +
        `<path d="M-3.4 27 Q0.6 29 4 27 L3.8 47 Q0.4 49 -3.2 47Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>` +
        `<path d="M0.4 28.5 Q0.6 38 0.4 46" fill="none" stroke="@metalH" stroke-width="0.6" opacity="0.5"/>` +
        `<path d="M-3.2 44 Q0.4 46 3.8 44 L3.8 47.5 Q0.4 49.5 -3.2 47.5Z" fill="@metalO" opacity="0.5"/>` +
        `</g>`,
    },
    bras: `<g stroke-linejoin="round">` +
      // spallière (2 lames)
      `<path d="M-5 -2 Q-8.4 -1 -8.4 6 Q-8.4 10 -5.2 10 Q-3 6 -3.4 1 Q-4.2 -1 -5 -2Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>` +
      `<path d="M-7.6 1 Q-7.6 6 -6.6 9.4 M-5.4 0 Q-5 5 -4.6 9" fill="none" stroke="@metalO" stroke-width="0.5" opacity="0.6"/>` +
      `<path d="M-6.8 -0.4 Q-6.8 4 -5.8 8" fill="none" stroke="@metalH" stroke-width="0.5" opacity="0.55"/>` +
      // brassard (haut de bras)
      `<path d="M-4 1 Q-5 8 -4.4 15 L4.4 15 Q5 8 4 1 Q0 -1 -4 1Z" fill="@metal" stroke="@metalO" stroke-width="0.7"/>` +
      `<path d="M0 0.4 Q0 8 0 14" fill="none" stroke="@metalH" stroke-width="0.6" opacity="0.5"/>` +
      `<path d="M-3.2 1.4 Q-4 8 -3.4 14 M3.2 1.4 Q4 8 3.4 14" fill="none" stroke="@metalO" stroke-width="0.5" opacity="0.55"/>` +
      // cubitière (coude)
      `<path d="M-4.4 14 Q0 16 4.4 14 Q4.8 18 3.6 20.4 Q0 22 -3.6 20.4 Q-4.8 18 -4.4 14Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>` +
      `<path d="M-3.4 16.4 Q0 15 3.4 16.4" fill="none" stroke="@metalH" stroke-width="0.6" opacity="0.6"/>` +
      // avant-bras (canon)
      `<path d="M-3.8 20 Q0 22 3.8 20 L3.4 27 Q0 28.6 -3.4 27Z" fill="@metal" stroke="@metalO" stroke-width="0.7"/>` +
      `<path d="M0 21 Q0 24 0 27" fill="none" stroke="@metalH" stroke-width="0.5" opacity="0.5"/>` +
      // gantelet (cuff)
      `<path d="M-3.4 27 Q0 28.6 3.4 27 L3 30.4 Q0 31.6 -3 30.4Z" fill="@metal" stroke="@metalO" stroke-width="0.7"/>` +
      `<g fill="@metalO"><circle cx="-1.5" cy="29" r="0.4"/><circle cx="0" cy="29.3" r="0.4"/><circle cx="1.5" cy="29" r="0.4"/></g>` +
      `</g>`,
    tete: {
      front: `<g stroke-linejoin="round">` +
        // plumet arrière-gauche (rouge / vert / blanc)
        `<path d="M-5 -14 Q-11 -18 -14.5 -22.5 Q-11.5 -21 -8 -17.5 Q-6 -15.5 -5 -14Z" fill="#ac332e" stroke="#7d1f1c" stroke-width="0.4"/>` +
        `<path d="M-5 -14.5 Q-10 -19.5 -12 -25 Q-9.5 -23.5 -7.5 -19.5 Q-6 -16.5 -5 -14.5Z" fill="#5e7a3c" stroke="#3f5626" stroke-width="0.4"/>` +
        `<path d="M-4.6 -14.5 Q-8.6 -20.5 -9.6 -27 Q-7.6 -25 -6.4 -20 Q-5.4 -16.5 -4.6 -14.5Z" fill="#e8e4d7" stroke="#b7b1a1" stroke-width="0.4"/>` +
        `<path d="M-9.6 -27 Q-8 -22 -6.6 -18" fill="none" stroke="#b7b1a1" stroke-width="0.35" opacity="0.7"/>` +
        // dôme du chapeau-pot
        `<path d="M-8 -3 Q-9 -16.5 0 -17.5 Q9 -16.5 8 -3 Q0 -7 -8 -3Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>` +
        `<path d="M-6 -14.5 Q0 -16.5 5 -14 Q1 -11 -1 -10.4 Q-4 -11 -6 -14.5Z" fill="@metalH" opacity="0.5"/>` +
        `<path d="M4 -15.6 Q7 -12 6.4 -5" fill="none" stroke="@metalO" stroke-width="0.6" opacity="0.6"/>` +
        // bouton faîtier
        `<circle cx="0" cy="-17.6" r="1.9" fill="@metal" stroke="@metalO" stroke-width="0.6"/>` +
        `<circle cx="-0.5" cy="-18.1" r="0.7" fill="@metalH"/>` +
        // anneau à la base du dôme
        `<path d="M-8 -4 Q0 -7.6 8 -4 L8 -2.4 Q0 -6 -8 -2.4Z" fill="@metalO"/>` +
        // large bord
        `<path d="M-13 -2 Q0 -7 13 -2 Q14 2 11 4.2 Q0 -2.4 -11 4.2 Q-14 2 -13 -2Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>` +
        `<path d="M-12 -1.6 Q0 -6.2 12 -1.6" fill="none" stroke="@metalH" stroke-width="0.7" opacity="0.6"/>` +
        `<path d="M-11 4.2 Q0 -2.4 11 4.2 Q6 2.2 0 2.2 Q-6 2.2 -11 4.2Z" fill="@metalO" opacity="0.45"/>` +
        `</g>`,
      back: `<g stroke-linejoin="round">` +
        `<path d="M-4.6 -14.5 Q-9 -20 -11 -26 Q-8.5 -24 -6.5 -19.5 Q-5.4 -16.5 -4.6 -14.5Z" fill="#8f5238" stroke="#5c3018" stroke-width="0.4"/>` +
        `<path d="M-4.6 -14.5 Q-8 -20.5 -9 -27 Q-7 -25 -6 -20 Q-5.2 -16.5 -4.6 -14.5Z" fill="#c9c3b4" stroke="#9a9484" stroke-width="0.4"/>` +
        `<path d="M-8 -3 Q-9 -16.5 0 -17.5 Q9 -16.5 8 -3 Q0 -7 -8 -3Z" fill="@metalO" stroke="#5a4116" stroke-width="0.8"/>` +
        `<path d="M0 -16.6 Q0.6 -11 0 -6" fill="none" stroke="#5a4116" stroke-width="0.6" opacity="0.6"/>` +
        `<circle cx="0" cy="-17.6" r="1.9" fill="@metalO" stroke="#5a4116" stroke-width="0.6"/>` +
        `<path d="M-8 -4 Q0 -7.6 8 -4 L8 -2.4 Q0 -6 -8 -2.4Z" fill="#4a3411"/>` +
        `<path d="M-13 -2 Q0 -7 13 -2 Q14 2 11 4.2 Q0 -2.4 -11 4.2 Q-14 2 -13 -2Z" fill="@metalO" stroke="#5a4116" stroke-width="0.8"/>` +
        `<path d="M-12 -1.6 Q0 -6.2 12 -1.6" fill="none" stroke="@metal" stroke-width="0.6" opacity="0.5"/>` +
        `</g>`,
      profile: `<g stroke-linejoin="round">` +
        // plumet à l'arrière (−x)
        `<path d="M-2 -14 Q-9 -17 -13 -21.5 Q-10 -20.5 -6.5 -17.5 Q-4 -15.5 -2 -14Z" fill="#ac332e" stroke="#7d1f1c" stroke-width="0.4"/>` +
        `<path d="M-2 -14.5 Q-8 -19 -11 -24 Q-8.5 -22.5 -5.5 -18.5 Q-3.5 -16 -2 -14.5Z" fill="#5e7a3c" stroke="#3f5626" stroke-width="0.4"/>` +
        `<path d="M-1.6 -14.5 Q-6.5 -20 -8.5 -26 Q-6.5 -24 -4.5 -19 Q-2.8 -16.5 -1.6 -14.5Z" fill="#e8e4d7" stroke="#b7b1a1" stroke-width="0.4"/>` +
        // dôme (décalé vers l'avant +x)
        `<path d="M-7 -3 Q-7 -16.5 2 -16.5 Q9 -15.5 8 -3 Q1 -7 -7 -3Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>` +
        `<path d="M-4 -14 Q2 -15.5 6 -12.5 Q2 -10 -1 -10 Q-3 -11.5 -4 -14Z" fill="@metalH" opacity="0.5"/>` +
        `<circle cx="1" cy="-16.6" r="1.8" fill="@metal" stroke="@metalO" stroke-width="0.6"/>` +
        `<circle cx="0.5" cy="-17.1" r="0.6" fill="@metalH"/>` +
        `<path d="M-7 -4 Q1 -7.6 8 -4 L8 -2.4 Q1 -6 -7 -2.4Z" fill="@metalO"/>` +
        // bord (déborde plus à l'avant)
        `<path d="M-11 -2 Q0 -6.4 12 -2 Q13 1.6 10 3.6 Q0 -2 -10 3.6 Q-12 1.6 -11 -2Z" fill="@metal" stroke="@metalO" stroke-width="0.8"/>` +
        `<path d="M-10 -1.6 Q0 -5.6 11 -1.6" fill="none" stroke="@metalH" stroke-width="0.7" opacity="0.6"/>` +
        `<path d="M-10 3.6 Q0 -2 10 3.6 Q5 1.8 0 1.8 Q-5 1.8 -10 3.6Z" fill="@metalO" opacity="0.45"/>` +
        `</g>`,
    },
  },
};
