import type { QuadHeadDef } from '../types';
import { dragonHeadlet, hydraNeck, lionHeadlet, raptorHeadlet } from '../kit';

export const quadHead: QuadHeadDef = {
  key: 'chimere',
  label: 'Chimère',
  params: ['neckLen'],
  // BINDING PAR VUE : les 3 cous sont dessinés dans UN os — `encolure` en profil, `tete` de face
  // et de dos (l'encolure n'y est pas émise, cf. quadParts).
  bone: { profile: 'encolure' },
  art: {
    // 3 cous en éventail : dragon (arrière, dressé), lion (centre, dominant), rapace (avant)
    profile: (p) => {
      const L = 30 * p.neckLen;
      return `<g>` +
        hydraNeck(-3, 2, -14, -L * 0.6, -19, -L * 1.04) +
        hydraNeck(3, 2, 10, -L * 0.52, 14, -L * 0.88) +
        hydraNeck(0, 2, 1, -L * 0.72, 1, -L * 1.18) +
        dragonHeadlet(-19, -L * 1.04, -28, 1.0) +
        raptorHeadlet(14, -L * 0.88, -6, 0.95) +
        lionHeadlet(1, -L * 1.18, -8, 1.12) + `</g>`;
    },
    // 3 têtes en éventail : dragon à gauche, lion (crinière) au centre, rapace à droite
    front: `<g>` +
      hydraNeck(-4, 8, -9, -4, -12, -13) + hydraNeck(4, 8, 9, -4, 12, -13) + hydraNeck(0, 8, 0, -6, 0, -17) +
      dragonHeadlet(-12, -13, -125, 0.9) + raptorHeadlet(12, -13, -55, 0.9) + lionHeadlet(0, -17, -90, 1.0) + `</g>`,
    // dos des 3 cous : nuques dragon/rapace (ovales) + couronne de crinière du lion au centre
    back: `<g>` +
      hydraNeck(-4, 6, -8, -4, -11, -12) + hydraNeck(4, 6, 8, -4, 11, -12) + hydraNeck(0, 6, 0, -6, 0, -15) +
      `<ellipse cx="-11" cy="-12" rx="2.8" ry="3.2" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
      `<path d="M-11 -14.4 l-1.4 -2.6 l0.4 2.4 l-1.8 -1.6 l0.9 2.2" stroke="@cheveux" stroke-width="0.7" fill="none"/>` + // crête du dragon
      `<ellipse cx="11" cy="-12" rx="2.6" ry="3" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
      `<path d="M11 -14.2 l-1.6 -2.2 l0.2 2.2 M12 -14.2 l0.8 -2.6 l0.6 2.4" stroke="@corpsO" stroke-width="0.7" fill="none" stroke-linecap="round"/>` + // plumes du rapace
      `<path d="M0 -19 l-2.6 -3 l0.6 3.2 l-3 -1.6 l1.4 3.2 l-3.2 0.6 l2.4 2.6 l-2.6 1.8 l3.2 1 l-1.2 3 l3.4 -1 l1 3 l2 -2.6 l2.4 2.2 l0.6 -3.2 l3.2 0.6 l-1.8 -3 l3 -1.4 l-3 -1.6 l1.8 -2.8 l-3.4 0 l0.8 -3.2 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` + // couronne de crinière
      `<ellipse cx="0" cy="-15" rx="3.1" ry="3.4" fill="@corps" stroke="@corpsO" stroke-width="0.5"/></g>`,
  },
  // LONGUE queue fine dressée en S au-dessus de la croupe, pointe osseuse (ZI 66 l. « longue
  // queue ») — une queue traînante sortirait du gabarit 120×150 (le corps massif touche déjà le
  // bord arrière) ; même compensation d'os que 'reptile'.
  tailProfile: (() => {
    const d = 'M0 0 Q-9 -6 -10.5 -20 Q-11.5 -34 -6 -45 Q-2.5 -52 3 -57';
    return `<g transform="rotate(-42)">` +
      `<path d="${d}" fill="none" stroke="@corps" stroke-width="4.6" stroke-linecap="round"/>` +
      `<path d="M-8.5 -30 Q-9 -42 -3.5 -50 Q-0.5 -54 3 -57" fill="none" stroke="@corps" stroke-width="2.4" stroke-linecap="round"/>` +
      `<path d="${d}" fill="none" stroke="@corpsO" stroke-width="0.9" opacity="0.5"/>` +
      `<path d="M-12.4 -14 l-2.4 -1.6 l2.2 -1.2 M-13 -26 l-2.4 -0.8 l2 -1.8 M-11 -38 l-2 -2 l2.4 -1.2 M-6.2 -47 l-1.2 -2.6 l2.4 -0.6" stroke="@corpsO" stroke-width="0.8" fill="none" stroke-linecap="round"/>` + // épines du fouet
      `<path d="M3 -57 l5 -3.6 l-1.8 5.6 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.4"/>` + // pointe osseuse
      `</g>`;
  })(),
};
