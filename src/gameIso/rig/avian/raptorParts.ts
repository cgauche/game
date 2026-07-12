/**
 * Parts RAPACE GÉANT (Grand Aigle, artwork ZI p.65 : aigle en PIQUÉ, ailes déployées immenses
 * en V, serres tendues en avant, bec crochu massif ouvert). Mode du gabarit aviaire (2 os
 * corps/tete, machinerie composeBird) — seul le dessin change : corps en diagonale de piqué,
 * deux ailes levées à rémiges digitées (aile lointaine claire @cheveux, aile proche brun très
 * sombre @corps), tête/poitrail dorés @corpsH, pattes jaunes @cuir tendues à serres noires.
 */
import type { View } from '../facing';
import type { BirdProps } from './composeBird';

const CLAW = '#1c1208';
const BEAK = '#cfc4ae';
const BEAK_O = '#4a4034';
const BEAK_TIP = '#241c12';

/** Serre : doigt @cuir + griffe noire crochue vers le bas. (x,y)=racine, (dx,dy)=doigt. */
function talon(x: number, y: number, dx: number, dy: number, w: number): string {
  const tx = x + dx, ty = y + dy, s = dx >= 0 ? 1 : -1;
  return `<path d="M${x} ${y} l${dx} ${dy}" stroke="@cuir" stroke-width="${w}" stroke-linecap="round" fill="none"/>` +
    `<path d="M${tx} ${ty} q${(2.8 * s).toFixed(1)} 1.6 ${(1.1 * s).toFixed(1)} 4.4" stroke="${CLAW}" stroke-width="${(w * 0.7).toFixed(2)}" stroke-linecap="round" fill="none"/>`;
}

/** Patte tendue en avant (profil) : tarse écaillé + 3 serres + ergot arrière. */
function legProfile(x0: number, y0: number, x1: number, y1: number, w: number, far: boolean): string {
  const midx = (x0 + x1) / 2, midy = (y0 + y1) / 2;
  return `<g${far ? ' opacity="0.9"' : ''}>` +
    `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="@cuir" stroke-width="${w}" stroke-linecap="round" fill="none"/>` +
    `<path d="M${midx - 1.4} ${midy - 2} l3 -1.4 M${midx + 0.6} ${midy + 0.4} l3 -1.4 M${x0 + 0.4} ${y0 + 1} l3 -1.4" stroke="#8a6a1a" stroke-width="0.6" fill="none"/>` +
    talon(x1, y1, 6.5, 0.8, w * 0.6) + talon(x1, y1, 5.4, 4, w * 0.6) + talon(x1, y1, 2.2, 6, w * 0.6) +
    `<path d="M${x1} ${y1} q-3.6 2.6 -2.8 5.8" stroke="${CLAW}" stroke-width="${w * 0.55}" stroke-linecap="round" fill="none"/>` +
    `</g>`;
}

/** Aile de face levée en V, rémiges digitées. s=+1 droite, -1 gauche. */
function frontWing(s: number, fill: string, edge: string): string {
  return `<path d="M${6 * s} -4 Q${18 * s} -16 ${24 * s} -34 L${31 * s} -54 L${23 * s} -46 L${25 * s} -37 L${17 * s} -33 L${19 * s} -25 L${10 * s} -23 Q${6 * s} -13 ${3 * s} -4 Z" fill="${fill}" stroke="${edge}" stroke-width="0.7"/>` +
    `<path d="M${8 * s} -10 L${27 * s} -48 M${6 * s} -12 L${20 * s} -34 M${5 * s} -14 L${14 * s} -26" stroke="${edge}" stroke-width="0.5" fill="none" opacity="0.5"/>`;
}

export function raptorBodyProfile(p: BirdProps): string {
  const g = p.girth;
  return `<g>` +
    // aile LOINTAINE (claire, brun doré pâle) — dressée au-dessus de l'épaule, un rien vers
    // l'AVANT (+x), rémiges digitées au sommet
    `<path d="M6 -6 Q20 -24 24 -46 L30 -64 L24 -56 L22 -67 L16 -58 L13 -67 L8 -56 Q5 -30 4 -8 Z" fill="@cheveux" stroke="@cheveuxO" stroke-width="0.7"/>` +
    `<path d="M8 -12 L26 -58 M7 -14 L18 -55 M6 -16 L11 -52" stroke="@cheveuxO" stroke-width="0.5" fill="none" opacity="0.5"/>` +
    // queue en éventail vers l'arrière-haut (corps basculé en piqué)
    `<path d="M-12 -8 L-37 -21 L-31 -12 L-39 -6 L-32 -1 L-36 7 L-14 4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M-33 -17 L-15 -5 M-34 -4 L-15 -1 M-33 4 L-15 2" stroke="@corpsO" stroke-width="0.5" opacity="0.5"/>` +
    // corps en diagonale de piqué : dos sombre, poitrail/nuque dorés
    `<g transform="rotate(14)">` +
    `<ellipse cx="0" cy="0" rx="${(16 * g).toFixed(1)}" ry="9.5" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="7" cy="3.5" rx="${(9.5 * g).toFixed(1)}" ry="5.5" fill="@corpsH" opacity="0.92"/>` +
    `<path d="M-6 5 l2.4 1.6 M-1 6.5 l2.4 1.4 M-10 3 l2.4 1.6" stroke="@corpsO" stroke-width="0.6" opacity="0.6"/>` +
    `</g>` +
    // cou doré plongeant vers la tête (bas-avant)
    `<path d="M7 -3 Q14 0 16.5 8 L10 11 Q5 4 4 -1 Z" fill="@corpsH" stroke="@cheveuxO" stroke-width="0.5"/>` +
    // aile PROCHE (brun très sombre) — levée vers l'ARRIÈRE (-x), grandes rémiges digitées ;
    // sa racine reste haute pour laisser voir le poitrail doré
    `<path d="M10 -4 Q12 -26 0 -50 L-10 -68 L-14 -57 L-20 -63 L-25 -50 L-30 -54 L-34 -39 L-38 -41 Q-33 -21 -20 -8 L-10 -4 Z" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<path d="M4 -10 L-7 -60 M0 -10 L-16 -52 M-5 -9 L-25 -44 M-9 -8 L-31 -35" stroke="@corpsO" stroke-width="0.6" fill="none" opacity="0.55"/>` +
    `<path d="M8 -10 Q10 -28 1 -46" stroke="@corpsH" stroke-width="0.8" fill="none" opacity="0.35"/>` +
    // pattes jaunes tendues en avant-bas, serres noires énormes (premier plan)
    legProfile(2, 3, 15, 20, 3.4, true) +
    legProfile(7, 7, 23, 27, 4, false) +
    `</g>`;
}

export function raptorBodyFront(p: BirdProps): string {
  const g = p.girth;
  return `<g>` +
    frontWing(-1, '@cheveux', '@cheveuxO') + frontWing(1, '@corps', '@corpsO') +
    `<ellipse cx="0" cy="0" rx="${(11 * g).toFixed(1)}" ry="13" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<ellipse cx="0" cy="2" rx="${(7.5 * g).toFixed(1)}" ry="9.5" fill="@corpsH" opacity="0.9"/>` +
    `<path d="M-3 -2 l1.6 2 M2 0 l1.6 2 M-1 5 l1.6 2" stroke="@corpsO" stroke-width="0.6" opacity="0.5"/>` +
    `<g>` + `<path d="M-5 10 L-8 24 M5 10 L8 24" stroke="@cuir" stroke-width="3.4" stroke-linecap="round" fill="none"/>` +
    talon(-8, 24, -4.4, 3.6, 2) + talon(-8, 24, 0.2, 5, 2) + talon(-8, 24, 4, 3, 2) +
    talon(8, 24, -4, 3, 2) + talon(8, 24, -0.2, 5, 2) + talon(8, 24, 4.4, 3.6, 2) +
    `</g></g>`;
}

export function raptorBodyBack(p: BirdProps): string {
  const g = p.girth;
  return `<g>` +
    frontWing(-1, '@corps', '@corpsO') + frontWing(1, '@corps', '@corpsO') +
    `<path d="M-4 6 L-8 24 L0 28 L8 24 L4 6 Z" fill="@corps" stroke="@corpsO" stroke-width="0.7"/>` +
    `<path d="M0 8 L0 26 M-4 9 L-4.6 23 M4 9 L4.6 23" stroke="@corpsO" stroke-width="0.5" opacity="0.5"/>` +
    `<ellipse cx="0" cy="-1" rx="${(11 * g).toFixed(1)}" ry="12.5" fill="@corps" stroke="@corpsO" stroke-width="0.8"/>` +
    `<path d="M0 -12 L0 8" stroke="@corpsO" stroke-width="0.7" opacity="0.5"/>` +
    `<path d="M-7 -8 Q0 -4 7 -8" stroke="@corpsH" stroke-width="1" fill="none" opacity="0.45"/>` +
    `</g>`;
}

export function raptorHead(view: View): string {
  if (view === 'front')
    return `<g><circle cx="0" cy="0" r="6" fill="@corpsH" stroke="@cheveuxO" stroke-width="0.6"/>` +
      `<path d="M-5 -2.4 L-1.4 -3.4 M1.4 -3.4 L5 -2.4" stroke="#efe4c8" stroke-width="1.1" fill="none"/>` +
      `<circle cx="-2.8" cy="-1.2" r="1.3" fill="#e8b93c"/><circle cx="-2.8" cy="-1.2" r="0.7" fill="#140a04"/>` +
      `<circle cx="2.8" cy="-1.2" r="1.3" fill="#e8b93c"/><circle cx="2.8" cy="-1.2" r="0.7" fill="#140a04"/>` +
      `<path d="M-2 0.6 L2 0.6 L0.9 5.4 Q0 7.6 -0.9 5.4 Z" fill="${BEAK}" stroke="${BEAK_O}" stroke-width="0.5"/>` +
      `<path d="M-0.9 5.4 Q0 7.6 0.9 5.4 L0.35 7.4 Q0 8.2 -0.35 7.4 Z" fill="${BEAK_TIP}"/></g>`;
  if (view === 'back')
    return `<g><circle cx="0" cy="0" r="6" fill="@corpsH" stroke="@cheveuxO" stroke-width="0.6"/>` +
      `<path d="M0 -5 L0 4 M-3 -4 L-3.6 3 M3 -4 L3.6 3" stroke="@cheveuxO" stroke-width="0.5" opacity="0.45"/></g>`;
  // profil : tête dorée en piqué, sourcil féroce, bec crochu MASSIF ouvert (pointe noire)
  return `<g>` +
    `<path d="M-9 -4 Q-11 4 -5 9 L1 7 Q-5 3 -5 -4 Z" fill="@corpsH" stroke="@cheveuxO" stroke-width="0.5"/>` + // camail
    `<circle cx="1" cy="0" r="6.2" fill="@corpsH" stroke="@cheveuxO" stroke-width="0.6"/>` +
    `<path d="M-4 -4 Q1 -7 6 -3" stroke="@corps" stroke-width="1" fill="none" opacity="0.4"/>` + // calotte
    `<path d="M-1 -3.4 L6 -1.8" stroke="#efe4c8" stroke-width="1.2" fill="none"/>` + // sourcil clair
    `<path d="M0 -2.3 L5.8 -1" stroke="#241505" stroke-width="0.8" fill="none"/>` + // arcade féroce
    `<circle cx="3" cy="0.3" r="1.5" fill="#e8b93c"/><circle cx="3.2" cy="0.4" r="0.85" fill="#140a04"/>` +
    `<path d="M5.5 -2.6 Q7.6 -3.6 9.4 -2.6 L9 0 L5.8 0 Z" fill="@cuir" stroke="${BEAK_O}" stroke-width="0.4"/>` + // cire
    `<path d="M7 0.8 L15.2 2.8 L12.6 6.4 L6.2 3.2 Z" fill="#40140c"/>` + // gueule ouverte
    `<path d="M7.6 -3.8 Q17.2 -4 20 -0.2 Q21 3.2 16.6 9 L14.4 5.6 Q16.2 2 11.6 0.9 L7.2 0.4 Z" fill="${BEAK}" stroke="${BEAK_O}" stroke-width="0.6"/>` + // mandibule sup.
    `<path d="M17.8 0.4 Q20.2 3.6 16.6 9 L14.4 5.6 Q16.1 3.6 15.9 0.4 Z" fill="${BEAK_TIP}"/>` + // crochet noir
    `<path d="M6.2 2.8 L14.2 5.8 Q14.6 8.2 10.6 7.7 L5.2 4.6 Z" fill="#bfb49c" stroke="${BEAK_O}" stroke-width="0.5"/>` + // mandibule inf.
    `<path d="M13.2 5.5 Q14.9 6.4 14.2 8.1" stroke="${BEAK_TIP}" stroke-width="0.9" stroke-linecap="round" fill="none"/>` + // pointe inf.
    `</g>`;
}
