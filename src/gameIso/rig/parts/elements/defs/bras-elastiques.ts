import type { AppearanceElement } from '../types';

// Bras élastiques : avant-bras étiré façon caoutchouc qui PEND sous la main, peau distendue molle
// (contour ondulé, sans muscle) se terminant par une petite main lâche bien en dessous des genoux.
// Dessiné au repère de la MAIN, retombant vers le bas (y croissant). Léger miroir G/D.
const BRAS = (sx: number) => '<g data-mut="bras-elastiques">'
  // membre mou tombant : tube de peau aux flancs ondulés, qui se gonfle puis s'amincit
  + `<path d="M${-2.4 * sx} 0 Q${-3.4 * sx} 7 ${-1.8 * sx} 13 Q${-2.6 * sx} 19 ${-1 * sx} 23 `
  + `L${1.4 * sx} 23 Q${2.4 * sx} 19 ${1.4 * sx} 13 Q${2.8 * sx} 7 ${2.2 * sx} 0 Z" `
  + 'fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  // pli de peau étirée le long du membre
  + `<path d="M${0.2 * sx} 2 Q${-0.6 * sx} 10 ${0.4 * sx} 18 Q${-0.2 * sx} 21 ${0.2 * sx} 22.5" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.6"/>`
  // main lâche au bout, pendante
  + `<path d="M${-1.4 * sx} 22.5 Q${-2 * sx} 26.5 0 27 Q${2 * sx} 26.5 ${1.4 * sx} 22.5 Z" fill="@peau" stroke="@peauO" stroke-width="0.5"/>`
  + `<path d="M${-1 * sx} 26.4 q${-0.2 * sx} 1.4 ${0.3 * sx} 2.2 M0 26.9 q0 1.4 0 2.4 M${1 * sx} 26.4 q${0.2 * sx} 1.4 ${-0.3 * sx} 2.2" stroke="@peau" stroke-width="0.9" fill="none" stroke-linecap="round"/>`
  + '</g>';

export const element: AppearanceElement = {
  key: 'bras-elastiques', label: 'Bras élastiques', category: 'mutation',
  overlays: [
    { bone: 'mainG', svg: BRAS(1) },
    { bone: 'mainD', svg: BRAS(-1) },
  ],
};
