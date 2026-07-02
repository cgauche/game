import type { PropViz } from '../../types';
import { P } from '../../decorPalette';

// Escalier de loge (1×1) : une volée de marches de bois montant vers la galerie, avec rampe dorée —
// le franchissement visible entre le parterre et les loges en surplomb (relié en données par
// `Scene.stairs`). Ancré aux pieds ; les marches s'élèvent vers l'arrière (haut-gauche).
export const prop: PropViz = {
  id: 'escalier-loge',
  foot: { w: 1, h: 1 },
  label: 'Escalier de loge',
  render: () =>
    `<g><ellipse cx="60" cy="147" rx="46" ry="8" fill="${P.ombre}" opacity="0.2"/>` +
    [0, 1, 2, 3, 4, 5]
      .map((i) => {
        const w = 84 - i * 6;
        const x = 20 + i * 3;
        const y = 134 - i * 16;
        return (
          `<rect x="${x}" y="${y}" width="${w}" height="16" rx="2" fill="${P.boisFonce12}"/>` + // contremarche (face avant, sombre)
          `<rect x="${x - 3}" y="${y - 5}" width="${w + 6}" height="7" rx="2" fill="${P.boisFonce8}"/>` + // nez de marche (clair)
          `<rect x="${x - 3}" y="${y - 5}" width="${w + 6}" height="2" fill="${P.boisMoyen3}"/>` // reflet
        );
      })
      .join('') +
    `<path d="M16 140 L34 52" stroke="${P.boisMoyen21}" stroke-width="3" fill="none"/>` + // rampe dorée
    `<g fill="${P.orMoyen9}"><circle cx="16" cy="140" r="3.4"/><circle cx="34" cy="52" r="3.8"/></g></g>`,
};
