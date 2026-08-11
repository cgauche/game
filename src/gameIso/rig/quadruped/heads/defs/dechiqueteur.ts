import type { QuadHeadDef } from '../types';
import { hydraNeck, shredderHeadlet } from '../kit';

/** Piquants @corpsO derrière un crâne, vus de dos. */
const spikes = (x: number, y: number) =>
  `<path d="M${x} ${y} l-1.4 -2.6 l0.4 2.4 l-1.8 -1.6 l0.9 2.2" stroke="@corpsO" stroke-width="0.7" fill="none"/>`;

export const quadHead: QuadHeadDef = {
  key: 'dechiqueteur',
  label: 'Déchiqueteur de Cadavres',
  params: ['neckLen', 'bodyLen'],
  // BINDING PAR VUE : les 5 cous sont dessinés dans UN os — `encolure` en profil, `tete` de face
  // et de dos (l'encolure n'y est pas émise, cf. quadParts).
  bone: { profile: 'encolure' },
  art: {
    // 5 cous serpentins étagés (artwork ZI 5 p.58) : 2 têtes au rang LOINTAIN (rouge sombre) + 3 au
    // rang PROCHE (rouge vif) — chaque cou ÉMERGE du garrot/poitrail en un point PROPRE (racines
    // étalées, jamais une tige commune) et ondule à sa façon
    profile: (p) => {
      const L = 30 * p.neckLen;
      return `<g>` +
        hydraNeck(-11, 4, -25, -L * 0.48, -20, -L * 0.95, true) +
        hydraNeck(-2, 1, 17, -L * 0.58, 13, -L * 1.05, true) +
        shredderHeadlet(-20, -L * 0.95, -30, 0.9, true) +
        shredderHeadlet(13, -L * 1.05, 8, 0.92, true) +
        hydraNeck(-7, 6, -20, -L * 0.3, -15, -L * 0.62) +
        hydraNeck(1, 3, 8, -L * 0.55, 4, -L * 0.9) +
        hydraNeck(7, 4, 18, -L * 0.26, 20, -L * 0.58) +
        shredderHeadlet(-15, -L * 0.62, -26, 1.02) +
        shredderHeadlet(4, -L * 0.9, -4, 1.1) +
        shredderHeadlet(20, -L * 0.58, 24, 1.0) + `</g>`;
    },
    // 5 têtes rouges dressées : 2 lointaines hautes + 3 proches basses
    front: `<g>` +
      hydraNeck(-5, 7, -10, -7, -11, -19, true) + hydraNeck(5, 7, 10, -7, 11, -19, true) +
      shredderHeadlet(-11, -19, -115, 0.85, true) + shredderHeadlet(11, -19, -65, 0.85, true) +
      hydraNeck(-8, 9, -12, -2, -11, -9) + hydraNeck(0, 10, 1, -3, 0, -12) + hydraNeck(8, 9, 12, -2, 11, -9) +
      shredderHeadlet(-11, -9, -120, 0.95) + shredderHeadlet(0, -12, -90, 1.0) + shredderHeadlet(11, -9, -60, 0.95) + `</g>`,
    // dos des 5 cous : ovales rouge sombre/vif + piquants @corpsO
    back: `<g>` +
      hydraNeck(-5, 5, -10, -9, -11, -20, true) + hydraNeck(5, 5, 10, -9, 11, -20, true) +
      `<ellipse cx="-11" cy="-20" rx="2.6" ry="3" fill="@cheveuxO"/><ellipse cx="11" cy="-20" rx="2.6" ry="3" fill="@cheveuxO"/>` +
      hydraNeck(-8, 7, -12, -4, -11, -12) + hydraNeck(0, 8, 1, -6, 0, -14) + hydraNeck(8, 7, 12, -4, 11, -12) +
      `<ellipse cx="-11" cy="-12" rx="2.8" ry="3.2" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/><ellipse cx="0" cy="-14" rx="3" ry="3.4" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/><ellipse cx="11" cy="-12" rx="2.8" ry="3.2" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.5"/>` +
      spikes(-11, -14.6) + spikes(0, -16.8) + spikes(11, -14.6) + `</g>`,
  },
  // haie de PIQUANTS noirs garrot→croupe (artwork ZI 5 p.58 : dos hérissé de longues épines sombres
  // — bien plus proéminentes que les 'epines' génériques)
  ridge: (p) => {
    const bl = p.bodyLen;
    const q = (x: number, y: number, h: number) =>
      `M${(x * bl).toFixed(1)} ${y} Q${(x * bl - 1.6).toFixed(1)} ${(y - h * 0.7).toFixed(1)} ${(x * bl - 3.2).toFixed(1)} ${y - h} Q${(x * bl - 0.4).toFixed(1)} ${(y - h * 0.3).toFixed(1)} ${(x * bl + 2.4).toFixed(1)} ${y + 0.4} Z`;
    return `<g data-ridge="piquants"><path d="${q(20, -18, 8)}${q(14, -19.5, 10)}${q(8, -20.5, 11)}${q(2, -21, 11.5)}${q(-4, -20.5, 11)}${q(-10, -19.5, 10)}${q(-16, -18, 9)}${q(-22, -16.5, 8)}${q(-28, -15, 6.5)}" fill="@corpsO" stroke="#14161c" stroke-width="0.45"/></g>`;
  },
};
