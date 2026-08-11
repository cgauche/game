import type { QuadHeadDef } from '../types';
import { hydraHeadlet, hydraNeck } from '../kit';

/** Arrière d'une tête du cluster : crête @cheveux du rang proche. */
const spikes = (x: number, y: number) =>
  `<path d="M${x} ${y} l-1.4 -2.6 l0.4 2.4 l-1.8 -1.6 l0.9 2.2" stroke="@cheveux" stroke-width="0.7" fill="none"/>`;

export const quadHead: QuadHeadDef = {
  key: 'hydre',
  label: 'Hydre',
  params: ['neckLen', 'bodyLen'],
  // BINDING PAR VUE : le faisceau de cous est dessiné dans UN os — `encolure` en profil (il ondule
  // d'un bloc avec le port d'encolure, l'os `tete` ne porte alors aucun art), `tete` de face et de
  // dos (l'encolure n'y est pas émise, cf. quadParts).
  bone: { profile: 'encolure' },
  art: {
    // 6 cous serpentins étagés (artwork LDB 79 p.323) : rang LOINTAIN sombre derrière (3 têtes hautes)
    // + rang PROCHE devant (3 têtes basses) → entrelacs, pas un éventail plat
    profile: (p) => {
      const L = 30 * p.neckLen;
      return `<g>` +
        hydraNeck(-4, 2, -16, -L * 0.5, -22, -L * 0.82, true) +
        hydraNeck(-1, 2, -2, -L * 0.72, -5, -L * 1.16, true) +
        hydraNeck(2, 2, 10, -L * 0.6, 15, -L * 1.0, true) +
        hydraHeadlet(-22, -L * 0.82, -32, 0.92, true) +
        hydraHeadlet(-5, -L * 1.16, -6, 0.95, true) +
        hydraHeadlet(15, -L * 1.0, 14, 0.92, true) +
        hydraNeck(-3, 3, -11, -L * 0.42, -14, -L * 0.6) +
        hydraNeck(0, 3, 3, -L * 0.55, 5, -L * 0.9) +
        hydraNeck(3, 3, 13, -L * 0.38, 21, -L * 0.62) +
        hydraHeadlet(-14, -L * 0.6, -24, 1.06) +
        hydraHeadlet(5, -L * 0.9, 0, 1.12) +
        hydraHeadlet(21, -L * 0.62, 26, 1.02) + `</g>`;
    },
    // 6 têtes dressées au-dessus du corps : rang lointain sombre haut + rang proche bas
    front: `<g>` +
      hydraNeck(-3, 8, -10, -6, -14, -18, true) + hydraNeck(0, 8, 0, -9, 0, -21, true) + hydraNeck(3, 8, 10, -6, 14, -18, true) +
      hydraHeadlet(-14, -18, -125, 0.85, true) + hydraHeadlet(0, -21, -90, 0.88, true) + hydraHeadlet(14, -18, -55, 0.85, true) +
      hydraNeck(-4, 8, -8, -2, -11, -9) + hydraNeck(0, 8, 0, -3, 0, -12) + hydraNeck(4, 8, 8, -2, 11, -9) +
      hydraHeadlet(-11, -9, -120, 0.95) + hydraHeadlet(0, -12, -90, 1.0) + hydraHeadlet(11, -9, -60, 0.95) + `</g>`,
    // dos des 6 cous + arrière des têtes (ovales, crête @cheveux sur le rang proche)
    back: `<g>` +
      hydraNeck(-3, 6, -9, -8, -13, -19, true) + hydraNeck(0, 6, 0, -10, 0, -22, true) + hydraNeck(3, 6, 9, -8, 13, -19, true) +
      `<ellipse cx="-13" cy="-19" rx="2.6" ry="3" fill="@corpsO"/><ellipse cx="0" cy="-22" rx="2.8" ry="3.2" fill="@corpsO"/><ellipse cx="13" cy="-19" rx="2.6" ry="3" fill="@corpsO"/>` +
      hydraNeck(-4, 6, -8, -4, -11, -12) + hydraNeck(0, 6, 0, -6, 0, -14) + hydraNeck(4, 6, 8, -4, 11, -12) +
      `<ellipse cx="-11" cy="-12" rx="2.8" ry="3.2" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><ellipse cx="0" cy="-14" rx="3" ry="3.4" fill="@corps" stroke="@corpsO" stroke-width="0.5"/><ellipse cx="11" cy="-12" rx="2.8" ry="3.2" fill="@corps" stroke="@corpsO" stroke-width="0.5"/>` +
      spikes(-11, -14.6) + spikes(0, -16.8) + spikes(11, -14.6) + `</g>`,
  },
  // crête de FLAMMES rouge-orangé (@cheveux) le long du dos — signature artwork LDB 79 p.323
  ridge: (p) => {
    const bl = p.bodyLen;
    const fl = (x: number, y: number, h: number) =>
      `M${(x * bl).toFixed(1)} ${y} Q${(x * bl - 2).toFixed(1)} ${y - h * 0.7} ${(x * bl - 3.6).toFixed(1)} ${y - h} Q${(x * bl - 1).toFixed(1)} ${y - h * 0.4} ${(x * bl + 3).toFixed(1)} ${y} Z`;
    return `<g data-ridge="crete-hydre"><path d="${fl(-34, -9, 6)}${fl(-26, -12, 7)}${fl(-18, -14.5, 8)}${fl(-10, -16.5, 8.5)}${fl(-2, -17.5, 8)}${fl(6, -18, 7.5)}${fl(14, -17, 6.5)}" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/></g>`;
  },
};
