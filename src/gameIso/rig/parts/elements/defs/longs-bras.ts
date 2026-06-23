import type { AppearanceElement } from '../types';

// Longs bras : avant-bras démesuré qui pend presque jusqu'aux chevilles, terminé par une grande main
// lourde. Membre STRUCTURÉ (musclé, pas mou comme « Bras élastiques ») dessiné au repère de la main,
// retombant vers le bas (y croissant). Léger miroir G/D.
const BRAS = (sx: number) => '<g data-mut="longs-bras">'
  // avant-bras long et galbé descendant le long de la jambe
  + `<path d="M${-2.6 * sx} 0 Q${-3.2 * sx} 9 ${-2.4 * sx} 18 Q${-2.6 * sx} 24 ${-1.6 * sx} 28 `
  + `L${1.8 * sx} 28 Q${2.6 * sx} 24 ${2.4 * sx} 18 Q${3 * sx} 9 ${2.4 * sx} 0 Z" `
  + 'fill="@peau" stroke="@peauO" stroke-width="0.6"/>'
  // relief du muscle de l'avant-bras
  + `<path d="M${-1 * sx} 4 Q${-2 * sx} 12 ${-1.2 * sx} 22" stroke="@peauO" stroke-width="0.5" fill="none" opacity="0.55"/>`
  + `<path d="M${1.2 * sx} 5 Q${1.8 * sx} 13 ${1.2 * sx} 23" stroke="@peauH" stroke-width="0.5" fill="none" opacity="0.5"/>`
  // grande main lourde au bout
  + `<path d="M${-2.2 * sx} 27 Q${-3.2 * sx} 33 0 34 Q${3.2 * sx} 33 ${2.2 * sx} 27 Z" fill="@peau" stroke="@peauO" stroke-width="0.55"/>`
  // gros doigts pendants
  + `<path d="M${-1.8 * sx} 33 q${-0.3 * sx} 2.2 ${0.3 * sx} 3.4 M${-0.5 * sx} 33.8 q${-0.1 * sx} 2 0 3.6 M${0.9 * sx} 33.8 q${0.1 * sx} 2 0 3.6 M${2 * sx} 32.6 q${0.4 * sx} 2 ${-0.2 * sx} 3.2" stroke="@peau" stroke-width="1.2" fill="none" stroke-linecap="round"/>`
  + '</g>';

export const element: AppearanceElement = {
  key: 'longs-bras', label: 'Longs bras', category: 'mutation',
  overlays: [
    { bone: 'mainG', svg: BRAS(1) },
    { bone: 'mainD', svg: BRAS(-1) },
  ],
};
